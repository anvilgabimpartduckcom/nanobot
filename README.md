<!-- Added Latest Updates section and updated MCP plugins reference in README.md [Commented by: Google AI Studio on 19/10/2026 02:25 AM] -->

# 📁 Project Structure
<!-- Placed a folder emoji [Commented by: Google AI Studio on 21/10/2026 11:20 AM] -->

```
nanobot/
├── .env.example                # Environment variable reference for Netlify and Cloudflare secrets
├── .github/
│   └── workflows/
│       ├── codeql.yml          # GitHub Actions CodeQL security scanning
│       ├── deploy-worker.yml   # Automated Cloudflare Worker deployment via Wrangler & GitHub Secrets
│       └── verify-frontend.yml # Automated PR & commit frontend typecheck, lockfile verification, and build
├── .gitignore                  # Git ignore rules for node_modules, build outputs, and local env files
├── index.html                  # HTML entry point with SEO, KaTeX & Highlight.js CSS
├── LICENSE                     # Software license file
├── metadata.json               # Application identity metadata
├── netlify.toml                # Netlify SPA build and redirect rules
├── package.json                # Frontend Node.js dependencies and scripts
├── package-lock.json           # Exact resolved dependency tree for reproducible CI builds
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite build configuration with Tailwind CSS plugin
├── README.md                   # Project documentation
├── SECURITY.md                 # Security policy and vulnerability reporting instructions
├── worker/                     # Cloudflare Worker backend
│   ├── package.json            # Worker dependencies & Wrangler scripts
│   ├── src/index.ts            # Worker REST API with Supabase token verification, D1 queries, public share snapshots, and file output endpoints
│   ├── schema.sql              # Cloudflare D1 tables (conversations, messages, file_outputs, shared_chats)
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
    │   └── SettingsModal.tsx   # Two-column settings: Account, Appearance, AI Config, Plugins, About
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

# 📢 Latest Updates
<!-- Placed a megaphone emoji [Commented by: Google AI Studio on 21/10/2026 11:20 AM] -->
<!-- Updated Latest Updates with removal of Account Settings connectivity indicator pill [Commented by: Google AI Studio on 23/10/2026 07:38 AM] -->

- **Clean UI & Account Settings Header Streamlining**:
  - Removed the unnecessary Supabase/Netlify status indicator pill (`● Supabase Cloud Connected` / `⚡ Netlify Integration Ready`) from the Account Settings header in `SettingsModal.tsx` per user focus-mode request and clean UI guidelines.


