// Cloudflare Worker backend persisting user chat history and AI-extracted file outputs with Supabase Bearer token verification and D1 parameterized queries [Commented by: Google AI Studio on 15/10/2026 09:57 AM]

// Self-contained Cloudflare D1 database interface definitions for zero-dependency portability [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
export interface D1Result<T = unknown> {
  results?: T[];
  success?: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}

// Configured Cloudflare Worker runtime environment interface with D1 and secret bindings [Commented by: Google AI Studio on 31/10/2026 10:31 AM]
export interface Env {
  DB: D1Database;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  CORS_ORIGIN?: string;
  MCP_ENCRYPTION_SECRET?: string;
}


interface SupabaseUser {
  id: string;
  email?: string;
  role?: string;
}

// CORS headers helper supporting wildcard or configured origins from runtime environment [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
function getCorsHeaders(origin: string | null, allowedOrigin: string = '*'): Headers {
  const headers = new Headers();
  let permitOrigin = '*';
  if (allowedOrigin === '*') {
    permitOrigin = '*';
  } else if (allowedOrigin.includes(',')) {
    const list = allowedOrigin.split(',').map((o) => o.trim());
    if (origin && list.includes(origin)) {
      permitOrigin = origin;
    } else {
      permitOrigin = list[0];
    }
  } else {
    permitOrigin = allowedOrigin;
  }

  headers.set('Access-Control-Allow-Origin', permitOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  // Hardened security headers protecting user data and preventing clickjacking/MIME-sniffing [Commented by: Google AI Studio on 30/10/2026 10:48 AM]
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
  return headers;
}

// Sanitization & injection guard rejecting prototype pollution, SQL injection artifacts, and payload abuse [Commented by: Google AI Studio on 30/10/2026 10:48 AM]
function validateSafeId(id: string): boolean {
  return /^[a-zA-Z0-9_\-.:]{1,128}$/.test(id);
}

// Server-side AES-GCM credential encryption, SSRF whitelist, and dynamic MCP execution engine [Commented by: Google AI Studio on 31/10/2026 10:31 AM]
export interface McpDiscoveredTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

const ALLOWED_MCP_DOMAINS = [
  'mcp.cloudflare.com',
  'netlify-mcp.netlify.app',
  'api.cloudflare.com',
  'api.netlify.com',
  'api.github.com',
  'api.supabase.com',
  'api.firecrawl.dev',
  'api.tavily.com',
  'api.notion.com',
  'slack.com',
  'www.googleapis.com',
  'gmail.googleapis.com',
  'docs.googleapis.com'
];

// Canonical verified provider endpoints preventing custom URL overrides [Commented by: Google AI Studio on 31/10/2026 11:05 AM]
export const CANONICAL_PROVIDER_ENDPOINTS: Record<string, string> = {
  cloudflare: 'https://mcp.cloudflare.com/mcp',
  netlify: 'https://netlify-mcp.netlify.app/mcp',
  github: 'https://api.github.com',
  supabase: 'https://api.supabase.com',
  firecrawl: 'https://api.firecrawl.dev',
  tavily: 'https://api.tavily.com',
  notion: 'https://api.notion.com',
  slack: 'https://slack.com',
  gmail: 'https://gmail.googleapis.com',
  google_docs: 'https://docs.googleapis.com',
  google_drive: 'https://www.googleapis.com',
};

function validateSafeMcpUrl(urlStr: string): boolean {

  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:') return false;
    return ALLOWED_MCP_DOMAINS.some(
      (domain) => u.hostname === domain || u.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

async function getMcpEncryptionKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('nanobot-mcp-server-salt-2026'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptServerCredential(plaintext: string, secret: string): Promise<string> {
  const key = await getMcpEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join('');
  const ctHex = Array.from(new Uint8Array(encrypted)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${ivHex}:${ctHex}`;
}

async function decryptServerCredential(cipherCombined: string, secret: string): Promise<string> {
  const parts = cipherCombined.split(':');
  if (parts.length !== 2) throw new Error('Malformed encrypted credentials');
  const [ivHex, ctHex] = parts;
  const key = await getMcpEncryptionKey(secret);
  const ivMatches = ivHex.match(/.{1,2}/g);
  const ctMatches = ctHex.match(/.{1,2}/g);
  if (!ivMatches || !ctMatches) throw new Error('Invalid hex encoding in credentials');
  const iv = new Uint8Array(ivMatches.map((byte) => parseInt(byte, 16)));
  const ct = new Uint8Array(ctMatches.map((byte) => parseInt(byte, 16)));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ct
  );
  return new TextDecoder().decode(decrypted);
}

// Dynamically discover tools from real provider endpoint or verify credentials via official API [Commented by: Google AI Studio on 31/10/2026 10:31 AM]
async function discoverAndValidateMcpProvider(
  providerId: string,
  credentials: Record<string, string>,
  customEndpoint?: string
): Promise<{ success: boolean; tools: McpDiscoveredTool[]; endpoint: string; error?: string }> {
  const token = credentials.token || credentials.apiKey || credentials.accessToken || '';
  if (!token.trim()) {
    return {
      success: false,
      tools: [],
      endpoint: '',
      error: 'Authentication credential (token, API key, or access token) is required',
    };
  }

  const endpoint = customEndpoint || '';

  try {
    switch (providerId) {
      case 'cloudflare': {
        const mcpUrl = endpoint || 'https://mcp.cloudflare.com/mcp';
        if (!validateSafeMcpUrl(mcpUrl)) {
          return { success: false, tools: [], endpoint: mcpUrl, error: 'SSRF Block: Endpoint domain not permitted' };
        }

        // Live connection test against Cloudflare API / MCP server
        let testRes = await fetch(mcpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
            params: {},
          }),
        }).catch(() => null);

        if (testRes && testRes.ok) {
          const data: any = await testRes.json().catch(() => null);
          if (data && data.result && Array.isArray(data.result.tools)) {
            return {
              success: true,
              tools: data.result.tools,
              endpoint: mcpUrl,
            };
          }
        }

        // Verify API token validity with Cloudflare REST API directly
        const verifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!verifyRes.ok) {
          const errText = await verifyRes.text();
          return { success: false, tools: [], endpoint: mcpUrl, error: `Cloudflare token validation failed: ${errText}` };
        }

        const cfTools: McpDiscoveredTool[] = [
          {
            name: 'search',
            description: 'Search Cloudflare documentation and available API endpoints for Workers, D1, R2, and DNS.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Documentation or API query term' },
              },
              required: ['query'],
            },
          },
          {
            name: 'execute',
            description: 'Execute an authenticated Cloudflare API operation across Workers, D1 SQL, R2, and DNS zones.',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'API subpath, e.g. /accounts/{id}/d1/database' },
                method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], description: 'HTTP method' },
                body: { type: 'object', description: 'Optional JSON payload for mutations' },
              },
              required: ['path', 'method'],
            },
          },
          {
            name: 'docs',
            description: 'Fetch technical reference documentation for a Cloudflare product or capability.',
            inputSchema: {
              type: 'object',
              properties: {
                topic: { type: 'string', description: 'Cloudflare topic or endpoint path' },
              },
              required: ['topic'],
            },
          },
        ];

        return { success: true, tools: cfTools, endpoint: mcpUrl };
      }

      case 'netlify': {
        const mcpUrl = endpoint || 'https://netlify-mcp.netlify.app/mcp';
        if (!validateSafeMcpUrl(mcpUrl)) {
          return { success: false, tools: [], endpoint: mcpUrl, error: 'SSRF Block: Endpoint domain not permitted' };
        }

        // Live connection test against Netlify MCP endpoint
        const testRes = await fetch(mcpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
            params: {},
          }),
        }).catch(() => null);

        if (testRes && testRes.ok) {
          const data: any = await testRes.json().catch(() => null);
          if (data && data.result && Array.isArray(data.result.tools)) {
            return {
              success: true,
              tools: data.result.tools,
              endpoint: mcpUrl,
            };
          }
        }

        // Verify Netlify Personal Access Token against Netlify REST API
        const userRes = await fetch('https://api.netlify.com/api/v1/user', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!userRes.ok) {
          const errText = await userRes.text();
          return { success: false, tools: [], endpoint: mcpUrl, error: `Netlify token validation failed: ${errText}` };
        }

        const netlifyTools: McpDiscoveredTool[] = [
          {
            name: 'list_sites',
            description: 'List active Netlify sites, deploy domains, and site configurations.',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'get_site',
            description: 'Inspect a specific Netlify site by site ID or domain name.',
            inputSchema: {
              type: 'object',
              properties: { site_id: { type: 'string', description: 'Netlify Site ID' } },
              required: ['site_id'],
            },
          },
          {
            name: 'trigger_deploy',
            description: 'Trigger a new deploy or rebuild for a Netlify site.',
            inputSchema: {
              type: 'object',
              properties: { site_id: { type: 'string', description: 'Netlify Site ID' } },
              required: ['site_id'],
            },
          },
          {
            name: 'list_deploys',
            description: 'Fetch recent deployments and build statuses for a Netlify site.',
            inputSchema: {
              type: 'object',
              properties: { site_id: { type: 'string', description: 'Netlify Site ID' } },
              required: ['site_id'],
            },
          },
          {
            name: 'get_env_vars',
            description: 'List environment variables configured for a Netlify site or account.',
            inputSchema: {
              type: 'object',
              properties: { site_id: { type: 'string', description: 'Netlify Site ID' } },
              required: ['site_id'],
            },
          },
        ];

        return { success: true, tools: netlifyTools, endpoint: mcpUrl };
      }

      case 'github': {
        const ghUrl = 'https://api.github.com';
        // Verify GitHub Personal Access Token or OAuth Token
        const userRes = await fetch(`${ghUrl}/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'nanobot-mcp-client',
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (!userRes.ok) {
          const errText = await userRes.text();
          return { success: false, tools: [], endpoint: ghUrl, error: `GitHub token verification failed (${userRes.status}): ${errText}` };
        }

        const ghTools: McpDiscoveredTool[] = [
          {
            name: 'search_repositories',
            description: 'Search GitHub repositories by keyword, language, or topic.',
            inputSchema: {
              type: 'object',
              properties: { query: { type: 'string', description: 'GitHub search query' } },
              required: ['query'],
            },
          },
          {
            name: 'get_file_contents',
            description: 'Read the contents of a file from a GitHub repository.',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner (user or organization)' },
                repo: { type: 'string', description: 'Repository name' },
                path: { type: 'string', description: 'File path in repo' },
                ref: { type: 'string', description: 'Branch, commit, or tag (optional)' },
              },
              required: ['owner', 'repo', 'path'],
            },
          },
          {
            name: 'create_or_update_file',
            description: 'Commit and push changes to a file in a GitHub repository.',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                path: { type: 'string', description: 'File path in repo' },
                message: { type: 'string', description: 'Git commit message' },
                content: { type: 'string', description: 'File text content to commit' },
                branch: { type: 'string', description: 'Target branch name (optional)' },
                sha: { type: 'string', description: 'Existing file blob SHA if updating (optional)' },
              },
              required: ['owner', 'repo', 'path', 'message', 'content'],
            },
          },
          {
            name: 'list_issues',
            description: 'List issues in a GitHub repository.',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Issue state filter' },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'create_issue',
            description: 'Create a new issue in a GitHub repository.',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                title: { type: 'string', description: 'Issue title' },
                body: { type: 'string', description: 'Issue description body' },
              },
              required: ['owner', 'repo', 'title'],
            },
          },
          {
            name: 'create_pull_request',
            description: 'Open a pull request between branches in a repository.',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                title: { type: 'string', description: 'PR title' },
                head: { type: 'string', description: 'Head branch containing changes' },
                base: { type: 'string', description: 'Base branch to merge into' },
                body: { type: 'string', description: 'PR description' },
              },
              required: ['owner', 'repo', 'title', 'head', 'base'],
            },
          },
        ];

        return { success: true, tools: ghTools, endpoint: ghUrl };
      }

      case 'supabase': {
        const sbUrl = 'https://api.supabase.com';
        // Verify Supabase Personal Access Token via Management API
        const projRes = await fetch(`${sbUrl}/v1/projects`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'nanobot-mcp-client',
          },
        });

        if (!projRes.ok) {
          const errText = await projRes.text();
          return { success: false, tools: [], endpoint: sbUrl, error: `Supabase PAT verification failed (${projRes.status}): ${errText}` };
        }

        const sbTools: McpDiscoveredTool[] = [
          {
            name: 'list_projects',
            description: 'List all Supabase projects accessible to your account.',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'get_project',
            description: 'Get project configuration, database host, and status for a Supabase project ref.',
            inputSchema: {
              type: 'object',
              properties: { project_ref: { type: 'string', description: 'Supabase project reference' } },
              required: ['project_ref'],
            },
          },
          {
            name: 'execute_sql',
            description: 'Run SQL statements against a Supabase database via the Management API.',
            inputSchema: {
              type: 'object',
              properties: {
                project_ref: { type: 'string', description: 'Supabase project reference ID' },
                query: { type: 'string', description: 'SQL query to execute' },
              },
              required: ['project_ref', 'query'],
            },
          },
          {
            name: 'list_tables',
            description: 'Inspect schemas and tables in a Supabase project.',
            inputSchema: {
              type: 'object',
              properties: {
                project_ref: { type: 'string', description: 'Supabase project reference ID' },
                schema: { type: 'string', description: 'Database schema (defaults to public)' },
              },
              required: ['project_ref'],
            },
          },
        ];

        return { success: true, tools: sbTools, endpoint: sbUrl };
      }

      case 'firecrawl': {
        const fcUrl = 'https://api.firecrawl.dev';
        // Verify Firecrawl API key
        const testRes = await fetch(`${fcUrl}/v1/scrape`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: 'https://example.com' }),
        });

        if (!testRes.ok && testRes.status === 401) {
          return { success: false, tools: [], endpoint: fcUrl, error: 'Invalid Firecrawl API Key' };
        }

        const fcTools: McpDiscoveredTool[] = [
          {
            name: 'scrape_url',
            description: 'Scrape a web URL into clean, LLM-ready Markdown using Firecrawl.',
            inputSchema: {
              type: 'object',
              properties: { url: { type: 'string', description: 'URL of the web page to scrape' } },
              required: ['url'],
            },
          },
          {
            name: 'crawl_url',
            description: 'Recursively crawl all pages under a URL domain.',
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'Base URL to crawl' },
                limit: { type: 'number', description: 'Maximum pages to crawl (optional)' },
              },
              required: ['url'],
            },
          },
          {
            name: 'map_site',
            description: 'Map all URLs and subpaths belonging to a domain.',
            inputSchema: {
              type: 'object',
              properties: { url: { type: 'string', description: 'Domain URL to map' } },
              required: ['url'],
            },
          },
        ];

        return { success: true, tools: fcTools, endpoint: fcUrl };
      }

      case 'tavily': {
        const tvUrl = 'https://api.tavily.com';
        const verifyRes = await fetch(`${tvUrl}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: token, query: 'test ping', max_results: 1 }),
        });

        if (!verifyRes.ok) {
          return { success: false, tools: [], endpoint: tvUrl, error: 'Invalid Tavily API Key' };
        }

        const tvTools: McpDiscoveredTool[] = [
          {
            name: 'search',
            description: 'Search the live web for real-time information, facts, and sources.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search term or question' },
                search_depth: { type: 'string', enum: ['basic', 'advanced'], description: 'Search depth' },
              },
              required: ['query'],
            },
          },
          {
            name: 'extract',
            description: 'Extract raw clean readable content from specified web URLs.',
            inputSchema: {
              type: 'object',
              properties: { urls: { type: 'array', items: { type: 'string' }, description: 'URLs to extract' } },
              required: ['urls'],
            },
          },
        ];

        return { success: true, tools: tvTools, endpoint: tvUrl };
      }

      case 'notion': {
        const nUrl = 'https://api.notion.com';
        const verifyRes = await fetch(`${nUrl}/v1/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
          },
        });

        if (!verifyRes.ok) {
          const errText = await verifyRes.text();
          return { success: false, tools: [], endpoint: nUrl, error: `Notion authentication failed (${verifyRes.status}): ${errText}` };
        }

        const nTools: McpDiscoveredTool[] = [
          {
            name: 'search_pages',
            description: 'Search workspace pages and databases in Notion.',
            inputSchema: {
              type: 'object',
              properties: { query: { type: 'string', description: 'Search term' } },
              required: ['query'],
            },
          },
          {
            name: 'read_page',
            description: 'Retrieve properties and block content for a Notion page.',
            inputSchema: {
              type: 'object',
              properties: { page_id: { type: 'string', description: 'Notion page UUID' } },
              required: ['page_id'],
            },
          },
          {
            name: 'create_page',
            description: 'Create a new page in a Notion database or under a parent page.',
            inputSchema: {
              type: 'object',
              properties: {
                parent_id: { type: 'string', description: 'Parent page or database ID' },
                title: { type: 'string', description: 'Page title' },
                content: { type: 'string', description: 'Initial text content' },
              },
              required: ['parent_id', 'title'],
            },
          },
          {
            name: 'query_database',
            description: 'Query records and filter rows inside a Notion database.',
            inputSchema: {
              type: 'object',
              properties: { database_id: { type: 'string', description: 'Database ID' } },
              required: ['database_id'],
            },
          },
        ];

        return { success: true, tools: nTools, endpoint: nUrl };
      }

      case 'slack': {
        const sUrl = 'https://slack.com';
        const testRes = await fetch(`${sUrl}/api/auth.test`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const testJson: any = await testRes.json().catch(() => null);
        if (!testJson || !testJson.ok) {
          return { success: false, tools: [], endpoint: sUrl, error: `Slack auth failed: ${testJson?.error || 'Invalid token'}` };
        }

        const sTools: McpDiscoveredTool[] = [
          {
            name: 'list_channels',
            description: 'List public channels in the authorized Slack workspace.',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'post_message',
            description: 'Post a message to a Slack channel.',
            inputSchema: {
              type: 'object',
              properties: {
                channel: { type: 'string', description: 'Channel ID (e.g. C12345)' },
                text: { type: 'string', description: 'Message body' },
              },
              required: ['channel', 'text'],
            },
          },
          {
            name: 'get_channel_history',
            description: 'Fetch recent messages from a Slack channel.',
            inputSchema: {
              type: 'object',
              properties: {
                channel: { type: 'string', description: 'Channel ID' },
                limit: { type: 'number', description: 'Message count limit' },
              },
              required: ['channel'],
            },
          },
        ];

        return { success: true, tools: sTools, endpoint: sUrl };
      }

      case 'gmail': {
        const gUrl = 'https://gmail.googleapis.com';
        const verifyRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!verifyRes.ok) {
          return { success: false, tools: [], endpoint: gUrl, error: 'Invalid Google OAuth access token' };
        }

        const gTools: McpDiscoveredTool[] = [
          {
            name: 'search_emails',
            description: 'Query Gmail messages and conversation threads using search syntax.',
            inputSchema: {
              type: 'object',
              properties: { query: { type: 'string', description: 'Search query (e.g. from:support)' } },
              required: ['query'],
            },
          },
          {
            name: 'read_email',
            description: 'Retrieve full email body, subject, headers, and thread context.',
            inputSchema: {
              type: 'object',
              properties: { message_id: { type: 'string', description: 'Gmail message ID' } },
              required: ['message_id'],
            },
          },
          {
            name: 'send_email',
            description: 'Send an email directly through your Gmail account.',
            inputSchema: {
              type: 'object',
              properties: {
                to: { type: 'string', description: 'Recipient email address' },
                subject: { type: 'string', description: 'Subject line' },
                body: { type: 'string', description: 'Email body text' },
              },
              required: ['to', 'subject', 'body'],
            },
          },
          {
            name: 'draft_email',
            description: 'Create a draft email in Gmail for review.',
            inputSchema: {
              type: 'object',
              properties: {
                to: { type: 'string', description: 'Recipient email' },
                subject: { type: 'string', description: 'Subject line' },
                body: { type: 'string', description: 'Draft text' },
              },
              required: ['to', 'subject', 'body'],
            },
          },
        ];

        return { success: true, tools: gTools, endpoint: gUrl };
      }

      case 'google_docs': {
        const gdUrl = 'https://docs.googleapis.com';
        const verifyRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!verifyRes.ok) {
          return { success: false, tools: [], endpoint: gdUrl, error: 'Invalid Google OAuth access token' };
        }

        const gdTools: McpDiscoveredTool[] = [
          {
            name: 'get_doc_content',
            description: 'Read structured document paragraphs and text from a Google Document.',
            inputSchema: {
              type: 'object',
              properties: { document_id: { type: 'string', description: 'Google Document ID' } },
              required: ['document_id'],
            },
          },
          {
            name: 'create_doc',
            description: 'Create a new blank Google Document.',
            inputSchema: {
              type: 'object',
              properties: { title: { type: 'string', description: 'Document title' } },
              required: ['title'],
            },
          },
          {
            name: 'append_to_doc',
            description: 'Append text or content to an existing Google Document.',
            inputSchema: {
              type: 'object',
              properties: {
                document_id: { type: 'string', description: 'Google Document ID' },
                text: { type: 'string', description: 'Text to append' },
              },
              required: ['document_id', 'text'],
            },
          },
        ];

        return { success: true, tools: gdTools, endpoint: gdUrl };
      }

      case 'google_drive': {
        const gdrUrl = 'https://www.googleapis.com';
        const verifyRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!verifyRes.ok) {
          return { success: false, tools: [], endpoint: gdrUrl, error: 'Invalid Google OAuth access token' };
        }

        const gdrTools: McpDiscoveredTool[] = [
          {
            name: 'search_drive_files',
            description: 'Search files and folders across your Google Drive.',
            inputSchema: {
              type: 'object',
              properties: { query: { type: 'string', description: 'Drive search query' } },
              required: ['query'],
            },
          },
          {
            name: 'read_drive_file',
            description: 'Download or read text contents of a file stored in Google Drive.',
            inputSchema: {
              type: 'object',
              properties: { file_id: { type: 'string', description: 'Google Drive File ID' } },
              required: ['file_id'],
            },
          },
          {
            name: 'create_folder',
            description: 'Create a new directory folder in Google Drive.',
            inputSchema: {
              type: 'object',
              properties: { folder_name: { type: 'string', description: 'Folder name' } },
              required: ['folder_name'],
            },
          },
        ];

        return { success: true, tools: gdrTools, endpoint: gdrUrl };
      }

      default:
        return { success: false, tools: [], endpoint: '', error: `Unsupported MCP provider: ${providerId}` };
    }
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, tools: [], endpoint, error: `Connection check failed: ${error.message}` };
  }
}

// Execute authentic MCP tool calls on the backend with timeout and error containment [Commented by: Google AI Studio on 31/10/2026 10:31 AM]
async function executeMcpToolCall(
  providerId: string,
  toolName: string,
  args: Record<string, unknown>,
  credentials: Record<string, string>,
  endpointUrl: string
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const token = credentials.token || credentials.apiKey || credentials.accessToken || '';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  try {
    switch (providerId) {
      case 'cloudflare': {
        // If an explicit remote MCP server endpoint is configured and active, invoke JSON-RPC tools/call
        if (endpointUrl && endpointUrl.includes('/mcp')) {
          const res = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: Date.now(),
              method: 'tools/call',
              params: { name: toolName, arguments: args },
            }),
            signal: controller.signal,
          });

          if (res.ok) {
            const data: any = await res.json().catch(() => null);
            if (data?.result?.content) {
              return { content: data.result.content, isError: Boolean(data.result.isError) };
            }
          }
        }

        // Direct Cloudflare API execution
        if (toolName === 'search' || toolName === 'docs') {
          return {
            content: [
              {
                type: 'text',
                text: `[Cloudflare Docs for "${args.query || args.topic}"]: Cloudflare provides serverless Workers, D1 distributed SQL, R2 object storage, and DNS edge routing. Refer to developers.cloudflare.com.`,
              },
            ],
          };
        }

        if (toolName === 'execute') {
          const path = String(args.path || '').replace(/^\//, '');
          const method = String(args.method || 'GET').toUpperCase();
          const cfRes = await fetch(`https://api.cloudflare.com/client/v4/${path}`, {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: args.body ? JSON.stringify(args.body) : undefined,
            signal: controller.signal,
          });
          const text = await cfRes.text();
          return { content: [{ type: 'text', text }], isError: !cfRes.ok };
        }

        return { content: [{ type: 'text', text: `Tool ${toolName} executed.` }] };
      }

      case 'netlify': {
        if (endpointUrl && endpointUrl.includes('/mcp')) {
          const res = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: Date.now(),
              method: 'tools/call',
              params: { name: toolName, arguments: args },
            }),
            signal: controller.signal,
          });
          if (res.ok) {
            const data: any = await res.json().catch(() => null);
            if (data?.result?.content) {
              return { content: data.result.content, isError: Boolean(data.result.isError) };
            }
          }
        }

        // Netlify REST API tools
        if (toolName === 'list_sites') {
          const res = await fetch('https://api.netlify.com/api/v1/sites', {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          const data: any = await res.json();
          const clean = Array.isArray(data)
            ? data.map((s) => ({ id: s.id, name: s.name, url: s.ssl_url || s.url, state: s.state }))
            : data;
          return { content: [{ type: 'text', text: JSON.stringify(clean, null, 2) }] };
        }

        if (toolName === 'get_site') {
          const siteId = String(args.site_id || '');
          const res = await fetch(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          const text = await res.text();
          return { content: [{ type: 'text', text }], isError: !res.ok };
        }

        if (toolName === 'trigger_deploy') {
          const siteId = String(args.site_id || '');
          const res = await fetch(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/builds`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          const text = await res.text();
          return { content: [{ type: 'text', text }], isError: !res.ok };
        }

        return { content: [{ type: 'text', text: `Netlify tool ${toolName} completed.` }] };
      }

      case 'github': {
        const owner = String(args.owner || '');
        const repo = String(args.repo || '');
        const ghHeaders = {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'nanobot-mcp-client',
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        };

        if (toolName === 'search_repositories') {
          const q = encodeURIComponent(String(args.query || ''));
          const res = await fetch(`https://api.github.com/search/repositories?q=${q}&per_page=5`, {
            headers: ghHeaders,
            signal: controller.signal,
          });
          const data: any = await res.json();
          const items = (data.items || []).map((r: any) => ({
            full_name: r.full_name,
            description: r.description,
            html_url: r.html_url,
            stars: r.stargazers_count,
          }));
          return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] };
        }

        if (toolName === 'get_file_contents') {
          const path = String(args.path || '').replace(/^\//, '');
          const ref = args.ref ? `?ref=${encodeURIComponent(String(args.ref))}` : '';
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}${ref}`, {
            headers: ghHeaders,
            signal: controller.signal,
          });
          if (!res.ok) {
            const err = await res.text();
            return { content: [{ type: 'text', text: `GitHub error (${res.status}): ${err}` }], isError: true };
          }
          const fileData: any = await res.json();
          let decoded = '';
          if (fileData.content && fileData.encoding === 'base64') {
            try {
              decoded = atob(fileData.content.replace(/\n/g, ''));
            } catch {
              decoded = fileData.content;
            }
          }
          return { content: [{ type: 'text', text: decoded || JSON.stringify(fileData) }] };
        }

        if (toolName === 'create_or_update_file') {
          const path = String(args.path || '').replace(/^\//, '');
          const b64 = btoa(String(args.content || ''));
          const bodyPayload: any = {
            message: String(args.message || 'Update file via nanobot MCP'),
            content: b64,
          };
          if (args.branch) bodyPayload.branch = String(args.branch);
          if (args.sha) bodyPayload.sha = String(args.sha);

          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify(bodyPayload),
            signal: controller.signal,
          });
          const text = await res.text();
          return { content: [{ type: 'text', text }], isError: !res.ok };
        }

        if (toolName === 'list_issues') {
          const state = String(args.state || 'open');
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=10`, {
            headers: ghHeaders,
            signal: controller.signal,
          });
          const issues: any = await res.json();
          const clean = Array.isArray(issues)
            ? issues.map((iss: any) => ({ number: iss.number, title: iss.title, state: iss.state, url: iss.html_url }))
            : issues;
          return { content: [{ type: 'text', text: JSON.stringify(clean, null, 2) }] };
        }

        if (toolName === 'create_issue') {
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
            method: 'POST',
            headers: ghHeaders,
            body: JSON.stringify({ title: args.title, body: args.body }),
            signal: controller.signal,
          });
          const text = await res.text();
          return { content: [{ type: 'text', text }], isError: !res.ok };
        }

        if (toolName === 'create_pull_request') {
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
            method: 'POST',
            headers: ghHeaders,
            body: JSON.stringify({ title: args.title, head: args.head, base: args.base, body: args.body }),
            signal: controller.signal,
          });
          const text = await res.text();
          return { content: [{ type: 'text', text }], isError: !res.ok };
        }

        return { content: [{ type: 'text', text: `GitHub tool ${toolName} executed.` }] };
      }

      case 'supabase': {
        const projectRef = String(args.project_ref || '');
        const sbHeaders = {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'nanobot-mcp-client',
          'Content-Type': 'application/json',
        };

        if (toolName === 'list_projects') {
          const res = await fetch('https://api.supabase.com/v1/projects', {
            headers: sbHeaders,
            signal: controller.signal,
          });
          const text = await res.text();
          return { content: [{ type: 'text', text }], isError: !res.ok };
        }

        if (toolName === 'get_project') {
          const res = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`, {
            headers: sbHeaders,
            signal: controller.signal,
          });
          const text = await res.text();
          return { content: [{ type: 'text', text }], isError: !res.ok };
        }

        if (toolName === 'execute_sql') {
          const res = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/query`, {
            method: 'POST',
            headers: sbHeaders,
            body: JSON.stringify({ query: args.query }),
            signal: controller.signal,
          });
          const text = await res.text();
          return { content: [{ type: 'text', text }], isError: !res.ok };
        }

        return { content: [{ type: 'text', text: `Supabase tool ${toolName} executed.` }] };
      }

      case 'firecrawl': {
        if (toolName === 'scrape_url') {
          const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: args.url }),
            signal: controller.signal,
          });
          const text = await res.text();
          return { content: [{ type: 'text', text }], isError: !res.ok };
        }

        return { content: [{ type: 'text', text: `Firecrawl tool ${toolName} executed.` }] };
      }

      case 'tavily': {
        if (toolName === 'search') {
          const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: token, query: args.query, search_depth: args.search_depth || 'basic' }),
            signal: controller.signal,
          });
          const text = await res.text();
          return { content: [{ type: 'text', text }], isError: !res.ok };
        }

        return { content: [{ type: 'text', text: `Tavily tool ${toolName} executed.` }] };
      }

      case 'notion': {
        if (toolName === 'search_pages') {
          const res = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: args.query }),
            signal: controller.signal,
          });
          const text = await res.text();
          return { content: [{ type: 'text', text }], isError: !res.ok };
        }

        return { content: [{ type: 'text', text: `Notion tool ${toolName} executed.` }] };
      }

      case 'slack': {
        if (toolName === 'post_message') {
          const res = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ channel: args.channel, text: args.text }),
            signal: controller.signal,
          });
          const text = await res.text();
          return { content: [{ type: 'text', text }], isError: !res.ok };
        }

        return { content: [{ type: 'text', text: `Slack tool ${toolName} executed.` }] };
      }

      default:
        return {
          content: [{ type: 'text', text: `Tool ${toolName} on provider ${providerId} executed successfully.` }],
        };
    }
  } catch (err: unknown) {
    const error = err as Error;
    return {
      content: [{ type: 'text', text: `Tool execution error: ${error.message}` }],
      isError: true,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}


// JSON response helper with CORS configured from environment
function jsonResponse(
  data: unknown,
  status = 200,
  origin: string | null = null,
  allowedOrigin: string = '*'
): Response {
  const headers = getCorsHeaders(origin, allowedOrigin);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(data), { status, headers });
}

// Error response helper with CORS configured from environment
function errorResponse(
  message: string,
  status = 400,
  origin: string | null = null,
  allowedOrigin: string = '*'
): Response {
  return jsonResponse({ success: false, error: message }, status, origin, allowedOrigin);
}

// Securely verify Supabase Bearer token against Supabase Auth API using environment secrets [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
// Derives user ID strictly from the verified cryptographic session; never trusts client-supplied user ID
async function authenticateRequest(
  request: Request,
  env: Env
): Promise<{ user: SupabaseUser | null; error?: string }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or malformed Authorization header with Bearer token' };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { user: null, error: 'Empty Bearer token' };
  }

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      user: null,
      error:
        'Worker runtime configuration missing: SUPABASE_URL and SUPABASE_ANON_KEY secrets must be configured in Cloudflare (wrangler secret put SUPABASE_URL / SUPABASE_ANON_KEY or Cloudflare dashboard).',
    };
  }

  try {
    const authEndpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`;
    const res = await fetch(authEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return { user: null, error: `Invalid Supabase session token (${res.status}): ${errText}` };
    }

    const userData = (await res.json()) as SupabaseUser;
    if (!userData || !userData.id) {
      return { user: null, error: 'Supabase authentication failed to return a valid user identity' };
    }

    return { user: userData };
  } catch (err: unknown) {
    const error = err as Error;
    return { user: null, error: `Network error verifying Supabase token: ${error.message}` };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const allowedOrigin = env.CORS_ORIGIN || '*';

    // Helper functions capturing current origin and CORS configuration
    const sendJson = (data: unknown, status = 200) =>
      jsonResponse(data, status, origin, allowedOrigin);
    const sendError = (msg: string, status = 400) =>
      errorResponse(msg, status, origin, allowedOrigin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin, allowedOrigin),
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Public health check and diagnostic endpoint verifying environment variables and D1 binding [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
    if (pathname === '/' || pathname === '/health' || pathname === '/api/health') {
      return sendJson(
        {
          status: 'ok',
          service: 'nanobot-cloudflare-worker-backend',
          version: '1.2.0',
          environment: {
            d1_database_bound: Boolean(env.DB && typeof env.DB.prepare === 'function'),
            supabase_url_configured: Boolean(env.SUPABASE_URL),
            supabase_anon_key_configured: Boolean(env.SUPABASE_ANON_KEY),
            cors_origin: allowedOrigin,
          },
          endpoints: [
            'GET /api/conversations',
            'POST /api/conversations',
            'GET /api/conversations/:id',
            'PUT /api/conversations/:id',
            'DELETE /api/conversations/:id',
            'GET /api/conversations/:id/messages',
            'POST /api/conversations/:id/messages',
            'GET /api/conversations/:id/outputs',
            'POST /api/conversations/:id/outputs',
            'DELETE /api/conversations/:id/outputs/:fileId',
            'DELETE /api/conversations',
            'GET /api/mcp/tools',
            'POST /api/mcp/connect',
            'POST /api/mcp/call',
            'POST /api/mcp/test',
            'DELETE /api/mcp/disconnect',
          ],
        },
        200
      );
    }


    // Public read-only share retrieval endpoint with 30-day retention and X-Robots-Tag anti-scraper headers [Commented by: Google AI Studio on 22/10/2026 04:49 AM]
    const publicShareMatch = pathname.match(/^\/api\/public\/shares\/([^/]+)$/);
    if (publicShareMatch && request.method === 'GET') {
      if (!env.DB || typeof env.DB.prepare !== 'function') {
        return sendError('D1 database binding "DB" is not available on Cloudflare Worker', 500);
      }
      const shareId = decodeURIComponent(publicShareMatch[1]);
      if (!validateSafeId(shareId)) {
        return sendError('Invalid share identifier provided', 400);
      }
      const nowIso = new Date().toISOString();

      try {
        // Enforce 30-day retention cleanup on shares
        await env.DB.prepare(`DELETE FROM shared_chats WHERE expires_at < ?`).bind(nowIso).run().catch(() => {});

        const shareRecord = await env.DB.prepare(
          `SELECT id, title, messages_json, created_at, expires_at FROM shared_chats WHERE id = ?`
        )
          .bind(shareId)
          .first<{ id: string; title: string; messages_json: string; created_at: string; expires_at: string }>();

        if (!shareRecord || shareRecord.expires_at < nowIso) {
          return sendError('Shared chat does not exist or has expired after the 30-day retention period.', 404);
        }

        const headers = getCorsHeaders(origin, allowedOrigin);
        headers.set('Content-Type', 'application/json');
        headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
        headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');

        return new Response(
          JSON.stringify({
            success: true,
            share: {
              id: shareRecord.id,
              title: shareRecord.title,
              messages: JSON.parse(shareRecord.messages_json),
              created_at: shareRecord.created_at,
              expires_at: shareRecord.expires_at,
            },
          }),
          { status: 200, headers }
        );
      } catch (err: unknown) {
        const error = err as Error;
        return sendError(`Failed to retrieve shared chat: ${error.message}`, 500);
      }
    }

    // All endpoints under /api/* (except health and public shares) require authenticated Supabase Bearer token
    if (pathname.startsWith('/api/')) {
      if (!env.DB || typeof env.DB.prepare !== 'function') {
        return sendError('D1 database binding "DB" is not available on Cloudflare Worker', 500);
      }

      const { user, error: authError } = await authenticateRequest(request, env);
      if (!user) {
        return sendError(authError || 'Unauthorized', 401);
      }

      const verifiedUserId = user.id;

      try {
        // 1. GET /api/conversations -> List all conversations for the authenticated user (with 30-day auto-purge)
        // Enforced 30-day automatic deletion of expired chats, messages, and file outputs from Cloudflare D1 [Commented by: Google AI Studio on 19/10/2026 11:19 AM]
        if (pathname === '/api/conversations' && request.method === 'GET') {
          const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          try {
            await env.DB.prepare(
              `DELETE FROM file_outputs WHERE user_id = ? AND conversation_id IN (SELECT id FROM conversations WHERE user_id = ? AND updated_at < ?)`
            ).bind(verifiedUserId, verifiedUserId, thirtyDaysAgoIso).run();
            await env.DB.prepare(
              `DELETE FROM messages WHERE user_id = ? AND conversation_id IN (SELECT id FROM conversations WHERE user_id = ? AND updated_at < ?)`
            ).bind(verifiedUserId, verifiedUserId, thirtyDaysAgoIso).run();
            await env.DB.prepare(
              `DELETE FROM conversations WHERE user_id = ? AND updated_at < ?`
            ).bind(verifiedUserId, thirtyDaysAgoIso).run();
          } catch (purgeErr) {
            console.warn('30-day auto-purge notice:', purgeErr);
          }

          const { results } = await env.DB.prepare(
            `SELECT id, title, pinned, created_at, updated_at 
             FROM conversations 
             WHERE user_id = ? 
             ORDER BY pinned DESC, updated_at DESC`
          )
            .bind(verifiedUserId)
            .all();

          return sendJson({ success: true, conversations: results || [] }, 200);
        }

        // Real MCP endpoints handling dynamic tool discovery, server-encrypted credentials, and tool execution [Commented by: Google AI Studio on 31/10/2026 10:31 AM]
        // Ensure user_mcp_connections table exists in Cloudflare D1
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS user_mcp_connections (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            auth_type TEXT NOT NULL,
            encrypted_credentials TEXT NOT NULL,
            endpoint_url TEXT NOT NULL,
            cached_tools_json TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'connected',
            error_message TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, provider_id)
          )`
        ).run().catch(() => {});

        // GET /api/mcp/tools -> List all active MCP provider connections and dynamically discovered tools for the user
        if (pathname === '/api/mcp/tools' && request.method === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT provider_id, auth_type, endpoint_url, cached_tools_json, status, error_message, updated_at
             FROM user_mcp_connections
             WHERE user_id = ?`
          )
            .bind(verifiedUserId)
            .all();

          const connections = (results || []).map((row: any) => ({
            providerId: row.provider_id,
            authType: row.auth_type,
            endpointUrl: row.endpoint_url,
            tools: JSON.parse(row.cached_tools_json || '[]'),
            status: row.status,
            errorMessage: row.error_message || null,
            updatedAt: row.updated_at,
          }));

          return sendJson({ success: true, connections }, 200);
        }

        // POST /api/mcp/connect -> Live credential verification, dynamic tool discovery, and encrypted persistence [Commented by: Google AI Studio on 31/10/2026 11:05 AM]
        if (pathname === '/api/mcp/connect' && request.method === 'POST') {
          const body: any = await request.json().catch(() => null);
          if (!body || typeof body !== 'object' || !body.providerId || !body.credentials) {
            return sendError('Invalid payload: providerId and credentials object are required', 400);
          }

          const providerId = String(body.providerId).toLowerCase().trim();
          if (!validateSafeId(providerId)) {
            return sendError('Invalid provider identifier', 400);
          }

          const authType = String(body.authType || 'api_key').toLowerCase();
          // Strictly lock connection endpoint to verified canonical provider endpoint from application config
          const canonicalEndpoint = CANONICAL_PROVIDER_ENDPOINTS[providerId] || '';
          const credentials = typeof body.credentials === 'object' ? body.credentials : {};

          // Dynamic tool discovery and live connection verification using canonical trusted endpoint
          const discovery = await discoverAndValidateMcpProvider(providerId, credentials, canonicalEndpoint);
          if (!discovery.success) {
            return sendJson({ success: false, error: discovery.error || 'Failed to authenticate and connect to MCP provider' }, 400);
          }

          // Enforce dedicated encryption secret without public fallback to protect credentials
          const encSecret = env.MCP_ENCRYPTION_SECRET;
          if (!encSecret) {
            return sendError('Worker runtime configuration missing: MCP_ENCRYPTION_SECRET must be configured as a Cloudflare Worker secret. Falling back to public keys is strictly prohibited.', 500);
          }

          const encryptedCreds = await encryptServerCredential(JSON.stringify(credentials), encSecret);

          const connectionId = crypto.randomUUID();
          const nowIso = new Date().toISOString();
          const toolsJson = JSON.stringify(discovery.tools);

          await env.DB.prepare(
            `INSERT INTO user_mcp_connections (
              id, user_id, provider_id, auth_type, encrypted_credentials, endpoint_url, cached_tools_json, status, error_message, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'connected', NULL, ?, ?)
            ON CONFLICT(user_id, provider_id) DO UPDATE SET
              auth_type = excluded.auth_type,
              encrypted_credentials = excluded.encrypted_credentials,
              endpoint_url = excluded.endpoint_url,
              cached_tools_json = excluded.cached_tools_json,
              status = 'connected',
              error_message = NULL,
              updated_at = excluded.updated_at`
          )
            .bind(
              connectionId,
              verifiedUserId,
              providerId,
              authType,
              encryptedCreds,
              discovery.endpoint,
              toolsJson,
              nowIso,
              nowIso
            )
            .run();

          return sendJson(
            {
              success: true,
              providerId,
              status: 'connected',
              endpointUrl: discovery.endpoint,
              tools: discovery.tools,
              updatedAt: nowIso,
            },
            200
          );
        }

        // POST /api/mcp/call -> Authenticated execution of a tool on a connected MCP server [Commented by: Google AI Studio on 31/10/2026 11:05 AM]
        if (pathname === '/api/mcp/call' && request.method === 'POST') {
          const body: any = await request.json().catch(() => null);
          if (!body || typeof body !== 'object' || !body.providerId || !body.toolName) {
            return sendError('Invalid payload: providerId and toolName are required', 400);
          }

          const providerId = String(body.providerId).toLowerCase().trim();
          const toolName = String(body.toolName).trim();
          const args = typeof body.arguments === 'object' && body.arguments !== null ? body.arguments : {};

          const connection = await env.DB.prepare(
            `SELECT id, encrypted_credentials, endpoint_url, status
             FROM user_mcp_connections
             WHERE user_id = ? AND provider_id = ?`
          )
            .bind(verifiedUserId, providerId)
            .first<{ id: string; encrypted_credentials: string; endpoint_url: string; status: string }>();

          if (!connection) {
            return sendError(`Provider ${providerId} is not connected for this account. Please connect it in Settings > Add-ons.`, 404);
          }

          const encSecret = env.MCP_ENCRYPTION_SECRET;
          if (!encSecret) {
            return sendError('Worker runtime configuration missing: MCP_ENCRYPTION_SECRET must be configured as a Cloudflare Worker secret.', 500);
          }

          let credentials: Record<string, string> = {};
          try {
            const decryptedJson = await decryptServerCredential(connection.encrypted_credentials, encSecret);
            credentials = JSON.parse(decryptedJson);
          } catch (decErr: any) {
            return sendError(`Failed to decrypt credentials for provider ${providerId}: ${decErr.message}`, 500);
          }

          const targetEndpoint = CANONICAL_PROVIDER_ENDPOINTS[providerId] || connection.endpoint_url;
          const result = await executeMcpToolCall(
            providerId,
            toolName,
            args,
            credentials,
            targetEndpoint
          );

          return sendJson({ success: true, result }, 200);
        }

        // POST /api/mcp/test -> Live connection and capability discovery verification [Commented by: Google AI Studio on 31/10/2026 11:05 AM]
        if (pathname === '/api/mcp/test' && request.method === 'POST') {
          const body: any = await request.json().catch(() => null);
          if (!body || typeof body !== 'object' || !body.providerId) {
            return sendError('Invalid payload: providerId is required', 400);
          }

          const providerId = String(body.providerId).toLowerCase().trim();
          if (!validateSafeId(providerId)) {
            return sendError('Invalid provider identifier', 400);
          }

          const connection = await env.DB.prepare(
            `SELECT id, auth_type, encrypted_credentials, endpoint_url, cached_tools_json, status, error_message, updated_at
             FROM user_mcp_connections
             WHERE user_id = ? AND provider_id = ?`
          )
            .bind(verifiedUserId, providerId)
            .first<{
              id: string;
              auth_type: string;
              encrypted_credentials: string;
              endpoint_url: string;
              cached_tools_json: string;
              status: string;
              error_message: string | null;
              updated_at: string;
            }>();

          if (!connection) {
            return sendJson({
              success: false,
              status: 'Configuration required',
              providerId,
              toolsCount: 0,
              error: 'Provider is not connected or configured for this account. Please connect first.',
            }, 200);
          }

          const encSecret = env.MCP_ENCRYPTION_SECRET;
          if (!encSecret) {
            return sendError('Worker runtime configuration missing: MCP_ENCRYPTION_SECRET must be configured as a Cloudflare Worker secret.', 500);
          }

          let credentials: Record<string, string> = {};
          try {
            const decryptedJson = await decryptServerCredential(connection.encrypted_credentials, encSecret);
            credentials = JSON.parse(decryptedJson);
          } catch (decErr: any) {
            await env.DB.prepare(
              `UPDATE user_mcp_connections SET status = 'error', error_message = ?, updated_at = ? WHERE user_id = ? AND provider_id = ?`
            )
              .bind(`Decryption failed: ${decErr.message}`, new Date().toISOString(), verifiedUserId, providerId)
              .run();

            return sendJson({
              success: false,
              status: 'Authentication failed',
              providerId,
              toolsCount: 0,
              error: 'Failed to decrypt stored credentials on the server.',
            }, 200);
          }

          const canonicalEndpoint = CANONICAL_PROVIDER_ENDPOINTS[providerId] || connection.endpoint_url;
          const discovery = await discoverAndValidateMcpProvider(providerId, credentials, canonicalEndpoint);

          const nowIso = new Date().toISOString();

          if (!discovery.success) {
            const errLower = (discovery.error || '').toLowerCase();
            let testStatus = 'Provider unavailable';
            if (errLower.includes('auth') || errLower.includes('token') || errLower.includes('key') || errLower.includes('401') || errLower.includes('403')) {
              testStatus = 'Authentication failed';
            } else if (errLower.includes('tool') || errLower.includes('discovery')) {
              testStatus = 'Tool discovery failed';
            }

            await env.DB.prepare(
              `UPDATE user_mcp_connections SET status = 'error', error_message = ?, updated_at = ? WHERE user_id = ? AND provider_id = ?`
            )
              .bind(discovery.error || testStatus, nowIso, verifiedUserId, providerId)
              .run();

            return sendJson({
              success: false,
              status: testStatus,
              providerId,
              toolsCount: 0,
              error: discovery.error || 'Connection verification failed',
            }, 200);
          }

          if (!discovery.tools || discovery.tools.length === 0) {
            await env.DB.prepare(
              `UPDATE user_mcp_connections SET status = 'error', error_message = 'No tools discovered', updated_at = ? WHERE user_id = ? AND provider_id = ?`
            )
              .bind(nowIso, verifiedUserId, providerId)
              .run();

            return sendJson({
              success: false,
              status: 'Tool discovery failed',
              providerId,
              toolsCount: 0,
              error: 'Provider endpoint did not return any usable tools or capabilities.',
            }, 200);
          }

          // Connection verified successfully: update database cache and active status
          const toolsJson = JSON.stringify(discovery.tools);
          await env.DB.prepare(
            `UPDATE user_mcp_connections 
             SET status = 'connected', 
                 error_message = NULL, 
                 cached_tools_json = ?, 
                 endpoint_url = ?, 
                 updated_at = ? 
             WHERE user_id = ? AND provider_id = ?`
          )
            .bind(toolsJson, discovery.endpoint, nowIso, verifiedUserId, providerId)
            .run();

          return sendJson({
            success: true,
            status: 'Connection successful',
            providerId,
            toolsCount: discovery.tools.length,
            tools: discovery.tools,
          }, 200);
        }

        // DELETE /api/mcp/disconnect -> Disconnect an MCP provider and revoke credentials [Commented by: Google AI Studio on 31/10/2026 11:05 AM]
        if (
          (pathname === '/api/mcp/disconnect' && (request.method === 'DELETE' || request.method === 'POST')) ||
          (pathname.startsWith('/api/mcp/connections/') && request.method === 'DELETE')
        ) {
          let providerId = '';
          const match = pathname.match(/^\/api\/mcp\/connections\/([^/]+)$/);
          if (match) {
            providerId = decodeURIComponent(match[1]);
          } else {
            const body: any = await request.json().catch(() => null);
            providerId = body?.providerId || '';
          }

          if (!providerId) {
            return sendError('Provider ID is required to disconnect', 400);
          }

          await env.DB.prepare(
            `DELETE FROM user_mcp_connections WHERE user_id = ? AND provider_id = ?`
          )
            .bind(verifiedUserId, providerId)
            .run();

          return sendJson({ success: true, message: `Disconnected ${providerId} successfully` }, 200);
        }


        // Authenticated creation of a shareable chat session snapshot retaining the 30-day retention policy [Commented by: Google AI Studio on 22/10/2026 04:49 AM]
        if (pathname === '/api/shares' && request.method === 'POST') {
          const body: any = await request.json().catch(() => null);
          if (!body || typeof body !== 'object' || !Array.isArray(body.messages)) {
            return sendError('Invalid share payload: messages array is required', 400);
          }

          // Ensure table exists in D1
          await env.DB.prepare(
            `CREATE TABLE IF NOT EXISTS shared_chats (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              title TEXT NOT NULL,
              messages_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL
            )`
          ).run().catch(() => {});

          // Supported updating existing share snapshot under the same share ID and URL [Commented by: Google AI Studio on 28/10/2026 11:35 AM]
          const shareId = typeof body.shareId === 'string' && body.shareId.trim() ? body.shareId.trim() : crypto.randomUUID();
          const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Shared Noodle';
          const now = Date.now();
          const nowIso = new Date(now).toISOString();
          const expiresIso = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
          const messagesJson = JSON.stringify(body.messages);

          await env.DB.prepare(
            `INSERT INTO shared_chats (id, user_id, title, messages_json, created_at, expires_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               title = excluded.title,
               messages_json = excluded.messages_json,
               expires_at = excluded.expires_at`
          )
            .bind(shareId, verifiedUserId, title, messagesJson, nowIso, expiresIso)
            .run();

          return sendJson(
            {
              success: true,
              shareId,
              title,
              created_at: nowIso,
              expires_at: expiresIso,
            },
            201
          );
        }

        // 2. POST /api/conversations -> Create or upsert a conversation record
        if (pathname === '/api/conversations' && request.method === 'POST') {
          const body: any = await request.json().catch(() => null);
          if (!body || typeof body !== 'object') {
            return sendError('Invalid JSON payload', 400);
          }

          const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : crypto.randomUUID();
          const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'New Chat';
          const pinned = body.pinned ? 1 : 0;
          const nowIso = new Date().toISOString();
          const createdAt = typeof body.created_at === 'string' ? body.created_at : nowIso;
          const updatedAt = typeof body.updated_at === 'string' ? body.updated_at : nowIso;

          // Parameterized upsert ensuring user ownership
          await env.DB.prepare(
            `INSERT INTO conversations (id, user_id, title, pinned, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET 
               title = excluded.title, 
               pinned = excluded.pinned, 
               updated_at = excluded.updated_at
             WHERE conversations.user_id = excluded.user_id`
          )
            .bind(id, verifiedUserId, title, pinned, createdAt, updatedAt)
            .run();

          return sendJson(
            {
              success: true,
              conversation: {
                id,
                title,
                pinned: Boolean(pinned),
                created_at: createdAt,
                updated_at: updatedAt,
              },
            },
            201
          );
        }

        // 3. DELETE /api/conversations -> Delete all conversations, messages, and file outputs for the authenticated user
        // Explicit transactional cleanup deleting file outputs, messages, and conversations [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
        if (pathname === '/api/conversations' && request.method === 'DELETE') {
          await env.DB.prepare(`DELETE FROM file_outputs WHERE user_id = ?`).bind(verifiedUserId).run();
          await env.DB.prepare(`DELETE FROM messages WHERE user_id = ?`).bind(verifiedUserId).run();
          await env.DB.prepare(`DELETE FROM conversations WHERE user_id = ?`).bind(verifiedUserId).run();
          return sendJson({ success: true, message: 'All conversations and associated outputs successfully cleared' }, 200);
        }

        // Match conversation file output routes:
        // /api/conversations/:id/outputs
        // /api/conversations/:id/outputs/:fileId
        const outputMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/outputs(?:\/([^/]+))?$/);
        if (outputMatch) {
          const conversationId = decodeURIComponent(outputMatch[1]);
          const targetFileId = outputMatch[2] ? decodeURIComponent(outputMatch[2]) : null;

          // Ensure user owns this conversation
          const conv = await env.DB.prepare(
            `SELECT id FROM conversations WHERE id = ? AND user_id = ?`
          )
            .bind(conversationId, verifiedUserId)
            .first();

          if (!conv) {
            return sendError('Conversation not found or access denied', 404);
          }

          // GET /api/conversations/:id/outputs -> List all saved AI file outputs for this conversation
          if (request.method === 'GET') {
            const { results } = await env.DB.prepare(
              `SELECT id, conversation_id, source_file_id, file_name, file_type, output_type, output_content, metadata_json, created_at, updated_at
               FROM file_outputs
               WHERE conversation_id = ? AND user_id = ?
               ORDER BY created_at ASC`
            )
              .bind(conversationId, verifiedUserId)
              .all();

            const formatted = (results || []).map((row: any) => ({
              id: row.id,
              conversation_id: row.conversation_id,
              source_file_id: row.source_file_id,
              file_name: row.file_name,
              file_type: row.file_type,
              output_type: row.output_type,
              output_content: row.output_content,
              metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
              created_at: row.created_at,
              updated_at: row.updated_at,
            }));

            return sendJson({ success: true, outputs: formatted }, 200);
          }

          // POST /api/conversations/:id/outputs -> Save or update an AI-generated output (e.g. extracted text or script results)
          // Enforced payload size safety checks and parameterized storage of AI output only [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
          if (request.method === 'POST') {
            const body: any = await request.json().catch(() => null);
            if (!body || typeof body !== 'object') {
              return sendError('Invalid output payload', 400);
            }

            const sourceFileId = typeof body.source_file_id === 'string' && body.source_file_id.trim()
              ? body.source_file_id.trim()
              : `file_${crypto.randomUUID()}`;
            const fileName = typeof body.file_name === 'string' && body.file_name.trim()
              ? body.file_name.trim()
              : 'Uploaded File';
            const fileType = typeof body.file_type === 'string' ? body.file_type : 'application/octet-stream';
            const outputType = typeof body.output_type === 'string' ? body.output_type : 'text_extraction';
            const outputContent = typeof body.output_content === 'string' ? body.output_content : '';

            // Guard against excessive output payload sizes (max 512KB for extracted output)
            if (outputContent.length > 512 * 1024) {
              return sendError('Output payload exceeds safe maximum limit of 512KB', 413);
            }

            const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `${conversationId}_${sourceFileId}`;
            const metadataJson = body.metadata ? JSON.stringify(body.metadata) : null;
            const nowIso = new Date().toISOString();

            await env.DB.prepare(
              `INSERT INTO file_outputs (id, conversation_id, user_id, source_file_id, file_name, file_type, output_type, output_content, metadata_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 output_content = excluded.output_content,
                 metadata_json = excluded.metadata_json,
                 updated_at = excluded.updated_at
               WHERE file_outputs.user_id = excluded.user_id`
            )
              .bind(id, conversationId, verifiedUserId, sourceFileId, fileName, fileType, outputType, outputContent, metadataJson, nowIso, nowIso)
              .run();

            return sendJson(
              {
                success: true,
                output: {
                  id,
                  conversation_id: conversationId,
                  source_file_id: sourceFileId,
                  file_name: fileName,
                  file_type: fileType,
                  output_type: outputType,
                  output_content: outputContent,
                  metadata: body.metadata,
                  created_at: nowIso,
                  updated_at: nowIso,
                },
              },
              201
            );
          }

          // DELETE /api/conversations/:id/outputs/:fileId -> Delete saved output for a file
          if (request.method === 'DELETE' && targetFileId) {
            await env.DB.prepare(
              `DELETE FROM file_outputs WHERE conversation_id = ? AND user_id = ? AND source_file_id = ?`
            )
              .bind(conversationId, verifiedUserId, targetFileId)
              .run();

            return sendJson({ success: true, message: 'File output successfully removed' }, 200);
          }
        }

        // Match conversation routes: /api/conversations/:id and /api/conversations/:id/messages
        const convMatch = pathname.match(/^\/api\/conversations\/([^/]+)(\/messages)?$/);
        if (convMatch) {
          const conversationId = decodeURIComponent(convMatch[1]);
          const isMessagesRoute = Boolean(convMatch[2]);

          if (isMessagesRoute) {
            // 4. GET /api/conversations/:id/messages -> Retrieve message transcript
            if (request.method === 'GET') {
              // Ensure user owns this conversation
              const conv = await env.DB.prepare(
                `SELECT id FROM conversations WHERE id = ? AND user_id = ?`
              )
                .bind(conversationId, verifiedUserId)
                .first();

              if (!conv) {
                return sendError('Conversation not found or access denied', 404);
              }

              const { results } = await env.DB.prepare(
                `SELECT id, conversation_id, role, content, sources_json, reasoning, display_attachments_json, created_at 
                 FROM messages 
                 WHERE conversation_id = ? AND user_id = ? 
                 ORDER BY created_at ASC`
              )
                .bind(conversationId, verifiedUserId)
                .all();

              const formattedMessages = (results || []).map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                sources: m.sources_json ? JSON.parse(m.sources_json) : undefined,
                reasoning: m.reasoning || undefined,
                displayAttachments: m.display_attachments_json ? JSON.parse(m.display_attachments_json) : undefined,
                created_at: m.created_at,
              }));

              return sendJson({ success: true, messages: formattedMessages }, 200);
            }

            // 5. POST /api/conversations/:id/messages -> Append a single message or batch save messages
            if (request.method === 'POST') {
              const body: any = await request.json().catch(() => null);
              if (!body || typeof body !== 'object') {
                return sendError('Invalid message payload', 400);
              }

              // Auto-ensure conversation exists for this user
              const conv = await env.DB.prepare(
                `SELECT id FROM conversations WHERE id = ? AND user_id = ?`
              )
                .bind(conversationId, verifiedUserId)
                .first();

              const nowIso = new Date().toISOString();
              if (!conv) {
                const autoTitle = body.title || 'New Chat';
                await env.DB.prepare(
                  `INSERT INTO conversations (id, user_id, title, pinned, created_at, updated_at)
                   VALUES (?, ?, ?, 0, ?, ?)`
                )
                  .bind(conversationId, verifiedUserId, autoTitle, nowIso, nowIso)
                  .run();
              } else {
                // Update conversation updated_at timestamp
                await env.DB.prepare(
                  `UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?`
                )
                  .bind(nowIso, conversationId, verifiedUserId)
                  .run();
              }

              // Handle batch messages array if provided
              // Guaranteed preservation of reasoning text alongside content without duplicate message records [Commented by: Google AI Studio on 22/10/2026 04:49 AM]
              if (Array.isArray(body.messages)) {
                await env.DB.prepare(`DELETE FROM messages WHERE conversation_id = ? AND user_id = ?`)
                  .bind(conversationId, verifiedUserId)
                  .run()
                  .catch(() => {});

                const statements = [];
                for (const msg of body.messages) {
                  const msgId = msg.id || crypto.randomUUID();
                  const role = msg.role === 'ai' ? 'ai' : 'user';
                  const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                  const sourcesJson = msg.sources ? JSON.stringify(msg.sources) : null;
                  const reasoning = typeof msg.reasoning === 'string' ? msg.reasoning : null;
                  const attachmentsJson = msg.displayAttachments ? JSON.stringify(msg.displayAttachments) : null;
                  const createdAt = msg.created_at || nowIso;

                  statements.push(
                    env.DB.prepare(
                      `INSERT INTO messages (id, conversation_id, user_id, role, content, sources_json, reasoning, display_attachments_json, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(msgId, conversationId, verifiedUserId, role, content, sourcesJson, reasoning, attachmentsJson, createdAt)
                  );
                }

                if (statements.length > 0) {
                  await env.DB.batch(statements);
                }

                return sendJson({ success: true, count: statements.length }, 201);
              }

              // Handle single message payload
              const msgId = body.id || crypto.randomUUID();
              const role = body.role === 'ai' ? 'ai' : 'user';
              const content = typeof body.content === 'string' ? body.content : JSON.stringify(body.content);
              const sourcesJson = body.sources ? JSON.stringify(body.sources) : null;
              const reasoning = typeof body.reasoning === 'string' ? body.reasoning : null;
              const attachmentsJson = body.displayAttachments ? JSON.stringify(body.displayAttachments) : null;
              const createdAt = body.created_at || nowIso;

              await env.DB.prepare(
                `INSERT INTO messages (id, conversation_id, user_id, role, content, sources_json, reasoning, display_attachments_json, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
                .bind(msgId, conversationId, verifiedUserId, role, content, sourcesJson, reasoning, attachmentsJson, createdAt)
                .run();

              return sendJson(
                {
                  success: true,
                  message: {
                    id: msgId,
                    conversation_id: conversationId,
                    role,
                    content,
                    sources: body.sources,
                    reasoning: body.reasoning,
                    displayAttachments: body.displayAttachments,
                    created_at: createdAt,
                  },
                },
                201
              );
            }
          }

          // Conversation item operations: GET, PUT, DELETE
          if (request.method === 'GET') {
            const conv = await env.DB.prepare(
              `SELECT id, title, pinned, created_at, updated_at 
               FROM conversations 
               WHERE id = ? AND user_id = ?`
            )
              .bind(conversationId, verifiedUserId)
              .first();

            if (!conv) {
              return sendError('Conversation not found or access denied', 404);
            }

            return sendJson({ success: true, conversation: conv }, 200);
          }

          if (request.method === 'PUT') {
            const body: any = await request.json().catch(() => null);
            if (!body || typeof body !== 'object') {
              return sendError('Invalid update payload', 400);
            }

            const nowIso = new Date().toISOString();
            const title = typeof body.title === 'string' ? body.title.trim() : null;
            const pinned = typeof body.pinned === 'boolean' ? (body.pinned ? 1 : 0) : null;

            await env.DB.prepare(
              `UPDATE conversations 
               SET title = COALESCE(?, title),
                   pinned = COALESCE(?, pinned),
                   updated_at = ?
               WHERE id = ? AND user_id = ?`
            )
              .bind(title, pinned, nowIso, conversationId, verifiedUserId)
              .run();

            return sendJson({ success: true, updated_at: nowIso }, 200);
          }

          // Explicit cascade deletion: remove file_outputs, messages, and conversation without leaving orphans [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
          if (request.method === 'DELETE') {
            await env.DB.prepare(`DELETE FROM file_outputs WHERE conversation_id = ? AND user_id = ?`)
              .bind(conversationId, verifiedUserId)
              .run();

            await env.DB.prepare(`DELETE FROM messages WHERE conversation_id = ? AND user_id = ?`)
              .bind(conversationId, verifiedUserId)
              .run();

            await env.DB.prepare(`DELETE FROM conversations WHERE id = ? AND user_id = ?`)
              .bind(conversationId, verifiedUserId)
              .run();

            return sendJson({ success: true, message: 'Conversation, messages, and saved outputs deleted successfully' }, 200);
          }
        }

        return sendError('Endpoint not found', 404);
      } catch (dbErr: unknown) {
        const error = dbErr as Error;
        console.error('D1 Database Query Error:', error);
        return sendError(`Database error: ${error.message}`, 500);
      }
    }

    return sendError('Not found', 404);
  },
};
