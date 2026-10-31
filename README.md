<!-- Created a section which makes it easy for visitors to download the code [Commented by: Developer on 31/10/2026 9:59 AM] -->
## ⤓ Downloading nanobot's source code
You can download nanobot's source code by using Git
```bash
git clone https://github.com/anvilgabimpartduckcom/nanobot.git
```
or by downloading a zip file by using this link in any browser
```URL
https://github.com/anvilgabimpartduckcom/nanobot/archive/refs/heads/main.zip
```
But always make sure to follow the LICENSE.

# 📁 Project Structure
<!-- Updated Project Structure with pdfExport.ts and cleaned workspace files [Commented by: Google AI Studio on 30/10/2026 11:04 AM] -->

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
├── package-lock.json           # Exact resolved dependency tree for reproducible CI builds (npm ci validated)
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite build configuration with Tailwind CSS plugin
├── README.md                   # Project documentation
├── SECURITY.md                 # Security policy and vulnerability reporting instructions
├── worker/                     # Cloudflare Worker backend
│   ├── package.json            # Worker dependencies & Wrangler scripts
│   ├── src/index.ts            # Worker REST API with security headers, Supabase token verification, D1 queries, and share snapshots
│   ├── schema.sql              # Cloudflare D1 tables (conversations, messages, file_outputs, shared_chats)
│   └── wrangler.toml           # Cloudflare Wrangler configuration & D1 binding
├── supabase/
│   └── schema.sql              # PostgreSQL tables (user_profiles, file_code_outputs) and RLS policies
└── src/
    ├── main.tsx                # React application mount point
    ├── App.tsx                 # Main chat interface, sidebar, incognito, inline reasoning accordion, and stream handlers
    ├── index.css               # Tailwind CSS imports, neon aura glow, and scrollbar styles
    ├── components/
    │   ├── AboutModal.tsx      # Standalone About nanobot modal with permanent service acknowledgments
    │   ├── AuthModal.tsx       # Direct registration and signin modal with masked inputs, eye toggle, and Ctrl+C copy support
    │   └── SettingsModal.tsx   # Two-column settings: Account, AI Config, MCP Plugins, About
    └── lib/
        ├── crypto.ts           # Web Crypto PBKDF2 key derivation and AES-GCM zero-knowledge encryption
        ├── fileReader.ts       # Universal code-driven file analyzer for non-image files with stable fileIds
        ├── indexedDb.ts        # Browser IndexedDB local-only original user file storage & orphaned file cleanup
        ├── markdown.ts         # Markdown, KaTeX math parsing, and Highlight.js styling
        ├── pdfExport.ts        # Formatted PDF export engine generating structured A4 PDFs with jsPDF
        ├── plugins.ts          # Catalogue of 11 planned MCP integrations (not currently connected)
        ├── r2.ts               # Cloudflare R2 archive integration utilities
        ├── supabase.ts         # Supabase client with multi-prefix Netlify env var resolution
        ├── tavily.ts           # Tavily search, URL scraping, and # / ## Deep Research runners
        └── workerClient.ts     # Cloudflare Worker REST API client with Bearer token authentication
```

# 📢 Latest Updates
<!-- Updated Latest Updates with PDF export, CI lockfile fix, inline reasoning accordion, credential eye toggles, and security headers [Commented by: Google AI Studio on 30/10/2026 11:04 AM] -->

- **Formatted PDF Chat Export (`jsPDF`)**:
  - Implemented client-side PDF document generation via `src/lib/pdfExport.ts` using `jspdf`.
  - Replaced legacy `.txt` import and export options with an "Export as PDF" button in the running noodle menu and keyboard shortcut (`Ctrl+S`).
  - Generates cleanly paginated, structured A4 PDF backups complete with metadata headers, role indicators, reasoning callouts, file attachment listings, and source citation references.

- **GitHub Actions CI Lockfile Resolution (`verify-frontend.yml`)**:
  - Resolved `npm ci` failure (`EUSAGE`) caused by out-of-sync `package-lock.json` following dependency upgrades.
  - Regenerated lockfile capturing platform-specific optional dependencies (`lightningcss-win32-arm64-msvc@1.32.0`, `lightningcss-win32-x64-msvc@1.32.0`).
  - Verified local and continuous integration reproducibility with `npm ci`, `npm run lint` (`tsc --noEmit`), and `npm run build`.

- **Inline Reasoning Accordion Lifecycle**:
  - Replaced modal overlay with an integrated inline reasoning accordion.
  - When the model is reasoning/thinking, the accordion defaults open with label `Thinking ▼`, unfolding streaming thoughts in real time.
  - When reasoning completes and response content begins, the accordion automatically collapses to `Thinking ▲`, revealing the streaming answer beneath.
  - Users can toggle `Thinking ▲` / `Thinking ▼` at any time to inspect or collapse reasoning traces.

- **Plain-English OpenRouter Error Translation**:
  - Added `interpretOpenRouterError` to translate raw HTTP error statuses (400, 401, 402, 429, 500+) into friendly, informative guidance.
  - Handled provider-specific `data_collection` parameters with automatic fallback retry if strict provider routing is unavailable on free-tier endpoints.

- **Masked Input Security & Copy Support**:
  - Implemented default masked inputs (`type="password"`) with interactive eye visibility toggles for passwords and API keys across Sign In, Sign Up, and Account Settings.
  - Added `onKeyDown` clipboard event interceptors enabling unrestricted `Ctrl+C` / `Cmd+C` copying of entered credentials and API keys.

- **Theme & Storage Isolation**:
  - Configured user-selected theme ('Neon Black' vs 'Minimalist Light') to persist strictly in browser `localStorage` without remote backend syncing.
  - Removed top momentary green status notification banners (`toastNotice`).
  - Cleaned up Sign In modal header copy to `Enter your username and password`.

- **MCP Add-on catalogue status**:
  - The 11 entries in `src/lib/plugins.ts` are a catalogue of planned integrations; provider authorization, MCP transport, and tool execution are not currently implemented for those cards.
  - The Add-ons screen labels them unavailable and does not pass their planned tool lists to the AI model.
  - The Cloudflare Worker includes HTTP security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, CSP, `Permissions-Policy`) and safe ID format validation.


