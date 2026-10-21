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
├── LICENSE                     # Software license file
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

# Latest Updates
<!-- {Updated composer chat box vertical positioning to top-[34vh] to prevent neon aura from touching the nanobot text} [Commented by: Google AI Studio on 21/10/2026 06:18 AM] -->

- **Repositioned Chat Box to Prevent Aura Overlap**:
  - Moved the chat box container (`div#root > div > main > div:nth-of-type(4) > div:nth-of-type(1)`) slightly downwards from `top-[30vh]` to `top-[34vh]` in the initial zero state.
  - This provides clean breathing room between the bottom of the 'nanobot' title text (positioned at `top-[19vh]`) and the upper edge of the green neon aura glow (`neon-glow`), keeping the typography sharp and untouched.
- **Updated Project Structure for LICENSE**:
  - Added the newly created `LICENSE` file to the Project Structure tree in `README.md`.

