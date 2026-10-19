// {Updated MCP plugins registry with OAuth2 scopes, comprehensive tool descriptions, and permission metadata} [Commented by: Google AI Studio on 19/10/2026 10:46 AM]

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
      'Create and organize Google Drive folder hierarchies',
      'Allow nanobot to invoke Google Drive MCP tools on your request'
    ],
    tools: [
      { name: 'search_drive_files', description: 'Search files and folders across Google Drive by name, query, or text contents' },
      { name: 'read_drive_file', description: 'Retrieve and parse full contents of Google Drive documents, text files, and spreadsheets' },
      { name: 'upload_drive_file', description: 'Create and save new files or text content directly into specified Google Drive folders' },
      { name: 'list_drive_files', description: 'List files and subfolders within a directory with metadata, sorting, and pagination' },
      { name: 'create_drive_folder', description: 'Create a new organized folder directory in Google Drive' },
      { name: 'delete_drive_file', description: 'Move a specified file or folder to the Google Drive Trash' },
      { name: 'share_drive_file', description: 'Manage file sharing access permissions and generate shareable links' },
      { name: 'get_drive_file_metadata', description: 'Retrieve complete file metadata including modified timestamp, owner, file size, and MIME type' },
      { name: 'export_drive_doc', description: 'Export Google Docs, Sheets, or Slides into standard formats (PDF, Markdown, or plain text)' }
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
      'List and manage labels, stars, and archiving',
      'Allow nanobot to execute Gmail MCP actions safely'
    ],
    tools: [
      { name: 'search_emails', description: 'Query Gmail messages and conversation threads using search syntax (from, to, subject, has:attachment)' },
      { name: 'read_email', description: 'Read full email body, header metadata, thread context, and attached filenames' },
      { name: 'send_email', description: 'Send an email message to specified recipients with subject and body' },
      { name: 'draft_email', description: 'Create, update, or save a draft email message for your review before sending' },
      { name: 'reply_email', description: 'Reply directly to an existing email conversation thread' },
      { name: 'list_labels', description: 'List all inbox labels, user-defined tags, categories, and folder names' },
      { name: 'manage_labels', description: 'Apply or remove labels from messages and archive conversation threads' },
      { name: 'delete_email', description: 'Move an email message or entire thread to the Trash' },
      { name: 'get_unread_count', description: 'Get total count and brief summaries of unread messages in your primary inbox' }
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
      'Append text, Markdown, lists, and formatted content to existing documents',
      'Allow nanobot to execute Google Docs MCP tools on your command'
    ],
    tools: [
      { name: 'create_doc', description: 'Create a new blank Google Document with a custom title' },
      { name: 'get_doc_content', description: 'Read full structured document text, paragraphs, headings, bullet lists, and tables' },
      { name: 'append_to_doc', description: 'Append text, formatted Markdown, or notes to the end of an existing Google Document' },
      { name: 'insert_text', description: 'Insert formatted text or hyperlinks at a specific document character index' },
      { name: 'replace_text', description: 'Find and replace all occurrences of specified text throughout a document' },
      { name: 'get_doc_metadata', description: 'Retrieve document revision ID, character count, and last edited timestamp' },
      { name: 'format_paragraph', description: 'Apply headings (H1, H2, H3), bold, blockquote, or code formatting to paragraphs' }
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
    scopes: [
      'notion.pages.read',
      'notion.pages.write',
      'notion.databases.read',
      'notion.databases.write'
    ],
    permissions: [
      'Search and access pages and databases in your authorized Notion workspace',
      'Read block contents, properties, callouts, and databases',
      'Create new pages, notes, and task items in databases',
      'Update existing page content and database properties'
    ],
    tools: [
      { name: 'search_notion_pages', description: 'Search workspace pages and databases by title, tag, or keyword' },
      { name: 'read_notion_page', description: 'Retrieve page properties, child blocks, headings, callouts, and text contents' },
      { name: 'create_notion_page', description: 'Create a new page under a parent page or inside a Notion database with properties' },
      { name: 'update_notion_page', description: 'Update page title, properties, status tags, and icon/cover settings' },
      { name: 'append_notion_block', description: 'Append child blocks (headings, paragraphs, todo checklists, code snippets) to a page' },
      { name: 'query_database', description: 'Run filtered and sorted queries against Notion databases to extract items' },
      { name: 'create_database', description: 'Create a new structured Notion database with custom property schemas' },
      { name: 'retrieve_database', description: 'Get schema definition, properties, and relation types of a Notion database' }
    ]
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    iconUrl: 'https://www.firecrawl.dev/favicon.ico',
    description: 'Turn entire websites into clean Markdown and crawl deep web pages for LLM context via MCP.',
    mcpServerName: '@mendable/firecrawl-mcp-server',
    authType: 'api_key',
    scopes: [
      'firecrawl:crawl',
      'firecrawl:scrape',
      'firecrawl:map'
    ],
    permissions: [
      'Recursively crawl websites and extract page contents as clean Markdown',
      'Map site hierarchies and URL subpaths',
      'Extract structured JSON data from web pages using LLM prompts'
    ],
    tools: [
      { name: 'crawl_url', description: 'Recursively crawl all web pages under a given domain with depth, page limit, and sitemap support' },
      { name: 'scrape_markdown', description: 'Scrape a single web URL into clean, LLM-ready Markdown, extracting headers and clean text' },
      { name: 'map_site', description: 'Generate a fast URL sitemap and discover all subpaths and routes on a domain' },
      { name: 'extract_data', description: 'Use schema-guided LLM extraction to pull structured JSON data from a web page' },
      { name: 'check_crawl_status', description: 'Check asynchronous crawl job progress and download completed page batches' },
      { name: 'batch_scrape_urls', description: 'Scrape multiple URLs concurrently with error handling and deduplication' }
    ]
  }
];
