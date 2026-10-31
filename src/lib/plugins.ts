// Model Context Protocol (MCP) plugin catalogue with consumer-grade authorization metadata [Commented by: Google AI Studio on 31/10/2026 10:52 AM]

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface PluginDefinition {
  id: string;
  name: string;
  iconUrl: string;
  description: string;
  mcpServerName: string;
  mcpEndpoint?: string;
  authType: 'oauth' | 'api_key';
  oauthProvider?: 'google' | 'github';
  oauthScopes?: string[];
  credentialLabel: string;
  credentialPlaceholder: string;
  helpUrl?: string;
  helpActionText?: string;
  whyTokenText?: string;
  scopes: string[];
  permissions: string[];
  tools: MCPToolDefinition[];
}

export const MCP_PLUGINS: PluginDefinition[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    iconUrl: 'https://www.cloudflare.com/favicon.ico',
    description: 'Execute D1 database queries, manage Workers scripts, update DNS records, and manipulate Cloudflare R2 object storage.',
    mcpServerName: 'cloudflare-mcp',
    mcpEndpoint: 'https://mcp.cloudflare.com/mcp',
    authType: 'api_key',
    credentialLabel: 'Cloudflare API Token',
    credentialPlaceholder: 'Paste your Cloudflare API token',
    helpUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    helpActionText: 'Open Cloudflare API Tokens',
    whyTokenText: 'Cloudflare uses scoped API Tokens so you can grant Nanobot exact permissions (Workers, D1 SQL, R2, DNS) and revoke access at any time from your Cloudflare dashboard.',
    scopes: ['workers:read', 'workers:write', 'd1:read', 'd1:write', 'r2:read', 'r2:write', 'dns:read', 'dns:write'],
    permissions: [
      'Search Cloudflare product API documentation and parameters dynamically',
      'Execute authenticated Cloudflare API requests against Workers, D1 SQL, R2, and DNS',
      'Inspect configuration and deployment logs directly from Cloudflare servers'
    ],
    tools: [
      { name: 'search', description: 'Search Cloudflare documentation and available API endpoints for Workers, D1, R2, and DNS' },
      { name: 'execute', description: 'Execute an authenticated Cloudflare API operation across Workers, D1 SQL, R2, and DNS zones' },
      { name: 'docs', description: 'Fetch technical reference documentation for a Cloudflare product or capability' }
    ]
  },
  {
    id: 'github',
    name: 'GitHub',
    iconUrl: 'https://github.githubassets.com/favicons/favicon.png',
    description: 'Search code repositories, read files, commit code updates, create issues, and open pull requests directly through Nanobot.',
    mcpServerName: 'github-mcp',
    mcpEndpoint: 'https://api.github.com',
    authType: 'oauth',
    oauthProvider: 'github',
    oauthScopes: ['repo', 'read:user', 'workflow'],
    credentialLabel: 'GitHub Personal Access Token',
    credentialPlaceholder: 'Paste your GitHub Personal Access Token (ghp_...)',
    helpUrl: 'https://github.com/settings/tokens?type=beta',
    helpActionText: 'Create Token on GitHub',
    whyTokenText: 'GitHub allows you to securely connect using official OAuth authorization or a scoped Personal Access Token with repository access permissions.',
    scopes: ['repo', 'read:user', 'read:org', 'workflow'],
    permissions: [
      'Access and search repository code, branches, commits, and directories',
      'Create and update files, commit changes, and push code to repository branches',
      'Create and manage GitHub issues, pull requests, and discussion comments',
      'Create new public or private repositories and manage repository settings'
    ],
    tools: [
      { name: 'search_repositories', description: 'Search GitHub repositories, code files, and topics' },
      { name: 'get_file_contents', description: 'Read file contents from a specific repository, branch, or commit' },
      { name: 'create_or_update_file', description: 'Commit and push code changes directly to a file in a GitHub repository' },
      { name: 'list_issues', description: 'List open and closed issues or pull requests for a repository' },
      { name: 'create_issue', description: 'Create a new issue with title, description, labels, and assignees' },
      { name: 'create_pull_request', description: 'Open a new pull request across branches in a repository' }
    ]
  },
  {
    id: 'netlify',
    name: 'Netlify',
    iconUrl: 'https://www.netlify.com/favicon.ico',
    description: 'Inspect deployed sites, trigger new deploy builds, check build logs, and manage environment variables directly through Nanobot.',
    mcpServerName: 'netlify-mcp',
    mcpEndpoint: 'https://netlify-mcp.netlify.app/mcp',
    authType: 'api_key',
    credentialLabel: 'Netlify Personal Access Token',
    credentialPlaceholder: 'Paste your Netlify token (nfp_...)',
    helpUrl: 'https://app.netlify.com/user/applications#personal-access-tokens',
    helpActionText: 'Open Netlify Access Tokens',
    whyTokenText: 'Netlify uses Personal Access Tokens to securely inspect deployed sites, check build logs, and manage environment variables on your behalf.',
    scopes: ['sites:read', 'sites:write', 'deploys:read', 'deploys:write', 'builds:read', 'builds:write'],
    permissions: [
      'View and create deployed Netlify sites, domains, and production URLs',
      'Trigger new deploy builds or redeployments from Git branches',
      'Inspect build logs and deployment details',
      'Manage environment variables for production and preview contexts'
    ],
    tools: [
      { name: 'list_sites', description: 'List active Netlify sites, deploy domains, and site configurations' },
      { name: 'get_site', description: 'Inspect a specific Netlify site by site ID or domain name' },
      { name: 'trigger_deploy', description: 'Trigger a new deploy or rebuild for a Netlify site' },
      { name: 'list_deploys', description: 'Fetch recent deployments and build statuses for a Netlify site' },
      { name: 'get_env_vars', description: 'List environment variables configured for a Netlify site or account' }
    ]
  },
  {
    id: 'supabase',
    name: 'Supabase',
    iconUrl: 'https://supabase.com/favicon/favicon-32x32.png',
    description: 'List Supabase projects, inspect database tables, execute SQL queries, and monitor database health.',
    mcpServerName: 'supabase-mcp',
    mcpEndpoint: 'https://api.supabase.com',
    authType: 'api_key',
    credentialLabel: 'Supabase Personal Access Token',
    credentialPlaceholder: 'Paste your Supabase token (sbp_...)',
    helpUrl: 'https://supabase.com/dashboard/account/tokens',
    helpActionText: 'Open Supabase Access Tokens',
    whyTokenText: 'Supabase uses Personal Access Tokens to securely list your projects, inspect database schemas, and run SQL queries through the official Supabase Management API.',
    scopes: ['projects:read', 'database:read', 'database:write'],
    permissions: [
      'List projects, organization details, and connection hosts in your Supabase account',
      'Execute SQL queries, DDL migrations, and inspect RLS policies via Management API',
      'Inspect database schemas, tables, and column configurations'
    ],
    tools: [
      { name: 'list_projects', description: 'List all Supabase projects accessible to your account' },
      { name: 'get_project', description: 'Get project configuration, database host, and status for a Supabase project ref' },
      { name: 'execute_sql', description: 'Run SQL statements against a Supabase database via the Management API' },
      { name: 'list_tables', description: 'Inspect schemas and tables in a Supabase project' }
    ]
  },
  {
    id: 'google_docs',
    name: 'Google Docs',
    iconUrl: 'https://ssl.gstatic.com/images/branding/product/2x/docs_2020q4_48dp.png',
    description: 'Create new documents, read their contents, format paragraphs, and append text or meeting notes directly through Nanobot.',
    mcpServerName: 'gdocs-mcp',
    mcpEndpoint: 'https://docs.googleapis.com',
    authType: 'oauth',
    oauthProvider: 'google',
    oauthScopes: ['https://www.googleapis.com/auth/documents'],
    credentialLabel: 'Google Account Authorization',
    credentialPlaceholder: 'Google OAuth token (or click Connect Google Account)',
    helpUrl: 'https://myaccount.google.com/permissions',
    helpActionText: 'Manage Google Account Permissions',
    whyTokenText: 'Google Docs uses official Google OAuth authorization so you can securely grant document access without sharing your password.',
    scopes: ['https://www.googleapis.com/auth/documents'],
    permissions: [
      'Create new Google Documents in your Google Drive when asked',
      'Read and extract structured paragraphs and tables from documents',
      'Append text, notes, and formatted summaries to existing documents'
    ],
    tools: [
      { name: 'create_doc', description: 'Create a new blank Google Document with a custom title' },
      { name: 'get_doc_content', description: 'Read structured document text and paragraphs' },
      { name: 'append_to_doc', description: 'Append text or formatted notes to an existing Google Document' }
    ]
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    iconUrl: 'https://ssl.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png',
    description: 'Search files and folders in your Google Drive, read document contents, and organize files directly through Nanobot.',
    mcpServerName: 'gdrive-mcp',
    mcpEndpoint: 'https://www.googleapis.com',
    authType: 'oauth',
    oauthProvider: 'google',
    oauthScopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.file'],
    credentialLabel: 'Google Account Authorization',
    credentialPlaceholder: 'Google OAuth token (or click Connect Google Account)',
    helpUrl: 'https://myaccount.google.com/permissions',
    helpActionText: 'Manage Google Account Permissions',
    whyTokenText: 'Google Drive uses official Google OAuth authorization so Nanobot can locate and inspect files you ask about safely.',
    scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.file'],
    permissions: [
      'View and search files, metadata, and folders in your Google Drive',
      'Read and download file contents you ask about in conversation',
      'Create and organize Google Drive folder hierarchies'
    ],
    tools: [
      { name: 'search_drive_files', description: 'Search files and folders across Google Drive by query' },
      { name: 'read_drive_file', description: 'Retrieve and parse full contents of Google Drive documents' },
      { name: 'create_folder', description: 'Create a new folder directory in your Google Drive' }
    ]
  },
  {
    id: 'gmail',
    name: 'Gmail',
    iconUrl: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
    description: 'Search email threads, read messages in your inbox, compose drafts, and send emails directly through Nanobot.',
    mcpServerName: 'gmail-mcp',
    mcpEndpoint: 'https://gmail.googleapis.com',
    authType: 'oauth',
    oauthProvider: 'google',
    oauthScopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.compose'],
    credentialLabel: 'Google Account Authorization',
    credentialPlaceholder: 'Google OAuth token (or click Connect Google Account)',
    helpUrl: 'https://myaccount.google.com/permissions',
    helpActionText: 'Manage Google Account Permissions',
    whyTokenText: 'Gmail uses official Google OAuth authorization. Nanobot can read email threads and draft responses only when you ask.',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.compose'],
    permissions: [
      'Search and read email threads and messages in your inbox',
      'Create drafts and send emails directly through Gmail'
    ],
    tools: [
      { name: 'search_emails', description: 'Query Gmail messages and conversation threads using search syntax' },
      { name: 'read_email', description: 'Read full email body, header metadata, and thread context' },
      { name: 'send_email', description: 'Send an email directly with recipient, subject, and body' },
      { name: 'draft_email', description: 'Create or update a draft email message for your review' }
    ]
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    iconUrl: 'https://www.firecrawl.dev/favicon.ico',
    description: 'Turn entire websites into clean Markdown, crawl subpages, and map site sitemaps for deep AI analysis.',
    mcpServerName: 'firecrawl-mcp',
    mcpEndpoint: 'https://api.firecrawl.dev',
    authType: 'api_key',
    credentialLabel: 'Firecrawl API Key',
    credentialPlaceholder: 'Paste your Firecrawl API Key (fc-...)',
    helpUrl: 'https://www.firecrawl.dev/app/api-keys',
    helpActionText: 'Open Firecrawl API Keys',
    whyTokenText: 'Firecrawl uses an API key to crawl entire websites and turn web pages into clean Markdown for deep LLM analysis.',
    scopes: ['firecrawl:crawl', 'firecrawl:scrape', 'firecrawl:map'],
    permissions: [
      'Recursively crawl websites and extract page contents as clean Markdown',
      'Map site hierarchies and URL subpaths',
      'Extract structured data from web pages'
    ],
    tools: [
      { name: 'scrape_url', description: 'Scrape a single web URL into clean, LLM-ready Markdown' },
      { name: 'crawl_url', description: 'Recursively crawl all web pages under a given domain with depth and sitemap support' },
      { name: 'map_site', description: 'Generate a fast URL sitemap and discover all subpaths on a domain' }
    ]
  },
  {
    id: 'tavily',
    name: 'Tavily',
    iconUrl: 'https://tavily.com/favicon.ico',
    description: 'Execute deep real-time web searches, query intelligence, and scrape full webpage Markdown content.',
    mcpServerName: 'tavily-mcp',
    mcpEndpoint: 'https://api.tavily.com',
    authType: 'api_key',
    credentialLabel: 'Tavily API Key',
    credentialPlaceholder: 'Paste your Tavily API Key (tvly-...)',
    helpUrl: 'https://app.tavily.com/home',
    helpActionText: 'Open Tavily Dashboard',
    whyTokenText: 'Tavily uses an API key to execute real-time web searches and factual research for Nanobot.',
    scopes: ['search', 'extract'],
    permissions: [
      'Perform web search queries with real-time news and fact retrieval',
      'Scrape complete clean text and Markdown from specified URLs'
    ],
    tools: [
      { name: 'search', description: 'Search the web for real-time information, news, and facts' },
      { name: 'extract', description: 'Extract clean readable content from specified URLs' }
    ]
  },
  {
    id: 'notion',
    name: 'Notion',
    iconUrl: 'https://www.notion.so/front-static/favicon.ico',
    description: 'Read and update workspace pages, query databases, create project trackers, and append content in Notion.',
    mcpServerName: 'notion-mcp',
    mcpEndpoint: 'https://api.notion.com',
    authType: 'api_key',
    credentialLabel: 'Notion Integration Secret',
    credentialPlaceholder: 'Paste your Notion token (secret_...)',
    helpUrl: 'https://www.notion.so/my-integrations',
    helpActionText: 'Open Notion Integrations',
    whyTokenText: 'Notion uses internal integration tokens so you can select exactly which workspace pages and databases Nanobot can access.',
    scopes: ['notion.pages.read', 'notion.pages.write', 'notion.databases.read', 'notion.databases.write'],
    permissions: [
      'Search and access pages and databases in your authorized Notion workspace',
      'Read block contents, properties, callouts, and databases',
      'Create new pages, notes, and task items in databases'
    ],
    tools: [
      { name: 'search_pages', description: 'Search workspace pages and databases by title or keyword' },
      { name: 'read_page', description: 'Retrieve page properties, child blocks, and text contents' },
      { name: 'create_page', description: 'Create a new page inside a Notion database or under a parent page' },
      { name: 'query_database', description: 'Query and filter records within a Notion database' }
    ]
  },
  {
    id: 'slack',
    name: 'Slack',
    iconUrl: 'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png',
    description: 'Read and send channel messages, reply in threads, upload snippets, and manage channels via Slack.',
    mcpServerName: 'slack-mcp',
    mcpEndpoint: 'https://slack.com',
    authType: 'api_key',
    credentialLabel: 'Slack Bot User Token',
    credentialPlaceholder: 'Paste your Slack Bot Token (xoxb-...)',
    helpUrl: 'https://api.slack.com/apps',
    helpActionText: 'Open Slack App Console',
    whyTokenText: 'Slack uses bot tokens (starting with xoxb-) to read and send messages in channels you authorize in your Slack workspace.',
    scopes: ['channels:read', 'channels:history', 'chat:write', 'users:read'],
    permissions: [
      'Search and read messages in authorized Slack channels',
      'Post messages or summaries directly to specified channels',
      'List channels and active workspace members'
    ],
    tools: [
      { name: 'list_channels', description: 'List public channels in the authorized Slack workspace' },
      { name: 'post_message', description: 'Send a message or announcement to a Slack channel' },
      { name: 'get_channel_history', description: 'Retrieve recent messages from a channel' }
    ]
  }
];
