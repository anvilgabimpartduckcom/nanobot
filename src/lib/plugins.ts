// {Created MCP plugins registry for Google Drive, Gmail, Docs, Notion, Firecrawl, and Tavily} [Commented by: Google AI Studio on 12/10/2026 10:53 AM]

export interface PluginDefinition {
  id: string;
  name: string;
  iconUrl: string;
  description: string;
  mcpServerName: string;
  tools: {
    name: string;
    description: string;
  }[];
}

export const MCP_PLUGINS: PluginDefinition[] = [
  {
    id: 'google_drive',
    name: 'Google Drive',
    iconUrl: 'https://ssl.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png',
    description: 'Access, search, and retrieve files and documents stored in your Google Drive via MCP.',
    mcpServerName: '@modelcontextprotocol/server-gdrive',
    tools: [
      { name: 'search_drive_files', description: 'Search files across Google Drive by name or contents' },
      { name: 'read_drive_file', description: 'Retrieve and parse content of Google Drive files' },
      { name: 'upload_drive_file', description: 'Create and save files to Google Drive folders' }
    ]
  },
  {
    id: 'gmail',
    name: 'Gmail',
    iconUrl: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
    description: 'Read mail threads, draft messages, and search inbox with Gmail MCP server integration.',
    mcpServerName: '@modelcontextprotocol/server-gmail',
    tools: [
      { name: 'search_emails', description: 'Query Gmail threads by sender, subject, or query term' },
      { name: 'read_email', description: 'Read email body, attachments metadata, and replies' },
      { name: 'draft_email', description: 'Prepare draft email message for review' }
    ]
  },
  {
    id: 'google_docs',
    name: 'Google Docs',
    iconUrl: 'https://ssl.gstatic.com/images/branding/product/2x/docs_2020q4_48dp.png',
    description: 'Directly compose, read, and append collaborative text to Google Docs.',
    mcpServerName: '@modelcontextprotocol/server-gdocs',
    tools: [
      { name: 'create_doc', description: 'Create a new Google Document' },
      { name: 'get_doc_content', description: 'Read structured document headings and paragraphs' },
      { name: 'append_to_doc', description: 'Append Markdown or formatted text to Google Doc' }
    ]
  },
  {
    id: 'notion',
    name: 'Notion',
    iconUrl: 'https://www.notion.so/front-static/favicon.ico',
    description: 'Read and update workspaces, databases, project tasks, and notion notes.',
    mcpServerName: '@modelcontextprotocol/server-notion',
    tools: [
      { name: 'search_notion_pages', description: 'Search Notion pages and databases by title' },
      { name: 'read_notion_page', description: 'Retrieve blocks and properties of Notion page' },
      { name: 'create_notion_page', description: 'Create new database items or doc pages' }
    ]
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    iconUrl: 'https://www.firecrawl.dev/favicon.ico',
    description: 'Turn entire websites into clean Markdown and crawl deep web pages for LLMs.',
    mcpServerName: '@mendable/firecrawl-mcp-server',
    tools: [
      { name: 'crawl_url', description: 'Recursively crawl web pages under a given domain' },
      { name: 'scrape_markdown', description: 'Extract clean markdown, headers, and media from any URL' },
      { name: 'map_site', description: 'Map entire site map hierarchy and subpages' }
    ]
  },
  {
    id: 'tavily',
    name: 'Tavily',
    iconUrl: 'https://app.tavily.com/favicon.ico',
    description: 'Real-time autonomous web search, extract, and QnA optimized for AI agents.',
    mcpServerName: '@tavily/mcp-server',
    tools: [
      { name: 'tavily_web_search', description: 'Query real-time web news and factual information' },
      { name: 'tavily_qna_search', description: 'Answer questions directly with verified citations' },
      { name: 'tavily_extract_url', description: 'Extract clean web text and content from specific URL' }
    ]
  }
];
