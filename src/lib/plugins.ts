// Updated MCP plugins registry with alphabetical sorting and new add-ons for GitHub, Slack, Cloudflare, Supabase, Netlify [Commented by: Google AI Studio on 28/10/2026 04:22 AM]

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
  authType: 'oauth' | 'api_key';
  oauthProvider?: string;
  scopes: string[];
  permissions: string[];
  tools: MCPToolDefinition[];
}

export const MCP_PLUGINS: PluginDefinition[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    iconUrl: 'https://www.cloudflare.com/favicon.ico',
    description: 'Inspect D1 databases, manage Workers, query DNS records, and view Cloudflare R2 object storage buckets.',
    mcpServerName: '@modelcontextprotocol/server-cloudflare',
    authType: 'oauth',
    oauthProvider: 'Cloudflare',
    scopes: ['workers:read', 'workers:write', 'd1:read', 'd1:write', 'r2:read', 'dns:read'],
    permissions: [
      'Query and update Cloudflare D1 SQL database tables and rows',
      'Inspect Worker deployment logs, scripts, and bindings',
      'List and search Cloudflare R2 storage buckets and object keys',
      'View DNS zones and domain configurations'
    ],
    tools: [
      { name: 'query_d1', description: 'Execute a SQL query against your Cloudflare D1 database' },
      { name: 'list_workers', description: 'List deployed Cloudflare Workers, routes, and environment details' },
      { name: 'list_r2_buckets', description: 'Inspect R2 object storage buckets and files' }
    ]
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    iconUrl: 'https://www.firecrawl.dev/favicon.ico',
    description: 'Turn entire websites into clean Markdown and crawl deep web pages for LLM context via MCP.',
    mcpServerName: '@mendable/firecrawl-mcp-server',
    authType: 'api_key',
    scopes: ['firecrawl:crawl', 'firecrawl:scrape', 'firecrawl:map'],
    permissions: [
      'Recursively crawl websites and extract page contents as clean Markdown',
      'Map site hierarchies and URL subpaths',
      'Extract structured JSON data from web pages using LLM prompts'
    ],
    tools: [
      { name: 'crawl_url', description: 'Recursively crawl all web pages under a given domain with depth and sitemap support' },
      { name: 'scrape_markdown', description: 'Scrape a single web URL into clean, LLM-ready Markdown' },
      { name: 'map_site', description: 'Generate a fast URL sitemap and discover all subpaths on a domain' }
    ]
  },
  {
    id: 'github',
    name: 'GitHub',
    iconUrl: 'https://github.githubassets.com/favicons/favicon.png',
    description: 'Read repositories, search code, inspect issues and pull requests, and manage branches via GitHub MCP.',
    mcpServerName: '@modelcontextprotocol/server-github',
    authType: 'oauth',
    oauthProvider: 'GitHub',
    scopes: ['repo', 'read:user', 'read:org'],
    permissions: [
      'Access repository code, branches, commits, and directories',
      'Search codebase files and inspect pull requests and issues',
      'Create issues, pull requests, or comments with confirmation'
    ],
    tools: [
      { name: 'search_repositories', description: 'Search GitHub repositories by name, language, or topic' },
      { name: 'get_file_contents', description: 'Read file contents from a specific repository, branch, or commit' },
      { name: 'list_issues', description: 'List open and closed issues or pull requests for a repository' },
      { name: 'create_issue', description: 'Create a new issue in a GitHub repository' }
    ]
  },
  {
    id: 'gmail',
    name: 'Gmail',
    iconUrl: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
    description: 'Read mail threads, draft messages, organize labels, and search your inbox with Gmail MCP server integration.',
    mcpServerName: '@modelcontextprotocol/server-gmail',
    authType: 'oauth',
    oauthProvider: 'Google',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.labels'
    ],
    permissions: [
      'Search and read email threads, messages, and attachments in your inbox',
      'Create and update draft messages on your behalf',
      'Send emails with your explicit confirmation',
      'List and manage labels, stars, and archiving'
    ],
    tools: [
      { name: 'search_emails', description: 'Query Gmail messages and conversation threads using search syntax' },
      { name: 'read_email', description: 'Read full email body, header metadata, and thread context' },
      { name: 'draft_email', description: 'Create or update a draft email message for your review before sending' }
    ]
  },
  {
    id: 'google_docs',
    name: 'Google Docs',
    iconUrl: 'https://ssl.gstatic.com/images/branding/product/2x/docs_2020q4_48dp.png',
    description: 'Directly compose, read, format, and append collaborative text and outlines to Google Docs via MCP.',
    mcpServerName: '@modelcontextprotocol/server-gdocs',
    authType: 'oauth',
    oauthProvider: 'Google',
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file'
    ],
    permissions: [
      'Create new Google Documents in your account',
      'Read and extract structured paragraphs, tables, and headings from your documents',
      'Append text, Markdown, lists, and formatted content to existing documents'
    ],
    tools: [
      { name: 'create_doc', description: 'Create a new blank Google Document with a custom title' },
      { name: 'get_doc_content', description: 'Read full structured document text, paragraphs, headings, and tables' },
      { name: 'append_to_doc', description: 'Append text or formatted notes to an existing Google Document' }
    ]
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    iconUrl: 'https://ssl.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png',
    description: 'Access, search, and manage files, folders, and shared documents stored in your Google Drive via MCP.',
    mcpServerName: '@modelcontextprotocol/server-gdrive',
    authType: 'oauth',
    oauthProvider: 'Google',
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ],
    permissions: [
      'View and search files, metadata, and folders in your Google Drive',
      'Read and parse document text, sheets, and file contents',
      'Upload and save new files or exports to your Drive',
      'Create and organize Google Drive folder hierarchies'
    ],
    tools: [
      { name: 'search_drive_files', description: 'Search files and folders across Google Drive by query' },
      { name: 'read_drive_file', description: 'Retrieve and parse full contents of Google Drive documents' },
      { name: 'list_drive_files', description: 'List files and subfolders within a directory' }
    ]
  },
  {
    id: 'netlify',
    name: 'Netlify',
    iconUrl: 'https://www.netlify.com/favicon.ico',
    description: 'Manage deployed site previews, inspect build logs, monitor environment variables, and manage DNS on Netlify.',
    mcpServerName: '@modelcontextprotocol/server-netlify',
    authType: 'oauth',
    oauthProvider: 'Netlify',
    scopes: ['sites:read', 'sites:write', 'deploys:read', 'builds:read'],
    permissions: [
      'View deployed Netlify sites, domains, and production URLs',
      'Inspect deploy build logs, commit SHAs, and failure reasons',
      'Trigger new deploy builds or redeployments'
    ],
    tools: [
      { name: 'list_sites', description: 'List all active Netlify sites, build status, and custom domains' },
      { name: 'get_latest_deploy', description: 'Fetch latest deploy status and build logs for a site' }
    ]
  },
  {
    id: 'notion',
    name: 'Notion',
    iconUrl: 'https://www.notion.so/front-static/favicon.ico',
    description: 'Read and update workspace pages, databases, project task trackers, and Notion notes via MCP.',
    mcpServerName: '@modelcontextprotocol/server-notion',
    authType: 'oauth',
    oauthProvider: 'Notion',
    scopes: ['notion.pages.read', 'notion.pages.write', 'notion.databases.read', 'notion.databases.write'],
    permissions: [
      'Search and access pages and databases in your authorized Notion workspace',
      'Read block contents, properties, callouts, and databases',
      'Create new pages, notes, and task items in databases',
      'Update existing page content and database properties'
    ],
    tools: [
      { name: 'search_notion_pages', description: 'Search workspace pages and databases by title or keyword' },
      { name: 'read_notion_page', description: 'Retrieve page properties, child blocks, and text contents' },
      { name: 'create_notion_page', description: 'Create a new page inside a Notion database or under a parent page' }
    ]
  },
  {
    id: 'slack',
    name: 'Slack',
    iconUrl: 'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png',
    description: 'Read public and private channel messages, search conversation threads, and send messages via Slack MCP.',
    mcpServerName: '@modelcontextprotocol/server-slack',
    authType: 'oauth',
    oauthProvider: 'Slack',
    scopes: ['channels:read', 'channels:history', 'chat:write', 'users:read'],
    permissions: [
      'Search and read messages in authorized Slack channels',
      'Post messages or summaries to specified channels',
      'List channels, user profiles, and active workspace members'
    ],
    tools: [
      { name: 'list_channels', description: 'List public channels in the authorized Slack workspace' },
      { name: 'get_channel_history', description: 'Retrieve recent messages and conversation threads from a channel' },
      { name: 'post_message', description: 'Send a message to a Slack channel' }
    ]
  },
  {
    id: 'supabase',
    name: 'Supabase',
    iconUrl: 'https://supabase.com/favicon/favicon-32x32.png',
    description: 'Query PostgreSQL tables, inspect schema definitions, and query database records via Supabase MCP.',
    mcpServerName: '@modelcontextprotocol/server-supabase',
    authType: 'oauth',
    oauthProvider: 'Supabase',
    scopes: ['projects:read', 'database:read', 'database:write'],
    permissions: [
      'Query tables and schema definitions in your Supabase project',
      'Inspect Row Level Security (RLS) policies and table columns',
      'Execute parameterized SQL queries'
    ],
    tools: [
      { name: 'list_tables', description: 'List all tables and column schemas in public schema' },
      { name: 'query_table', description: 'Query records from a specific table with filters' }
    ]
  },
  {
    id: 'tavily',
    name: 'Tavily',
    iconUrl: 'https://tavily.com/favicon.ico',
    description: 'Execute deep real-time web searches, query intelligence, and scrape full webpage Markdown content.',
    mcpServerName: '@modelcontextprotocol/server-tavily',
    authType: 'api_key',
    scopes: ['search', 'extract'],
    permissions: [
      'Perform web search queries with real-time news and fact retrieval',
      'Scrape complete clean text and Markdown from arbitrary URLs'
    ],
    tools: [
      { name: 'search', description: 'Search the web for real-time information, news, and facts' },
      { name: 'extract', description: 'Extract clean readable content from a given URL' }
    ]
  }
];
