<!-- {Added Latest Updates section and updated MCP plugins reference in README.md} [Commented by: Google AI Studio on 19/10/2026 02:25 AM] -->

# Project Structure

```
nanobot/
├── .env.example                # Environment variable reference for Netlify and Cloudflare secrets
├── .github/
│   └── workflows/
│       ├── deploy-worker.yml   # Automated Cloudflare Worker deployment via Wrangler & GitHub Secrets
│       └── verify-frontend.yml # Automated PR & commit frontend typecheck, lockfile verification, and build
├── .gitignore                  # Git ignore rules for node_modules, build outputs, and local env files
├── index.html                  # HTML entry point with SEO, KaTeX & Highlight.js CSS
├── metadata.json               # Application identity metadata
├── netlify.toml                # Netlify SPA build and redirect rules
├── package.json                # Frontend Node.js dependencies and scripts
├── package-lock.json           # Exact resolved dependency tree for reproducible CI builds
├── public/
│   └── preview.png             # Application preview banner asset
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite build configuration with Tailwind CSS plugin
├── README.md                   # Project documentation
├── worker/                     # Cloudflare Worker backend
│   ├── package.json            # Worker dependencies & Wrangler scripts
│   ├── src/index.ts            # Worker REST API with Supabase token verification, D1 queries & file output endpoints
│   ├── schema.sql              # Cloudflare D1 tables (conversations, messages, file_outputs)
│   └── wrangler.toml           # Cloudflare Wrangler configuration & D1 binding
├── supabase/
│   └── schema.sql              # PostgreSQL tables (user_profiles, file_code_outputs) and RLS policies
└── src/
    ├── main.tsx                # React application mount point
    ├── App.tsx                 # Main chat interface, sidebar, incognito, and stream handlers
    ├── index.css               # Tailwind CSS imports, neon aura glow, and scrollbar styles
    ├── components/
    │   ├── AboutModal.tsx      # Standalone About nanobot modal for non-signed-in users
    │   ├── AuthModal.tsx       # Direct registration (username, password, API keys) and signin modal
    │   └── SettingsModal.tsx   # Two-column settings: Account, AI Config, Plugins, About
    └── lib/
        ├── crypto.ts           # Web Crypto PBKDF2 key derivation and AES-GCM zero-knowledge encryption
        ├── fileReader.ts       # Universal code-driven file analyzer for non-image files with stable fileIds
        ├── indexedDb.ts        # Browser IndexedDB local-only original user file storage & orphaned file cleanup
        ├── markdown.ts         # Markdown, KaTeX math parsing, and Highlight.js styling
        ├── plugins.ts          # MCP plugins registry (Drive, Gmail, Docs, Notion, Firecrawl)
        ├── r2.ts               # Cloudflare R2 archive integration utilities
        ├── supabase.ts         # Supabase client with multi-prefix Netlify env var resolution
        ├── tavily.ts           # Tavily search, URL scraping, and # / ## Deep Research runners
        └── workerClient.ts     # Cloudflare Worker REST API client with Bearer token authentication
```

# Latest Updates
<!-- {Documented dynamic disappearance of Import previous chat button once chat starts, and comprehensive 30-day and deletion cascading cleanup across IndexedDB files, Supabase code outputs, Cloudflare D1 messages, and R2 archives} [Commented by: Google AI Studio on 19/10/2026 11:21 AM] -->

- **Import Previous Chat Auto-Disappearance**: The "Import previous chat" button is strictly restricted to signed-in users and now dynamically disappears as soon as a chat has started (`activeChat && activeChat.messages.length > 0`), ensuring a distraction-free active chatting interface while remaining readily available in empty zero-state sessions.
- **Complete Cascade Chat Deletion & 30-Day Auto-Purge Policy**:
  - Whenever a chat is deleted by the user or when 30 days of inactivity pass, all resources associated with that conversation are permanently and completely wiped across all tiers:
    - **Original User Files**: Completely purged from local browser IndexedDB (`deleteOriginalFilesForChat` and `cleanupOrphanedFiles`) and local file cache.
    - **AI Code Outputs**: Completely deleted from Supabase (`public.file_code_outputs` via `deleteFileCodeOutputsFromSupabase` and `purgeExpiredFileCodeOutputs`) and local file output cache.
    - **Chat Transcripts & Messages**: Permanently deleted from Cloudflare D1 (`workerClient.deleteConversation` cascades across `conversations`, `messages`, and `file_outputs`).
    - **Archived Backups**: Automatically deleted from Cloudflare R2 storage (`deleteArchiveFromR2`) and local encrypted chat stores (`removeEncryptedChatRecord`).
  - Implemented automatic 30-day retention enforcement in Cloudflare Worker (`GET /api/conversations`) and client session hydration.
