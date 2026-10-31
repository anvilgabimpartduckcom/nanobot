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

## 📁 Project Structure
<!-- Updated Project Structure and Latest Updates with Developer Settings removal and comprehensive MCP verification [Commented by: Google AI Studio on 31/10/2026 11:05 AM] -->

```
nanobot/
├── .env.example                # Environment variable reference for Netlify and Cloudflare secrets (including required MCP_ENCRYPTION_SECRET, Google & GitHub OAuth client IDs)
├── .github/
│   └── workflows/
│       ├── codeql.yml          # GitHub Actions CodeQL security scanning
│       ├── deploy-worker.yml   # Automated Cloudflare Worker deployment via Wrangler & GitHub Secrets
│       ├── integration-compatibility-monitor.yml # Weekly scheduled MCP provider compatibility and changelog monitor
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
├── scripts/
│   ├── integration_compatibility_monitor.py # Read-only upstream MCP integration changelog monitor
│   └── verify_mcp_backend.ts   # Comprehensive MCP backend, database, crypto, and protocol verification test suite
├── worker/                     # Cloudflare Worker backend
│   ├── package.json            # Worker dependencies & Wrangler scripts
│   ├── src/index.ts            # Worker REST API with MCP engine (/api/mcp/*), AES-GCM credential encryption, SSRF protection, Supabase auth, and D1 persistence
│   ├── schema.sql              # Cloudflare D1 tables (conversations, messages, file_outputs, shared_chats, user_mcp_connections)
│   └── wrangler.toml           # Cloudflare Wrangler configuration & D1 binding
├── supabase/
│   └── schema.sql              # PostgreSQL tables (user_profiles, file_code_outputs) and RLS policies
└── src/
    ├── main.tsx                # React application mount point
    ├── App.tsx                 # Main chat interface, OpenRouter MCP tool-calling loop, reasoning accordion, and stream handlers
    ├── index.css               # Tailwind CSS imports, neon aura glow, and scrollbar styles
    ├── components/
    │   ├── AboutModal.tsx      # Standalone About nanobot modal with permanent service acknowledgments
    │   ├── AuthModal.tsx       # Direct registration and signin modal with masked inputs, eye toggle, and Ctrl+C copy support
    │   └── SettingsModal.tsx   # Two-column settings: Account, AI Config, Add-ons & Integrations with OAuth buttons, live verification, and About
    └── lib/
        ├── crypto.ts           # Web Crypto PBKDF2 key derivation and AES-GCM zero-knowledge client encryption
        ├── fileReader.ts       # Universal code-driven file analyzer for non-image files with stable fileIds
        ├── indexedDb.ts        # Browser IndexedDB local-only original user file storage & orphaned file cleanup
        ├── markdown.ts         # Markdown, KaTeX math parsing, and Highlight.js styling
        ├── pdfExport.ts        # Formatted PDF export engine generating structured A4 PDFs with jsPDF
        ├── plugins.ts          # Catalogue of 11 verified MCP integrations with canonical endpoints, consumer-grade labels, and OAuth metadata
        ├── r2.ts               # Cloudflare R2 archive integration utilities
        ├── supabase.ts         # Supabase client with multi-prefix Netlify env var resolution
        ├── tavily.ts           # Tavily search, URL scraping, and # / ## Deep Research runners
        └── workerClient.ts     # Cloudflare Worker REST API client with Bearer token authentication and typed MCP methods
```

## 📢 Latest Updates
<!-- Updated Latest Updates with Developer Settings Removal and Complete Backend MCP Verification [Commented by: Google AI Studio on 31/10/2026 11:05 AM] -->

- **Complete Removal of Developer Settings**:
  - Fully eliminated the "Developer Settings (Advanced)" accordion, custom endpoint override inputs, server URL configuration forms, and developer-only connection controls from the frontend and backend.
  - Locked all 11 MCP integrations to canonical, trusted application configurations (`CANONICAL_PROVIDER_ENDPOINTS` in `worker/src/index.ts` and `MCP_PLUGINS` in `src/lib/plugins.ts`), completely preventing users or external requests from injecting arbitrary remote endpoints.
  - Cleaned up all associated unused state (`customEndpoint`, `showAdvancedDevMode`) and handlers, preserving a uniform, consumer-friendly Nanobot interface.

- **Truthful Backend Connection Verification ("Test Connection")**:
  - Implemented the `POST /api/mcp/test` endpoint on the Cloudflare Worker and integrated it into the Add-ons UI via `workerClient.testMcpConnection()`.
  - Added a dedicated "Test Connection" action to each provider card that dynamically reports truthful, verified status states: `Connection successful` (with live tool count), `Authentication failed`, `Tool discovery failed`, `Provider unavailable`, or `Configuration required`.
  - Disallowed reporting connection success merely because credentials were saved in the database; status is strictly bound to live provider discovery and authentication verification.

- **Credential Security Hardening & Zero-Knowledge Verification**:
  - Enforced mandatory `MCP_ENCRYPTION_SECRET` configuration on the Cloudflare Worker backend with zero fallback to public Supabase anon keys, preventing any possibility of client-side key leakage.
  - Verified AES-GCM 256-bit encryption with PBKDF2 100,000-iteration key derivation and 12-byte random IVs.
  - Verified that production credentials are never stored in plaintext, incorrect encryption secrets are cleanly rejected, corrupted ciphertext is caught safely, and credentials are completely redacted from all API logs and response payloads.

- **Comprehensive 32-Test Verification Suite**:
  - Created and executed `scripts/verify_mcp_backend.ts`, verifying Worker endpoints (`/api/mcp/connect`, `/api/mcp/tools`, `/api/mcp/call`, `/api/mcp/disconnect`, `/api/mcp/test`), Supabase JWT Bearer authentication, user isolation, D1 schema integrity, remote MCP JSON-RPC 2.0 vs REST-to-tool transport distinction, and OpenRouter streaming tool-calling loops with zero failures.


