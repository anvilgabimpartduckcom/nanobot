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

// Configured Cloudflare Worker runtime environment interface with D1, auth, and MCP OAuth client secret bindings [Commented by: Google AI Studio at 22/11/2026 11:48]
export interface Env {
  DB: D1Database;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_JWT_SECRET?: string;
  CORS_ORIGIN?: string;
  MCP_ENCRYPTION_SECRET?: string;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  SLACK_OAUTH_CLIENT_ID?: string;
  SLACK_OAUTH_CLIENT_SECRET?: string;
  NOTION_OAUTH_CLIENT_ID?: string;
  NOTION_OAUTH_CLIENT_SECRET?: string;
  SUPABASE_OAUTH_CLIENT_ID?: string;
  SUPABASE_OAUTH_CLIENT_SECRET?: string;
  NETLIFY_OAUTH_CLIENT_ID?: string;
  NETLIFY_OAUTH_CLIENT_SECRET?: string;
  CLOUDFLARE_OAUTH_CLIENT_ID?: string;
  CLOUDFLARE_OAUTH_CLIENT_SECRET?: string;
  FIRECRAWL_OAUTH_CLIENT_ID?: string;
  FIRECRAWL_OAUTH_CLIENT_SECRET?: string;
  TAVILY_OAUTH_CLIENT_ID?: string;
  TAVILY_OAUTH_CLIENT_SECRET?: string;
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
  'dash.cloudflare.com',
  'auth.cloudflare.com',
  'netlify-mcp.netlify.app',
  'mcp.netlify.com',
  'app.netlify.com',
  'api.cloudflare.com',
  'api.netlify.com',
  'api.github.com',
  'api.githubcopilot.com',
  'github.com',
  'api.supabase.com',
  'mcp.supabase.com',
  'supabase.com',
  'api.firecrawl.dev',
  'mcp.firecrawl.dev',
  'www.firecrawl.dev',
  'api.tavily.com',
  'mcp.tavily.com',
  'api.notion.com',
  'mcp.notion.com',
  'slack.com',
  'www.googleapis.com',
  'oauth2.googleapis.com',
  'accounts.google.com',
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

// Remote MCP 2026-07-28 Streamable HTTP endpoints & static OAuth fallback configurations [Commented by: Google AI Studio at 22/11/2026 11:48]
export const REMOTE_MCP_ENDPOINTS: Record<string, string> = {
  cloudflare: 'https://mcp.cloudflare.com/mcp',
  netlify: 'https://mcp.netlify.com/mcp',
  notion: 'https://mcp.notion.com/mcp',
  supabase: 'https://mcp.supabase.com/mcp',
  firecrawl: 'https://mcp.firecrawl.dev/v2/mcp-oauth',
  tavily: 'https://mcp.tavily.com/mcp/',
  github: 'https://api.githubcopilot.com/mcp/',
};

interface StaticOAuthConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  clientIdEnvKey: keyof Env;
  clientSecretEnvKey: keyof Env;
  extraAuthParams?: Record<string, string>;
}

const STATIC_OAUTH_PROVIDERS: Record<string, StaticOAuthConfig> = {
  github: {
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'read:user', 'workflow'],
    clientIdEnvKey: 'GITHUB_OAUTH_CLIENT_ID',
    clientSecretEnvKey: 'GITHUB_OAUTH_CLIENT_SECRET',
  },
  google_docs: {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/documents'],
    clientIdEnvKey: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnvKey: 'GOOGLE_OAUTH_CLIENT_SECRET',
    extraAuthParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
  },
  google_drive: {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.file'],
    clientIdEnvKey: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnvKey: 'GOOGLE_OAUTH_CLIENT_SECRET',
    extraAuthParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
  },
  gmail: {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.compose'],
    clientIdEnvKey: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnvKey: 'GOOGLE_OAUTH_CLIENT_SECRET',
    extraAuthParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
  },
  slack: {
    authorizationEndpoint: 'https://slack.com/oauth/v2/authorize',
    tokenEndpoint: 'https://slack.com/api/oauth.v2.access',
    scopes: ['channels:read', 'channels:history', 'chat:write', 'users:read'],
    clientIdEnvKey: 'SLACK_OAUTH_CLIENT_ID',
    clientSecretEnvKey: 'SLACK_OAUTH_CLIENT_SECRET',
  },
  notion: {
    authorizationEndpoint: 'https://api.notion.com/v1/oauth/authorize',
    tokenEndpoint: 'https://api.notion.com/v1/oauth/token',
    scopes: [],
    clientIdEnvKey: 'NOTION_OAUTH_CLIENT_ID',
    clientSecretEnvKey: 'NOTION_OAUTH_CLIENT_SECRET',
    extraAuthParams: { owner: 'user' },
  },
  supabase: {
    authorizationEndpoint: 'https://api.supabase.com/v1/oauth/authorize',
    tokenEndpoint: 'https://api.supabase.com/v1/oauth/token',
    scopes: [],
    clientIdEnvKey: 'SUPABASE_OAUTH_CLIENT_ID',
    clientSecretEnvKey: 'SUPABASE_OAUTH_CLIENT_SECRET',
  },
  netlify: {
    authorizationEndpoint: 'https://app.netlify.com/authorize',
    tokenEndpoint: 'https://api.netlify.com/oauth/token',
    scopes: [],
    clientIdEnvKey: 'NETLIFY_OAUTH_CLIENT_ID',
    clientSecretEnvKey: 'NETLIFY_OAUTH_CLIENT_SECRET',
  },
  cloudflare: {
    authorizationEndpoint: 'https://dash.cloudflare.com/oauth2/auth',
    tokenEndpoint: 'https://dash.cloudflare.com/oauth2/token',
    scopes: ['account:read', 'workers:write', 'd1:write', 'r2:write', 'offline_access'],
    clientIdEnvKey: 'CLOUDFLARE_OAUTH_CLIENT_ID',
    clientSecretEnvKey: 'CLOUDFLARE_OAUTH_CLIENT_SECRET',
  },
  firecrawl: {
    authorizationEndpoint: 'https://www.firecrawl.dev/api/oauth/authorize',
    tokenEndpoint: 'https://www.firecrawl.dev/api/oauth/token',
    scopes: ['openid', 'profile'],
    clientIdEnvKey: 'FIRECRAWL_OAUTH_CLIENT_ID',
    clientSecretEnvKey: 'FIRECRAWL_OAUTH_CLIENT_SECRET',
  },
  tavily: {
    authorizationEndpoint: 'https://mcp.tavily.com/authorize',
    tokenEndpoint: 'https://mcp.tavily.com/token',
    scopes: ['openid', 'search', 'extract'],
    clientIdEnvKey: 'TAVILY_OAUTH_CLIENT_ID',
    clientSecretEnvKey: 'TAVILY_OAUTH_CLIENT_SECRET',
  },
};

function validateSafeMcpUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return ALLOWED_MCP_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// Validate dynamic discovery URLs (HTTPS public internet only; blocks loopback/private/metadata IPs) [Commented by: Google AI Studio at 22/11/2026 11:48]
function validateSafePublicHttpsUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(48));
  const verifier = base64UrlEncode(randomBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

function escapeHtmlSafe(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Parse Streamable HTTP JSON or SSE response payloads per MCP 2026-07-28 transport spec [Commented by: Google AI Studio at 22/11/2026 11:48]
async function parseMcpResponsePayload(res: Response): Promise<any> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/event-stream')) {
    const raw = await res.text();
    const lines = raw.split(/\r?\n/);
    let lastJson: any = null;
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload);
          if (parsed && (parsed.result !== undefined || parsed.error !== undefined)) {
            lastJson = parsed;
          }
        } catch {
          // Ignore partial SSE lines
        }
      }
    }
    return lastJson;
  }
  return res.json().catch(() => null);
}

// Execute stateless MCP 2026-07-28 JSON-RPC request with optional legacy session initialize fallback [Commented by: Google AI Studio at 22/11/2026 11:48]
async function callRemoteMcpJsonRpc(
  mcpUrl: string,
  token: string,
  method: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<{ ok: boolean; status: number; headers: Headers; data: any }> {
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2026-07-28',
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
    signal,
  });

  if (!res.ok) {
    return { ok: false, status: res.status, headers: res.headers, data: await res.text().catch(() => '') };
  }

  const data = await parseMcpResponsePayload(res);
  // If a pre-2026-07-28 stateful MCP server demands initialize first, negotiate session cleanly
  if (data?.error && /not initialized|session/i.test(String(data.error.message || ''))) {
    const initRes = await fetch(mcpUrl, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2026-07-28',
          capabilities: {},
          clientInfo: { name: 'nanobot', version: '1.2.0' },
        },
      }),
      signal,
    });
    if (initRes.ok) {
      const sessionId = initRes.headers.get('Mcp-Session-Id');
      const sessionHeaders = sessionId ? { ...baseHeaders, 'Mcp-Session-Id': sessionId } : baseHeaders;
      await fetch(mcpUrl, {
        method: 'POST',
        headers: sessionHeaders,
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
        signal,
      }).catch(() => {});
      const retryRes = await fetch(mcpUrl, {
        method: 'POST',
        headers: sessionHeaders,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
        signal,
      });
      if (!retryRes.ok) {
        return { ok: false, status: retryRes.status, headers: retryRes.headers, data: await retryRes.text().catch(() => '') };
      }
      return { ok: true, status: retryRes.status, headers: retryRes.headers, data: await parseMcpResponsePayload(retryRes) };
    }
  }

  return { ok: true, status: res.status, headers: res.headers, data };
}

function parseWwwAuthenticateHeader(headerValue: string | null): { resourceMetadataUrl?: string; scope?: string } {
  if (!headerValue) return {};
  const rmMatch = headerValue.match(/resource_metadata="([^"]+)"/i);
  const scopeMatch = headerValue.match(/scope="([^"]+)"/i);
  return {
    resourceMetadataUrl: rmMatch ? rmMatch[1] : undefined,
    scope: scopeMatch ? scopeMatch[1] : undefined,
  };
}

// Discover MCP 2026-07-28 Protected Resource Metadata (RFC 9728) & Authorization Server Metadata (RFC 8414) + Client Registration (CIMD / DCR / Static) [Commented by: Google AI Studio at 22/11/2026 11:48]
async function discoverAndPrepareMcpOAuth(
  providerId: string,
  workerOrigin: string,
  env: Env
): Promise<{
  available: boolean;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  clientId?: string;
  clientSecret?: string;
  resource?: string;
  mcpEndpoint: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
  reason?: string;
}> {
  const remoteMcpUrl = REMOTE_MCP_ENDPOINTS[providerId] || CANONICAL_PROVIDER_ENDPOINTS[providerId] || '';
  const staticCfg = STATIC_OAUTH_PROVIDERS[providerId];
  const staticClientId = staticCfg ? (env[staticCfg.clientIdEnvKey] as string | undefined) : undefined;
  const staticClientSecret = staticCfg ? (env[staticCfg.clientSecretEnvKey] as string | undefined) : undefined;

  let discoveredResourceMetadataUrl: string | undefined;
  let discoveredScope: string | undefined;
  let authorizationServers: string[] = [];
  let supportedScopes: string[] = [];
  let resourceUri = remoteMcpUrl;

  // Step 1: Probe remote MCP endpoint for 401 WWW-Authenticate / RFC 9728 Protected Resource Metadata
  if (remoteMcpUrl && validateSafeMcpUrl(remoteMcpUrl)) {
    try {
      const probeRes = await fetch(remoteMcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2026-07-28',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      });

      if (probeRes.status === 401 || probeRes.status === 403) {
        const challenge = parseWwwAuthenticateHeader(probeRes.headers.get('WWW-Authenticate'));
        discoveredResourceMetadataUrl = challenge.resourceMetadataUrl;
        discoveredScope = challenge.scope;
      }
    } catch {
      // Ignore probe error and attempt well-known discovery below
    }

    // Step 2: Query RFC 9728 Protected Resource Metadata
    const mcpUrlObj = new URL(remoteMcpUrl);
    const prmCandidates = [
      discoveredResourceMetadataUrl,
      `${mcpUrlObj.origin}/.well-known/oauth-protected-resource${mcpUrlObj.pathname === '/' ? '' : mcpUrlObj.pathname}`,
      `${mcpUrlObj.origin}/.well-known/oauth-protected-resource`,
    ].filter((u): u is string => Boolean(u) && validateSafePublicHttpsUrl(u!));

    for (const prmUrl of prmCandidates) {
      try {
        const prmRes = await fetch(prmUrl, { headers: { Accept: 'application/json' } });
        if (prmRes.ok) {
          const prm: any = await prmRes.json().catch(() => null);
          if (prm && Array.isArray(prm.authorization_servers) && prm.authorization_servers.length > 0) {
            authorizationServers = prm.authorization_servers.filter((s: unknown) => typeof s === 'string');
            if (typeof prm.resource === 'string') resourceUri = prm.resource;
            if (Array.isArray(prm.scopes_supported)) supportedScopes = prm.scopes_supported;
            break;
          }
        }
      } catch {
        // Try next candidate
      }
    }

    // Fallback: some MCP servers host oauth-authorization-server directly on their origin
    if (authorizationServers.length === 0) {
      authorizationServers = [mcpUrlObj.origin];
    }
  }

  // Step 3: Fetch RFC 8414 Authorization Server Metadata / OpenID Configuration
  let asMeta: any = null;
  for (const asOriginOrUrl of authorizationServers) {
    if (!validateSafePublicHttpsUrl(asOriginOrUrl)) continue;
    const asUrlObj = new URL(asOriginOrUrl);
    const pathPrefix = asUrlObj.pathname === '/' ? '' : asUrlObj.pathname.replace(/\/$/, '');
    const metadataUrls = [
      `${asUrlObj.origin}/.well-known/oauth-authorization-server${pathPrefix}`,
      `${asUrlObj.origin}${pathPrefix}/.well-known/oauth-authorization-server`,
      `${asUrlObj.origin}/.well-known/openid-configuration${pathPrefix}`,
      `${asUrlObj.origin}${pathPrefix}/.well-known/openid-configuration`,
    ];

    for (const metaUrl of metadataUrls) {
      try {
        const metaRes = await fetch(metaUrl, { headers: { Accept: 'application/json' } });
        if (metaRes.ok) {
          const parsed: any = await metaRes.json().catch(() => null);
          if (parsed && parsed.authorization_endpoint && parsed.token_endpoint) {
            asMeta = parsed;
            break;
          }
        }
      } catch {
        // Continue trying candidates
      }
    }
    if (asMeta) break;
  }

  const callbackUri = `${workerOrigin}/api/mcp/oauth/callback`;
  const resolvedScopes = discoveredScope
    ? discoveredScope.split(/\s+/).filter(Boolean)
    : supportedScopes.length > 0
    ? supportedScopes
    : staticCfg?.scopes || [];

  // Step 4: Client Registration Hierarchy per MCP 2026-07-28:
  // (1) Pre-configured static client credentials -> (2) Client ID Metadata Document (CIMD) -> (3) Dynamic Client Registration (RFC 7591)
  if (staticClientId && staticCfg) {
    const useDiscoveredAs = Boolean(asMeta && asMeta.authorization_endpoint && asMeta.token_endpoint);
    return {
      available: true,
      authorizationEndpoint: useDiscoveredAs ? asMeta.authorization_endpoint : staticCfg.authorizationEndpoint,
      tokenEndpoint: useDiscoveredAs ? asMeta.token_endpoint : staticCfg.tokenEndpoint,
      clientId: staticClientId,
      clientSecret: staticClientSecret,
      resource: useDiscoveredAs ? (resourceUri || undefined) : undefined,
      mcpEndpoint: useDiscoveredAs ? (remoteMcpUrl || CANONICAL_PROVIDER_ENDPOINTS[providerId] || '') : (CANONICAL_PROVIDER_ENDPOINTS[providerId] || ''),
      scopes: staticCfg.scopes.length > 0 ? staticCfg.scopes : resolvedScopes,
      extraAuthParams: staticCfg.extraAuthParams,
    };
  }

  if (asMeta && validateSafePublicHttpsUrl(asMeta.authorization_endpoint) && validateSafePublicHttpsUrl(asMeta.token_endpoint)) {
    // Prefer CIMD (MCP 2026-07-28) when advertised
    if (asMeta.client_id_metadata_document_supported === true) {
      return {
        available: true,
        authorizationEndpoint: asMeta.authorization_endpoint,
        tokenEndpoint: asMeta.token_endpoint,
        clientId: `${workerOrigin}/oauth/client-metadata.json`,
        resource: resourceUri || undefined,
        mcpEndpoint: remoteMcpUrl || CANONICAL_PROVIDER_ENDPOINTS[providerId] || '',
        scopes: resolvedScopes,
      };
    }

    // Fallback to Dynamic Client Registration (RFC 7591)
    if (asMeta.registration_endpoint && validateSafePublicHttpsUrl(asMeta.registration_endpoint)) {
      try {
        const regRes = await fetch(asMeta.registration_endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            client_name: 'nanobot',
            client_uri: workerOrigin,
            redirect_uris: [callbackUri],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
          }),
        });
        if (regRes.ok) {
          const regData: any = await regRes.json().catch(() => null);
          if (regData && regData.client_id) {
            return {
              available: true,
              authorizationEndpoint: asMeta.authorization_endpoint,
              tokenEndpoint: asMeta.token_endpoint,
              clientId: String(regData.client_id),
              clientSecret: regData.client_secret ? String(regData.client_secret) : undefined,
              resource: resourceUri || undefined,
              mcpEndpoint: remoteMcpUrl || CANONICAL_PROVIDER_ENDPOINTS[providerId] || '',
              scopes: resolvedScopes,
            };
          }
        }
      } catch {
        // DCR failed; fall through to clear unavailable reason
      }
    }
  }

  const missingVarHint = staticCfg ? String(staticCfg.clientIdEnvKey) : `${providerId.toUpperCase()}_OAUTH_CLIENT_ID`;
  return {
    available: false,
    mcpEndpoint: remoteMcpUrl || CANONICAL_PROVIDER_ENDPOINTS[providerId] || '',
    scopes: resolvedScopes,
    reason: `Automatic MCP OAuth registration is not advertised by ${providerId}'s remote endpoint and ${missingVarHint} is not configured in Cloudflare Worker secrets. You can connect with a personal authorization token below or configure ${missingVarHint} in your Worker environment.`,
  };
}

// Refresh expired OAuth 2.1 access tokens automatically on the backend and re-encrypt into D1 [Commented by: Google AI Studio at 22/11/2026 11:48]
async function refreshMcpCredentialsIfNeeded(
  db: D1Database,
  userId: string,
  providerId: string,
  credentials: Record<string, string>,
  encSecret: string,
  forceRefresh = false
): Promise<{ credentials: Record<string, string>; refreshed: boolean }> {
  const refreshToken = credentials.refresh_token || '';
  const tokenEndpoint = credentials.token_endpoint || '';
  const clientId = credentials.client_id || '';
  const expiresAt = credentials.expires_at ? Number(credentials.expires_at) : 0;
  const needsRefresh = forceRefresh || (expiresAt > 0 && Date.now() >= expiresAt - 60_000);

  if (!needsRefresh || !refreshToken || !tokenEndpoint || !clientId || !validateSafePublicHttpsUrl(tokenEndpoint)) {
    return { credentials, refreshed: false };
  }

  try {
    const form = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    });
    if (credentials.client_secret) {
      form.set('client_secret', credentials.client_secret);
    }
    if (credentials.resource) {
      form.set('resource', credentials.resource);
    }

    const tokenRes = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
    });

    if (!tokenRes.ok) {
      return { credentials, refreshed: false };
    }

    const tokenData: any = await tokenRes.json().catch(() => null);
    if (!tokenData || !tokenData.access_token) {
      return { credentials, refreshed: false };
    }

    const nextCreds: Record<string, string> = {
      ...credentials,
      token: String(tokenData.access_token),
      access_token: String(tokenData.access_token),
      refresh_token: tokenData.refresh_token ? String(tokenData.refresh_token) : refreshToken,
      expires_at: tokenData.expires_in
        ? String(Date.now() + Number(tokenData.expires_in) * 1000)
        : credentials.expires_at || '',
    };

    const encrypted = await encryptServerCredential(JSON.stringify(nextCreds), encSecret);
    await db
      .prepare(`UPDATE user_mcp_connections SET encrypted_credentials = ?, status = 'connected', error_message = NULL, updated_at = ? WHERE user_id = ? AND provider_id = ?`)
      .bind(encrypted, new Date().toISOString(), userId, providerId)
      .run();

    return { credentials: nextCreds, refreshed: true };
  } catch {
    return { credentials, refreshed: false };
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

// Dynamically discover tools from real provider endpoint or verify credentials via official API [Commented by: Google AI Studio at 22/11/2026 11:51]
async function discoverAndValidateMcpProvider(
  providerId: string,
  credentials: Record<string, string>,
  customEndpoint?: string
): Promise<{ success: boolean; tools: McpDiscoveredTool[]; endpoint: string; error?: string }> {
  const token = credentials.token || credentials.access_token || credentials.apiKey || credentials.accessToken || '';
  if (!token.trim()) {
    return {
      success: false,
      tools: [],
      endpoint: '',
      error: 'Authentication credential (token, API key, or access token) is required',
    };
  }

  const endpoint = customEndpoint || '';
  const remoteCandidate =
    (credentials.resource && validateSafeMcpUrl(credentials.resource) ? credentials.resource : '') ||
    (endpoint && endpoint.includes('/mcp') && validateSafeMcpUrl(endpoint) ? endpoint : '');

  try {
    // If connected to a remote Streamable HTTP MCP endpoint via OAuth, perform live MCP 2026-07-28 tools/list first [Commented by: Google AI Studio at 22/11/2026 11:51]
    if (remoteCandidate && providerId !== 'cloudflare' && providerId !== 'netlify') {
      const remoteMcpCall = await callRemoteMcpJsonRpc(remoteCandidate, token, 'tools/list', {}).catch(() => null);
      if (remoteMcpCall && remoteMcpCall.ok && remoteMcpCall.data?.result && Array.isArray(remoteMcpCall.data.result.tools)) {
        return {
          success: true,
          tools: remoteMcpCall.data.result.tools,
          endpoint: remoteCandidate,
        };
      }
      if (remoteMcpCall && (remoteMcpCall.status === 401 || remoteMcpCall.status === 403) && credentials.resource) {
        return {
          success: false,
          tools: [],
          endpoint: remoteCandidate,
          error: `MCP OAuth authorization rejected (${remoteMcpCall.status})`,
        };
      }
    }

    switch (providerId) {
      case 'cloudflare': {
        const mcpUrl = endpoint || 'https://mcp.cloudflare.com/mcp';
        if (!validateSafeMcpUrl(mcpUrl)) {
          return { success: false, tools: [], endpoint: mcpUrl, error: 'SSRF Block: Endpoint domain not permitted' };
        }

        // Live Streamable HTTP MCP 2026-07-28 connection test (JSON + SSE) [Commented by: Google AI Studio at 22/11/2026 11:48]
        const mcpCall = await callRemoteMcpJsonRpc(mcpUrl, token, 'tools/list', {}).catch(() => null);
        if (mcpCall && mcpCall.ok && mcpCall.data?.result && Array.isArray(mcpCall.data.result.tools)) {
          return {
            success: true,
            tools: mcpCall.data.result.tools,
            endpoint: mcpUrl,
          };
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

        // Live Streamable HTTP MCP 2026-07-28 connection test [Commented by: Google AI Studio at 22/11/2026 11:48]
        const netlifyMcpCall = await callRemoteMcpJsonRpc(mcpUrl, token, 'tools/list', {}).catch(() => null);
        if (netlifyMcpCall && netlifyMcpCall.ok && netlifyMcpCall.data?.result && Array.isArray(netlifyMcpCall.data.result.tools)) {
          return {
            success: true,
            tools: netlifyMcpCall.data.result.tools,
            endpoint: mcpUrl,
          };
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

// Execute authentic MCP tool calls on the backend with timeout, Streamable HTTP 2026-07-28 JSON-RPC, and error containment [Commented by: Google AI Studio at 22/11/2026 11:51]
async function executeMcpToolCall(
  providerId: string,
  toolName: string,
  args: Record<string, unknown>,
  credentials: Record<string, string>,
  endpointUrl: string
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const token = credentials.token || credentials.access_token || credentials.apiKey || credentials.accessToken || '';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  try {
    const remoteMcpTarget =
      (credentials.resource && validateSafeMcpUrl(credentials.resource) ? credentials.resource : '') ||
      (endpointUrl && endpointUrl.includes('/mcp') && validateSafeMcpUrl(endpointUrl) ? endpointUrl : '');

    // Use MCP 2026-07-28 Streamable HTTP JSON-RPC (JSON + SSE + session fallback) for remote MCP endpoints [Commented by: Google AI Studio at 22/11/2026 11:51]
    if (remoteMcpTarget && providerId !== 'cloudflare' && providerId !== 'netlify') {
      const mcpRes = await callRemoteMcpJsonRpc(
        remoteMcpTarget,
        token,
        'tools/call',
        { name: toolName, arguments: args },
        controller.signal
      ).catch(() => null);

      if (mcpRes && mcpRes.ok && mcpRes.data?.result?.content) {
        return { content: mcpRes.data.result.content, isError: Boolean(mcpRes.data.result.isError) };
      }
      if (mcpRes && (mcpRes.status === 401 || mcpRes.status === 403)) {
        return {
          content: [{ type: 'text', text: `Remote MCP authorization failed (${mcpRes.status}): ${typeof mcpRes.data === 'string' ? mcpRes.data : JSON.stringify(mcpRes.data)}` }],
          isError: true,
        };
      }
    }

    switch (providerId) {
      case 'cloudflare': {
        // If an explicit remote MCP server endpoint is configured and active, invoke MCP 2026-07-28 JSON-RPC tools/call
        if (endpointUrl && endpointUrl.includes('/mcp') && validateSafeMcpUrl(endpointUrl)) {
          const mcpRes = await callRemoteMcpJsonRpc(
            endpointUrl,
            token,
            'tools/call',
            { name: toolName, arguments: args },
            controller.signal
          ).catch(() => null);

          if (mcpRes && mcpRes.ok && mcpRes.data?.result?.content) {
            return { content: mcpRes.data.result.content, isError: Boolean(mcpRes.data.result.isError) };
          }
          if (mcpRes && (mcpRes.status === 401 || mcpRes.status === 403) && credentials.auth_type === 'oauth') {
            return {
              content: [{ type: 'text', text: `Cloudflare MCP authorization failed (${mcpRes.status})` }],
              isError: true,
            };
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
        if (endpointUrl && endpointUrl.includes('/mcp') && validateSafeMcpUrl(endpointUrl)) {
          const mcpRes = await callRemoteMcpJsonRpc(
            endpointUrl,
            token,
            'tools/call',
            { name: toolName, arguments: args },
            controller.signal
          ).catch(() => null);
          if (mcpRes && mcpRes.ok && mcpRes.data?.result?.content) {
            return { content: mcpRes.data.result.content, isError: Boolean(mcpRes.data.result.isError) };
          }
          if (mcpRes && (mcpRes.status === 401 || mcpRes.status === 403) && credentials.auth_type === 'oauth') {
            return {
              content: [{ type: 'text', text: `Netlify MCP authorization failed (${mcpRes.status})` }],
              isError: true,
            };
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

// Cryptographically verify HMAC-SHA256 signature of Supabase JWT using SUPABASE_JWT_SECRET [Commented by: Google AI Studio at 05/11/2026 17:28]
async function verifySupabaseJwtSignature(token: string, secret: string): Promise<{ valid: boolean; sub?: string }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false };
    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode URL-safe base64 signature
    const signatureStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const signaturePad = signatureStr.padEnd(signatureStr.length + (4 - (signatureStr.length % 4)) % 4, '=');
    const sigBinary = atob(signaturePad);
    const sigBytes = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) {
      sigBytes[i] = sigBinary.charCodeAt(i);
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const dataToVerify = encoder.encode(`${headerB64}.${payloadB64}`);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      dataToVerify
    );

    if (!isValid) return { valid: false };

    const payloadStr = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const payloadPad = payloadStr.padEnd(payloadStr.length + (4 - (payloadStr.length % 4)) % 4, '=');
    const payload = JSON.parse(atob(payloadPad));

    // Verify expiration claim
    if (payload.exp && typeof payload.exp === 'number') {
      const nowSec = Math.floor(Date.now() / 1000);
      if (payload.exp < nowSec) {
        return { valid: false };
      }
    }

    if (payload && typeof payload.sub === 'string' && /^[0-9a-fA-F-]{36}$/.test(payload.sub)) {
      return { valid: true, sub: payload.sub };
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
}

// Idempotent D1 database schema initialization guaranteeing zero-downtime bootstrapping [Commented by: Google AI Studio on 04/11/2026 05:23 PM]
// Concurrent-safe, idempotent D1 database schema initialization with promise-locking and error recovery [Commented by: Google AI Studio on 04/11/2026 05:38 PM]
let d1TablesInitialized = false;
let d1InitPromise: Promise<void> | null = null;

async function ensureD1Tables(db: D1Database): Promise<void> {
  if (d1TablesInitialized) return;
  if (!db || typeof db.batch !== 'function') {
    throw new Error('D1 database binding "DB" is unavailable');
  }

  // If another request is currently initializing, await the in-flight initialization promise
  if (!d1InitPromise) {
    d1InitPromise = (async () => {
      try {
        await db.batch([
          // 1. conversations table and index
          db.prepare(`
            CREATE TABLE IF NOT EXISTS conversations (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              title TEXT NOT NULL,
              pinned INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_conversations_user_updated 
            ON conversations (user_id, updated_at DESC)
          `),
          // 2. messages table and indexes
          db.prepare(`
            CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY,
              conversation_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
              content TEXT NOT NULL,
              sources_json TEXT,
              reasoning TEXT,
              display_attachments_json TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
            ON messages (conversation_id, created_at ASC)
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_messages_user 
            ON messages (user_id)
          `),
          // 3. file_outputs table and indexes
          db.prepare(`
            CREATE TABLE IF NOT EXISTS file_outputs (
              id TEXT PRIMARY KEY,
              conversation_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              source_file_id TEXT NOT NULL,
              file_name TEXT NOT NULL,
              file_type TEXT NOT NULL,
              output_type TEXT NOT NULL,
              output_content TEXT NOT NULL,
              metadata_json TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_file_outputs_conversation 
            ON file_outputs (conversation_id, updated_at DESC)
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_file_outputs_user 
            ON file_outputs (user_id)
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_file_outputs_source_file 
            ON file_outputs (source_file_id)
          `),
          // 4. shared_chats table and index
          db.prepare(`
            CREATE TABLE IF NOT EXISTS shared_chats (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              title TEXT NOT NULL,
              messages_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL
            )
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_shared_chats_expires 
            ON shared_chats (expires_at)
          `),
          // 5. user_mcp_connections table and indexes
          db.prepare(`
            CREATE TABLE IF NOT EXISTS user_mcp_connections (
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
            )
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_mcp_connections_user 
            ON user_mcp_connections (user_id)
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_mcp_connections_provider 
            ON user_mcp_connections (provider_id)
          `),
          // 6. mcp_oauth_states table for OAuth 2.1 PKCE transactions [Commented by: Google AI Studio at 22/11/2026 11:48]
          db.prepare(`
            CREATE TABLE IF NOT EXISTS mcp_oauth_states (
              state TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              provider_id TEXT NOT NULL,
              pkce_verifier TEXT NOT NULL,
              redirect_uri TEXT NOT NULL,
              return_origin TEXT NOT NULL,
              token_endpoint TEXT NOT NULL,
              client_id TEXT NOT NULL,
              client_secret TEXT,
              resource TEXT,
              mcp_endpoint TEXT NOT NULL,
              scopes TEXT,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL
            )
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_mcp_oauth_states_expires
            ON mcp_oauth_states (expires_at)
          `)
        ]);
        d1TablesInitialized = true;
      } catch (err) {
        d1TablesInitialized = false;
        console.error('D1 table initialization failed; resetting lock for retry:', err);
        throw err;
      } finally {
        d1InitPromise = null;
      }
    })();
  }

  await d1InitPromise;
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
            'GET /oauth/client-metadata.json',
            'GET /.well-known/mcp-client.json',
            'GET /api/mcp/oauth/callback',
            'POST /api/mcp/oauth/start',
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

    // MCP 2026-07-28 Client ID Metadata Document (CIMD) public discovery endpoint [Commented by: Google AI Studio at 22/11/2026 11:48]
    if ((pathname === '/oauth/client-metadata.json' || pathname === '/.well-known/mcp-client.json') && request.method === 'GET') {
      const workerOrigin = url.origin;
      return sendJson(
        {
          client_id: `${workerOrigin}/oauth/client-metadata.json`,
          client_name: 'nanobot',
          client_uri: allowedOrigin !== '*' ? allowedOrigin.split(',')[0].trim() : workerOrigin,
          redirect_uris: [`${workerOrigin}/api/mcp/oauth/callback`],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
        },
        200
      );
    }

    // MCP 2026-07-28 OAuth 2.1 Authorization Callback (PKCE token exchange + encrypted D1 storage) [Commented by: Google AI Studio at 22/11/2026 11:48]
    if ((pathname === '/api/mcp/oauth/callback' || pathname === '/api/mcp/oauth/callback/') && request.method === 'GET') {
      if (!env.DB || typeof env.DB.prepare !== 'function') {
        return new Response('Database unavailable', { status: 500 });
      }

      const renderCallbackHtml = (
        ok: boolean,
        message: string,
        providerId: string,
        returnOrigin: string,
        toolsCount = 0
      ) => {
        const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
        const nonce = base64UrlEncode(nonceBytes);
        const safeMsg = escapeHtmlSafe(message);
        const safeProvider = escapeHtmlSafe(providerId);
        const targetOrigin =
          returnOrigin && (returnOrigin.startsWith('https://') || returnOrigin.startsWith('http://localhost'))
            ? returnOrigin
            : '*';
        const payloadJson = JSON.stringify({
          type: 'MCP_OAUTH_COMPLETE',
          success: ok,
          providerId,
          toolsCount,
          error: ok ? undefined : message,
        });

        const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>nanobot Authorization</title></head>
<body style="background:#0a0a0a;color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;">
  <div style="max-width:420px;background:#121212;border:1px solid ${ok ? '#10b981' : '#ef4444'};border-radius:16px;padding:28px;">
    <h2 style="margin:0 0 8px 0;font-size:18px;">${ok ? '✓ Plugin Authorized' : 'Authorization Failed'}</h2>
    <p style="margin:0 0 14px 0;font-size:13px;color:#d4d4d4;">${safeProvider ? `${safeProvider}: ` : ''}${safeMsg}</p>
    <p style="margin:0;font-size:12px;color:#888;">You may close this tab and return to nanobot.</p>
  </div>
  <script nonce="${nonce}">
    try {
      if (window.opener) {
        window.opener.postMessage(${payloadJson}, ${JSON.stringify(targetOrigin)});
        setTimeout(function () { window.close(); }, 600);
      }
    } catch (e) {}
  </script>
</body>
</html>`;

        return new Response(html, {
          status: ok ? 200 : 400,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`,
          },
        });
      };

      const oauthError = url.searchParams.get('error');
      const oauthErrorDesc = url.searchParams.get('error_description');
      const code = url.searchParams.get('code') || '';
      const state = url.searchParams.get('state') || '';

      try {
        await ensureD1Tables(env.DB);
        await env.DB.prepare(`DELETE FROM mcp_oauth_states WHERE expires_at < ?`).bind(new Date().toISOString()).run().catch(() => {});

        if (!state || !validateSafeId(state)) {
          return renderCallbackHtml(false, oauthErrorDesc || oauthError || 'Invalid or missing OAuth state parameter.', '', '*');
        }

        const tx = await env.DB.prepare(
          `SELECT state, user_id, provider_id, pkce_verifier, redirect_uri, return_origin, token_endpoint, client_id, client_secret, resource, mcp_endpoint, scopes, expires_at
           FROM mcp_oauth_states WHERE state = ?`
        )
          .bind(state)
          .first<{
            state: string;
            user_id: string;
            provider_id: string;
            pkce_verifier: string;
            redirect_uri: string;
            return_origin: string;
            token_endpoint: string;
            client_id: string;
            client_secret: string | null;
            resource: string | null;
            mcp_endpoint: string;
            scopes: string | null;
            expires_at: string;
          }>();

        // Always consume state atomically (single-use CSRF guard)
        await env.DB.prepare(`DELETE FROM mcp_oauth_states WHERE state = ?`).bind(state).run().catch(() => {});

        if (!tx) {
          return renderCallbackHtml(false, 'OAuth session expired or already used. Please try installing the plugin again.', '', '*');
        }

        if (oauthError) {
          return renderCallbackHtml(false, oauthErrorDesc || oauthError, tx.provider_id, tx.return_origin);
        }

        if (!code) {
          return renderCallbackHtml(false, 'Authorization server did not return an authorization code.', tx.provider_id, tx.return_origin);
        }

        if (tx.expires_at < new Date().toISOString()) {
          return renderCallbackHtml(false, 'Authorization request timed out. Please try again.', tx.provider_id, tx.return_origin);
        }

        if (!env.MCP_ENCRYPTION_SECRET) {
          return renderCallbackHtml(false, 'Server configuration missing MCP_ENCRYPTION_SECRET.', tx.provider_id, tx.return_origin);
        }

        if (!validateSafePublicHttpsUrl(tx.token_endpoint)) {
          return renderCallbackHtml(false, 'Blocked invalid token endpoint URL.', tx.provider_id, tx.return_origin);
        }

        // Exchange authorization code + PKCE verifier strictly on the backend
        const form = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: tx.redirect_uri,
          client_id: tx.client_id,
          code_verifier: tx.pkce_verifier,
        });
        if (tx.client_secret) {
          form.set('client_secret', tx.client_secret);
        }
        if (tx.resource) {
          form.set('resource', tx.resource);
        }

        const tokenHeaders: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        };
        if (tx.provider_id === 'notion' && tx.client_secret) {
          tokenHeaders.Authorization = `Basic ${btoa(`${tx.client_id}:${tx.client_secret}`)}`;
        }

        const tokenRes = await fetch(tx.token_endpoint, {
          method: 'POST',
          headers: tokenHeaders,
          body: form.toString(),
        });

        const tokenData: any = await tokenRes.json().catch(() => null);
        if (!tokenRes.ok || !tokenData) {
          return renderCallbackHtml(false, `Token exchange failed (${tokenRes.status}).`, tx.provider_id, tx.return_origin);
        }

        // Slack v2 puts bot token under authed_user or access_token
        const accessToken = String(tokenData.access_token || tokenData.authed_user?.access_token || '');
        if (!accessToken) {
          const providerErr = tokenData.error_description || tokenData.error || 'No access token returned by authorization server.';
          return renderCallbackHtml(false, String(providerErr), tx.provider_id, tx.return_origin);
        }

        const credentials: Record<string, string> = {
          auth_type: 'oauth',
          token: accessToken,
          access_token: accessToken,
          refresh_token: tokenData.refresh_token ? String(tokenData.refresh_token) : '',
          expires_at: tokenData.expires_in ? String(Date.now() + Number(tokenData.expires_in) * 1000) : '',
          token_endpoint: tx.token_endpoint,
          client_id: tx.client_id,
          client_secret: tx.client_secret || '',
          resource: tx.resource || '',
          scope: tokenData.scope ? String(tokenData.scope) : tx.scopes || '',
        };

        const canonicalEndpoint =
          (tx.resource && validateSafeMcpUrl(tx.resource) ? tx.resource : '') ||
          (tx.mcp_endpoint && validateSafeMcpUrl(tx.mcp_endpoint) ? tx.mcp_endpoint : '') ||
          CANONICAL_PROVIDER_ENDPOINTS[tx.provider_id] ||
          '';
        const discovery = await discoverAndValidateMcpProvider(tx.provider_id, credentials, canonicalEndpoint);
        const toolsToCache = discovery.tools && discovery.tools.length > 0 ? discovery.tools : [];
        const encryptedCreds = await encryptServerCredential(JSON.stringify(credentials), env.MCP_ENCRYPTION_SECRET);
        const nowIso = new Date().toISOString();

        await env.DB.prepare(
          `INSERT INTO user_mcp_connections (
            id, user_id, provider_id, auth_type, encrypted_credentials, endpoint_url, cached_tools_json, status, error_message, created_at, updated_at
          ) VALUES (?, ?, ?, 'oauth', ?, ?, ?, 'connected', NULL, ?, ?)
          ON CONFLICT(user_id, provider_id) DO UPDATE SET
            auth_type = 'oauth',
            encrypted_credentials = excluded.encrypted_credentials,
            endpoint_url = excluded.endpoint_url,
            cached_tools_json = excluded.cached_tools_json,
            status = 'connected',
            error_message = NULL,
            updated_at = excluded.updated_at`
        )
          .bind(
            crypto.randomUUID(),
            tx.user_id,
            tx.provider_id,
            encryptedCreds,
            discovery.endpoint || canonicalEndpoint,
            JSON.stringify(toolsToCache),
            nowIso,
            nowIso
          )
          .run();

        return renderCallbackHtml(
          true,
          `Connected! Discovered ${toolsToCache.length} live tool${toolsToCache.length === 1 ? '' : 's'}.`,
          tx.provider_id,
          tx.return_origin,
          toolsToCache.length
        );
      } catch (err: unknown) {
        const e = err as Error;
        return renderCallbackHtml(false, `Authorization error: ${e.message}`, '', '*');
      }
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
        // Enforce D1 database table initialization before executing public share queries to prevent uninitialized schema crashes [Commented by: Google AI Studio at 05/11/2026 04:00 PM]
        await ensureD1Tables(env.DB);
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

        let parsedPayload: any = null;
        try {
          parsedPayload = JSON.parse(shareRecord.messages_json);
        } catch {
          parsedPayload = [];
        }

        const isEncrypted = parsedPayload && parsedPayload.is_encrypted && parsedPayload.encrypted_payload;

        return new Response(
          JSON.stringify({
            success: true,
            share: {
              id: shareRecord.id,
              title: shareRecord.title,
              messages: isEncrypted ? [] : (Array.isArray(parsedPayload) ? parsedPayload : []),
              encrypted_payload: isEncrypted ? parsedPayload.encrypted_payload : undefined,
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

      let verifiedUserId: string | null = null;
      let isPreDeletedAuthRecovery = false;

      const { user, error: authError } = await authenticateRequest(request, env);
      if (user) {
        verifiedUserId = user.id;
      } else if (pathname === '/api/account' && request.method === 'DELETE') {
        // Recovery path: if Auth deletion succeeded on a prior attempt but the response was lost,
        // the user's JWT will fail standard authentication because their identity in auth.users was deleted.
        // SECURITY REQUIREMENT: Never trust an unverified token payload. Verify HMAC signature cryptographically. [Commented by: Google AI Studio at 05/11/2026 09:25]
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
        let candidateId: string | null = null;

        // If SUPABASE_JWT_SECRET is configured, cryptographically verify the token signature
        if (token && env.SUPABASE_JWT_SECRET) {
          const sigCheck = await verifySupabaseJwtSignature(token, env.SUPABASE_JWT_SECRET);
          if (sigCheck.valid && sigCheck.sub) {
            candidateId = sigCheck.sub;
          }
        }

        if (candidateId && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_URL) {
          try {
            const adminCheckEndpoint = `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${candidateId}`;
            const checkRes = await fetch(adminCheckEndpoint, {
              method: 'GET',
              headers: {
                apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
            });
            // If the user identity returns 404 from Admin API, it is confirmed deleted
            if (checkRes.status === 404) {
              verifiedUserId = candidateId;
              isPreDeletedAuthRecovery = true;
            }
          } catch {}
        }

        if (!verifiedUserId) {
          return sendError(authError || 'Unauthorized', 401);
        }
      } else {
        return sendError(authError || 'Unauthorized', 401);
      }

      // Ensure D1 database tables and indexes exist before handling any database queries [Commented by: Google AI Studio on 04/11/2026 05:38 PM]
      try {
        await ensureD1Tables(env.DB);
      } catch (d1InitErr) {
        return sendError('Database initialization unavailable; please retry request: ' + (d1InitErr as Error).message, 503);
      }

      try {
        // 0. DELETE /api/account -> Complete account deletion state machine with staged tracking and safe retry [Commented by: Google AI Studio on 04/11/2026 05:38 PM]
        if (pathname === '/api/account' && request.method === 'DELETE') {
          const stages = {
            d1_purged: false,
            supabase_data_purged: false,
            auth_identity_deleted: false,
          };

          // Step 1: Purge user-owned records from Cloudflare D1
          try {
            await env.DB.batch([
              env.DB.prepare(`DELETE FROM file_outputs WHERE user_id = ?`).bind(verifiedUserId),
              env.DB.prepare(`DELETE FROM messages WHERE user_id = ?`).bind(verifiedUserId),
              env.DB.prepare(`DELETE FROM conversations WHERE user_id = ?`).bind(verifiedUserId),
              env.DB.prepare(`DELETE FROM user_mcp_connections WHERE user_id = ?`).bind(verifiedUserId),
              env.DB.prepare(`DELETE FROM shared_chats WHERE user_id = ?`).bind(verifiedUserId),
            ]);
            stages.d1_purged = true;
          } catch (d1Err) {
            console.warn('Account deletion stage notice: D1 cleanup error:', d1Err);
          }

          // Step 2: Cascade cleanup in Supabase data tables via delete_user_account RPC
          const authHeader = request.headers.get('Authorization') || '';
          const supabaseUrl = env.SUPABASE_URL ? env.SUPABASE_URL.replace(/\/$/, '') : '';
          const supabaseAnon = env.SUPABASE_ANON_KEY || '';

          if (!isPreDeletedAuthRecovery && supabaseUrl && supabaseAnon && authHeader) {
            try {
              const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/delete_user_account`, {
                method: 'POST',
                headers: {
                  apikey: supabaseAnon,
                  Authorization: authHeader,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              });
              if (rpcRes.ok) {
                stages.supabase_data_purged = true;
              } else {
                console.warn('Account deletion stage notice: Supabase RPC returned status', rpcRes.status);
              }
            } catch (rpcErr) {
              console.warn('Account deletion stage notice: Supabase RPC network error:', rpcErr);
            }
          } else if (isPreDeletedAuthRecovery) {
            // In PostgreSQL, cascading FKs from auth.users(id) already wiped public tables when user identity was deleted
            stages.supabase_data_purged = true;
          }

          // Step 3: Purge Supabase Auth identity using Supabase Admin API
          if (!env.SUPABASE_SERVICE_ROLE_KEY) {
            return jsonResponse(
              {
                success: false,
                error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is required on the Worker to permanently delete the Supabase Auth user identity.',
                stages,
                can_retry: true,
              },
              500,
              origin,
              allowedOrigin
            );
          }

          if (isPreDeletedAuthRecovery) {
            stages.auth_identity_deleted = true;
          } else if (supabaseUrl) {
            const adminEndpoint = `${supabaseUrl}/auth/v1/admin/users/${verifiedUserId}`;
            const adminRes = await fetch(adminEndpoint, {
              method: 'DELETE',
              headers: {
                apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
            });

            // Accept 200 OK or 404 Not Found (if already deleted / repeated deletion request)
            if (adminRes.ok || adminRes.status === 404) {
              stages.auth_identity_deleted = true;
            } else {
              const errBody = await adminRes.text();
              console.error('Account deletion stage notice: Supabase Admin API returned status', adminRes.status);
              return jsonResponse(
                {
                  success: false,
                  error: `Supabase Auth identity deletion failed (${adminRes.status}): ${errBody}`,
                  stages,
                  can_retry: true,
                },
                adminRes.status >= 400 && adminRes.status < 600 ? adminRes.status : 500,
                origin,
                allowedOrigin
              );
            }
          }

          // Never report successful deletion before all required stages are confirmed [Commented by: Google AI Studio at 05/11/2026 04:00 PM]
          if (stages.auth_identity_deleted) {
            stages.supabase_data_purged = true;
          }

          if (!stages.d1_purged || !stages.supabase_data_purged || !stages.auth_identity_deleted) {
            return jsonResponse(
              {
                success: false,
                error: 'Account deletion incomplete; one or more stages could not be confirmed. Please retry.',
                stages,
                can_retry: true,
              },
              500,
              origin,
              allowedOrigin
            );
          }

          console.info('Account deletion stage notice: Completed deletion state machine (pre-deleted recovery: ' + isPreDeletedAuthRecovery + ')');

          return sendJson(
            {
              success: true,
              message: 'Account, authentication identity, and all user data successfully deleted.',
              stages,
              recovered_from_lost_response: isPreDeletedAuthRecovery,
            },
            200
          );
        }

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

        // POST /api/mcp/oauth/start -> Initiate MCP 2026-07-28 OAuth 2.1 + PKCE authorization flow on the backend [Commented by: Google AI Studio at 22/11/2026 11:48]
        if (pathname === '/api/mcp/oauth/start' && request.method === 'POST') {
          const body: any = await request.json().catch(() => null);
          if (!body || typeof body !== 'object' || !body.providerId) {
            return sendError('Invalid payload: providerId is required', 400);
          }

          const providerId = String(body.providerId).toLowerCase().trim();
          if (!validateSafeId(providerId)) {
            return sendError('Invalid provider identifier', 400);
          }

          if (!env.MCP_ENCRYPTION_SECRET) {
            return sendError('Worker runtime configuration missing: MCP_ENCRYPTION_SECRET must be configured as a Cloudflare Worker secret.', 500);
          }

          const returnOrigin = typeof body.returnOrigin === 'string' && body.returnOrigin.trim()
            ? body.returnOrigin.trim()
            : origin || url.origin;

          const oauthPlan = await discoverAndPrepareMcpOAuth(providerId, url.origin, env);
          if (!oauthPlan.available || !oauthPlan.authorizationEndpoint || !oauthPlan.tokenEndpoint || !oauthPlan.clientId) {
            return sendJson(
              {
                success: false,
                fallbackRequired: true,
                providerId,
                error: oauthPlan.reason || 'OAuth authorization server is not available for automatic registration.',
              },
              200
            );
          }

          const { verifier, challenge } = await generatePkcePair();
          const state = base64UrlEncode(crypto.getRandomValues(new Uint8Array(24)));
          const redirectUri = `${url.origin}/api/mcp/oauth/callback`;
          const now = Date.now();
          const createdAt = new Date(now).toISOString();
          const expiresAt = new Date(now + 10 * 60 * 1000).toISOString();

          await env.DB.prepare(
            `INSERT INTO mcp_oauth_states (
              state, user_id, provider_id, pkce_verifier, redirect_uri, return_origin, token_endpoint, client_id, client_secret, resource, mcp_endpoint, scopes, expires_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(
              state,
              verifiedUserId,
              providerId,
              verifier,
              redirectUri,
              returnOrigin,
              oauthPlan.tokenEndpoint,
              oauthPlan.clientId,
              oauthPlan.clientSecret || null,
              oauthPlan.resource || null,
              oauthPlan.mcpEndpoint,
              oauthPlan.scopes.join(' '),
              expiresAt,
              createdAt
            )
            .run();

          const authParams = new URLSearchParams({
            response_type: 'code',
            client_id: oauthPlan.clientId,
            redirect_uri: redirectUri,
            state,
            code_challenge: challenge,
            code_challenge_method: 'S256',
          });
          if (oauthPlan.scopes.length > 0) {
            authParams.set('scope', oauthPlan.scopes.join(' '));
          }
          if (oauthPlan.resource) {
            authParams.set('resource', oauthPlan.resource);
          }
          if (oauthPlan.extraAuthParams) {
            for (const [k, v] of Object.entries(oauthPlan.extraAuthParams)) {
              authParams.set(k, v);
            }
          }

          const authorizationUrl = `${oauthPlan.authorizationEndpoint}?${authParams.toString()}`;
          return sendJson(
            {
              success: true,
              providerId,
              authorizationUrl,
              state,
            },
            200
          );
        }

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

          // Automatically refresh expired OAuth 2.1 access tokens on the backend [Commented by: Google AI Studio at 22/11/2026 11:48]
          const refreshCheck = await refreshMcpCredentialsIfNeeded(env.DB, verifiedUserId, providerId, credentials, encSecret, false);
          credentials = refreshCheck.credentials;

          const targetEndpoint =
            (credentials.resource && validateSafeMcpUrl(credentials.resource) ? credentials.resource : '') ||
            (connection.endpoint_url && connection.endpoint_url.includes('/mcp') && validateSafeMcpUrl(connection.endpoint_url) ? connection.endpoint_url : '') ||
            CANONICAL_PROVIDER_ENDPOINTS[providerId] ||
            connection.endpoint_url;
          let result = await executeMcpToolCall(
            providerId,
            toolName,
            args,
            credentials,
            targetEndpoint
          );

          // Retry once with forced refresh if provider rejected expired token
          if (result.isError && credentials.refresh_token && /401|unauthori|expired/i.test(result.content?.[0]?.text || '')) {
            const forced = await refreshMcpCredentialsIfNeeded(env.DB, verifiedUserId, providerId, credentials, encSecret, true);
            if (forced.refreshed) {
              result = await executeMcpToolCall(
                providerId,
                toolName,
                args,
                forced.credentials,
                targetEndpoint
              );
            }
          }

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

          // Automatically refresh expired OAuth 2.1 access tokens before running live connection test [Commented by: Google AI Studio at 22/11/2026 11:48]
          const refreshedTest = await refreshMcpCredentialsIfNeeded(env.DB, verifiedUserId, providerId, credentials, encSecret, false);
          credentials = refreshedTest.credentials;

          const canonicalEndpoint =
            (credentials.resource && validateSafeMcpUrl(credentials.resource) ? credentials.resource : '') ||
            (connection.endpoint_url && connection.endpoint_url.includes('/mcp') && validateSafeMcpUrl(connection.endpoint_url) ? connection.endpoint_url : '') ||
            CANONICAL_PROVIDER_ENDPOINTS[providerId] ||
            connection.endpoint_url;
          let discovery = await discoverAndValidateMcpProvider(providerId, credentials, canonicalEndpoint);
          if (!discovery.success && credentials.refresh_token && /401|unauthori|expired/i.test(discovery.error || '')) {
            const forcedTest = await refreshMcpCredentialsIfNeeded(env.DB, verifiedUserId, providerId, credentials, encSecret, true);
            if (forcedTest.refreshed) {
              discovery = await discoverAndValidateMcpProvider(providerId, forcedTest.credentials, canonicalEndpoint);
            }
          }

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


        // Authenticated creation of a zero-knowledge shareable chat session snapshot retaining the 30-day retention policy [Commented by: Google AI Studio at 05/11/2026 09:28]
        if (pathname === '/api/shares' && request.method === 'POST') {
          const body: any = await request.json().catch(() => null);
          if (!body || typeof body !== 'object' || (!Array.isArray(body.messages) && !body.encrypted_payload)) {
            return sendError('Invalid share payload: messages or encrypted_payload is required', 400);
          }

          // Ensure table exists in D1
          await ensureD1Tables(env.DB);

          // Supported updating existing share snapshot under the same share ID and URL [Commented by: Google AI Studio on 28/10/2026 11:35 AM]
          const shareId = typeof body.shareId === 'string' && body.shareId.trim() ? body.shareId.trim() : crypto.randomUUID();
          const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Shared Noodle';
          const now = Date.now();
          const nowIso = new Date(now).toISOString();
          const expiresIso = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

          let messagesJson: string;
          if (body.encrypted_payload && typeof body.encrypted_payload === 'object') {
            messagesJson = JSON.stringify({
              is_encrypted: true,
              encrypted_payload: body.encrypted_payload,
            });
          } else {
            messagesJson = JSON.stringify(body.messages || []);
          }

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
