// Equipped all plugins with full suites of read, write, and action tools [Commented by: Google AI Studio on 30/10/2026 10:48 AM]

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
    description: 'Execute D1 database queries, manage Workers scripts, update DNS records, and manipulate Cloudflare R2 object storage.',
    mcpServerName: '@modelcontextprotocol/server-cloudflare',
    authType: 'oauth',
    oauthProvider: 'Cloudflare',
    scopes: ['workers:read', 'workers:write', 'd1:read', 'd1:write', 'r2:read', 'r2:write', 'dns:read', 'dns:write'],
    permissions: [
      'Query and update Cloudflare D1 SQL database tables, schemas, and rows',
      'Deploy, configure, and inspect Worker scripts, bindings, and routes',
      'Upload, download, list, and delete Cloudflare R2 storage bucket objects',
      'Manage DNS records and purge CDN cache on Cloudflare domains'
    ],
    tools: [
      { name: 'execute_d1_query', description: 'Execute SELECT, INSERT, UPDATE, or DELETE SQL queries on Cloudflare D1' },
      { name: 'manage_d1_schema', description: 'Create, alter, or drop tables and indices in your Cloudflare D1 database' },
      { name: 'deploy_worker', description: 'Deploy or update a Cloudflare Worker script, routes, and environment bindings' },
      { name: 'list_workers', description: 'Inspect deployed Cloudflare Workers, environment details, and execution logs' },
      { name: 'manage_r2_object', description: 'Upload, download, or delete objects within Cloudflare R2 storage buckets' },
      { name: 'update_dns_record', description: 'Create, update, or delete DNS records for your configured Cloudflare zones' },
      { name: 'purge_cache', description: 'Purge Cloudflare CDN edge cache by exact URL, prefix, or cache tag' }
    ]
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    iconUrl: 'https://www.firecrawl.dev/favicon.ico',
    description: 'Turn entire websites into clean Markdown, crawl deep web pages, and map site sitemaps for LLM context via MCP.',
    mcpServerName: '@mendable/firecrawl-mcp-server',
    authType: 'api_key',
    scopes: ['firecrawl:crawl', 'firecrawl:scrape', 'firecrawl:map'],
    permissions: [
      'Recursively crawl websites and extract page contents as clean Markdown',
      'Map site hierarchies and URL subpaths',
      'Extract structured JSON data from web pages using LLM prompts'
    ],
    tools: [
      { name: 'scrape_markdown', description: 'Scrape a single web URL into clean, LLM-ready Markdown' },
      { name: 'crawl_url', description: 'Recursively crawl all web pages under a given domain with depth and sitemap support' },
      { name: 'map_site', description: 'Generate a fast URL sitemap and discover all subpaths on a domain' },
      { name: 'extract_structured_data', description: 'Extract structured JSON entities from web pages based on a provided schema' }
    ]
  },
  {
    id: 'github',
    name: 'GitHub',
    iconUrl: 'https://github.githubassets.com/favicons/favicon.png',
    description: 'Read and write repositories, commit code, search files, create issues and pull requests, and manage branches via GitHub MCP.',
    mcpServerName: '@modelcontextprotocol/server-github',
    authType: 'oauth',
    oauthProvider: 'GitHub',
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
      { name: 'create_repository', description: 'Create a new GitHub repository (public or private) under your account or organization' },
      { name: 'list_issues', description: 'List open and closed issues or pull requests for a repository' },
      { name: 'create_issue', description: 'Create a new issue with title, description, labels, and assignees' },
      { name: 'create_pull_request', description: 'Open a new pull request across branches in a repository' },
      { name: 'merge_pull_request', description: 'Merge an approved pull request into the base branch' }
    ]
  },
  {
    id: 'gmail',
    name: 'Gmail',
    iconUrl: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
    description: 'Read mail threads, compose drafts, send emails, manage labels, and organize your inbox with Gmail MCP server integration.',
    mcpServerName: '@modelcontextprotocol/server-gmail',
    authType: 'oauth',
    oauthProvider: 'Google',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels'
    ],
    permissions: [
      'Search and read email threads, messages, and attachments in your inbox',
      'Create, edit, and send emails directly to recipients',
      'Reply or reply-all to existing conversation threads',
      'Create, assign, or delete labels and organize emails into folders'
    ],
    tools: [
      { name: 'search_emails', description: 'Query Gmail messages and conversation threads using search syntax' },
      { name: 'read_email', description: 'Read full email body, header metadata, and thread context' },
      { name: 'draft_email', description: 'Create or update a draft email message for your review' },
      { name: 'send_email', description: 'Send an email directly with recipient, subject, body, and attachments' },
      { name: 'reply_to_email', description: 'Reply to an existing conversation thread or email message' },
      { name: 'manage_labels', description: 'Add, remove, or modify labels on emails (Star, Archive, Trash, Custom)' }
    ]
  },
  {
    id: 'google_docs',
    name: 'Google Docs',
    iconUrl: 'https://ssl.gstatic.com/images/branding/product/2x/docs_2020q4_48dp.png',
    description: 'Directly compose, read, format, update, and append collaborative text and outlines to Google Docs via MCP.',
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
      'Append text, Markdown, lists, and formatted content to existing documents',
      'Update, format, and replace text and paragraph styles in documents'
    ],
    tools: [
      { name: 'create_doc', description: 'Create a new blank Google Document with a custom title' },
      { name: 'get_doc_content', description: 'Read full structured document text, paragraphs, headings, and tables' },
      { name: 'append_to_doc', description: 'Append text or formatted notes to an existing Google Document' },
      { name: 'update_doc_content', description: 'Replace or insert text at specific character indexes in a document' },
      { name: 'format_document', description: 'Apply headings, bold/italic, bullet lists, and styles to a document' }
    ]
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    iconUrl: 'https://ssl.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png',
    description: 'Access, search, upload, create folders, share, and manage files and documents stored in your Google Drive via MCP.',
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
      'Create and organize Google Drive folder hierarchies and share files'
    ],
    tools: [
      { name: 'search_drive_files', description: 'Search files and folders across Google Drive by query' },
      { name: 'read_drive_file', description: 'Retrieve and parse full contents of Google Drive documents' },
      { name: 'upload_file', description: 'Upload a new file or document directly to Google Drive' },
      { name: 'create_folder', description: 'Create a new folder directory in your Google Drive' },
      { name: 'delete_file', description: 'Move a file or folder to trash or permanently remove it' },
      { name: 'share_file', description: 'Update sharing permissions for a file or folder with specified users' }
    ]
  },
  {
    id: 'netlify',
    name: 'Netlify',
    iconUrl: 'https://www.netlify.com/favicon.ico',
    description: 'Deploy sites, trigger builds, manage environment variables, inspect build logs, and manage domains on Netlify.',
    mcpServerName: '@modelcontextprotocol/server-netlify',
    authType: 'oauth',
    oauthProvider: 'Netlify',
    scopes: ['sites:read', 'sites:write', 'deploys:read', 'deploys:write', 'builds:read', 'builds:write'],
    permissions: [
      'View and create deployed Netlify sites, domains, and production URLs',
      'Trigger new deploy builds or redeployments from Git branches',
      'Manage environment variables for production and preview contexts',
      'Configure custom domains and rollback to previous site releases'
    ],
    tools: [
      { name: 'list_sites', description: 'List all active Netlify sites, build status, and custom domains' },
      { name: 'create_site', description: 'Create a new Netlify website application with custom name and repo link' },
      { name: 'trigger_deploy', description: 'Trigger a new deployment build or clear build cache on Netlify' },
      { name: 'get_latest_deploy', description: 'Fetch latest deploy status, build logs, and deployment details' },
      { name: 'manage_env_vars', description: 'Create, update, or remove Netlify environment variables' },
      { name: 'rollback_deploy', description: 'Rollback a Netlify site to a previously published deploy ID' }
    ]
  },
  {
    id: 'notion',
    name: 'Notion',
    iconUrl: 'https://www.notion.so/front-static/favicon.ico',
    description: 'Read and update workspace pages, query databases, create project trackers, and append content in Notion via MCP.',
    mcpServerName: '@modelcontextprotocol/server-notion',
    authType: 'oauth',
    oauthProvider: 'Notion',
    scopes: ['notion.pages.read', 'notion.pages.write', 'notion.databases.read', 'notion.databases.write'],
    permissions: [
      'Search and access pages and databases in your authorized Notion workspace',
      'Read block contents, properties, callouts, and databases',
      'Create new pages, notes, and task items in databases',
      'Update existing page content, properties, and append child blocks'
    ],
    tools: [
      { name: 'search_notion_pages', description: 'Search workspace pages and databases by title or keyword' },
      { name: 'read_notion_page', description: 'Retrieve page properties, child blocks, and text contents' },
      { name: 'create_notion_page', description: 'Create a new page inside a Notion database or under a parent page' },
      { name: 'update_notion_page', description: 'Edit page title, properties, or archive status' },
      { name: 'append_notion_block', description: 'Append paragraphs, headings, bullet lists, or callouts to a page' },
      { name: 'query_notion_database', description: 'Query and filter records within a Notion database' }
    ]
  },
  {
    id: 'slack',
    name: 'Slack',
    iconUrl: 'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png',
    description: 'Read and send channel messages, reply in threads, upload snippets, and manage channels via Slack MCP.',
    mcpServerName: '@modelcontextprotocol/server-slack',
    authType: 'oauth',
    oauthProvider: 'Slack',
    scopes: ['channels:read', 'channels:history', 'chat:write', 'users:read', 'files:write'],
    permissions: [
      'Search and read messages in authorized Slack channels',
      'Post messages or summaries directly to specified channels',
      'Reply in message threads and upload text or file snippets',
      'List channels, user profiles, and active workspace members'
    ],
    tools: [
      { name: 'list_channels', description: 'List public channels in the authorized Slack workspace' },
      { name: 'get_channel_history', description: 'Retrieve recent messages and conversation threads from a channel' },
      { name: 'post_message', description: 'Send a message or announcement to a Slack channel' },
      { name: 'reply_in_thread', description: 'Reply directly to a specific message thread in Slack' },
      { name: 'upload_slack_file', description: 'Share a code snippet or document into a Slack channel' },
      { name: 'set_channel_topic', description: 'Update the topic or description for a Slack channel' }
    ]
  },
  {
    id: 'supabase',
    name: 'Supabase',
    iconUrl: 'https://supabase.com/favicon/favicon-32x32.png',
    description: 'Query, insert, update, and delete PostgreSQL rows, execute SQL queries, and manage storage via Supabase MCP.',
    mcpServerName: '@modelcontextprotocol/server-supabase',
    authType: 'oauth',
    oauthProvider: 'Supabase',
    scopes: ['projects:read', 'database:read', 'database:write', 'storage:read', 'storage:write'],
    permissions: [
      'Query tables and schema definitions in your Supabase project',
      'Insert, update, and delete table records with parameterized safety',
      'Execute SQL queries, DDL migrations, and inspect RLS policies',
      'Manage Supabase storage buckets and upload/download bucket files'
    ],
    tools: [
      { name: 'list_tables', description: 'List all tables, column schemas, and types in the public schema' },
      { name: 'query_table', description: 'Query records from a specific table with filters, order, and limit' },
      { name: 'insert_row', description: 'Insert one or more new records into a Supabase table' },
      { name: 'update_row', description: 'Update existing table records matching specified conditions' },
      { name: 'delete_row', description: 'Delete records from a Supabase table matching specified conditions' },
      { name: 'execute_sql', description: 'Execute raw SQL queries, DDL statements, or administrative functions' },
      { name: 'manage_storage', description: 'Upload, download, or delete files in Supabase Storage buckets' }
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
