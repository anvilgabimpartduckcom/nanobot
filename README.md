<!-- Created a section which makes it easy for visitors to download the code [Commented by: Developer on 31/10/2026 9:59 PM] -->
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
<!-- Updated Project Structure tree with hashtag descriptions for every file and folder matching current repository contents [Commented by: Google AI Studio at 25/11/2026 22:57] -->

```
nanobot/                                      # Privacy-first, source-available AI chatbot repository root
├── .env.example                              # Environment variable template for Netlify, Supabase, and Cloudflare Worker secrets
├── .github/                                  # GitHub configuration directory
│   └── workflows/                            # GitHub Actions CI/CD and security workflows
│       ├── codeql.yml                        # CodeQL security scanning for JavaScript/TypeScript and GitHub Actions
│       ├── deploy-worker.yml                 # Cloudflare Worker deployment workflow via Wrangler and GitHub Secrets
│       ├── integration-compatibility-monitor.yml # Monthly scheduled upstream MCP provider compatibility monitor
│       └── verify-frontend.yml               # Automated frontend dependency install, typecheck, test suites, and build verification
├── .gitignore                                # Git ignore rules for dependencies, build artifacts, and local env files
├── CONTRIBUTING.md                           # Community contribution, discussion, and contact guidelines
├── LICENSE                                   # Software license terms for nanobot
├── README.md                                 # Project overview, source download links, repository structure, and latest updates
├── bun.lock                                  # Bun lockfile snapshot for JavaScript/TypeScript packages
├── docs/                                     # Documentation folder
│   └── integration-compatibility.md          # Integration Compatibility Monitor specification and supported provider inventory
├── index.html                                # HTML entry point with SEO/OpenGraph metadata, Schema.org JSON-LD, and PNG favicon links
├── metadata.json                             # AI Studio application identity and capability metadata
├── netlify.toml                              # Netlify build settings, SPA rewrite rules, and CSP-Report-Only security headers
├── package.json                              # Root frontend dependencies, Vite build scripts, lint, and verification test commands
├── package-lock.json                         # Root npm dependency lockfile
├── public/                                   # Static public assets served verbatim by Vite
│   └── assets/                               # Public asset category directory
│       └── aistudio/                         # App icon and static media folder
│           └── favicon_a85ae92d.png          # Nanobot PNG favicon and Apple touch icon asset
├── scripts/                                  # Maintenance, compatibility monitoring, and automated verification scripts
│   ├── integration_compatibility_monitor.py  # Read-only Python script checking upstream MCP changelogs and opening GitHub issues
│   ├── verify_auth_and_database.ts           # Supabase Auth, PostgreSQL schema, RLS, encryption, JSON export, shared-noodle, and clean logout test suite (106 checks)
│   └── verify_mcp_backend.ts                 # Mocked Cloudflare Worker MCP, D1, AES-GCM crypto, OAuth 2.1 + PKCE, and shared-noodle test suite (45 checks)
├── src/                                      # Frontend React + TypeScript application source directory
│   ├── App.tsx                               # Main chat UI, streaming handler, JSON backup export, shared noodle flows, Supabase sync, and MCP tool-calling loop
│   ├── index.css                             # Tailwind CSS v4 styles, Neon Black / Minimalist Light theme styling, Effort slider, and scrollbars
│   ├── main.tsx                              # React root mount importing bundled KaTeX, Highlight.js, and application styles
│   ├── components/                           # Reusable React modal and UI components
│   │   ├── AboutModal.tsx                    # Standalone About nanobot modal with license, contact links, and service credits
│   │   ├── AuthModal.tsx                     # Username/password sign-up and sign-in modal enforcing valid Supabase Auth sessions
│   │   └── SettingsModal.tsx                 # Two-column settings modal for Account, AI Configuration, MCP Add-ons OAuth/tokens, Sign Out, and Delete Account
│   └── lib/                                  # Frontend utility, cryptography, API client, and storage modules
│       ├── crypto.ts                         # Web Crypto PBKDF2 key derivation and fail-closed AES-256-GCM encryption/decryption helpers
│       ├── fileReader.ts                     # Client-side document/spreadsheet/PDF text extractor and Python reader script synthesizer
│       ├── indexedDb.ts                      # Browser IndexedDB storage for raw user-uploaded files and cleanup helpers
│       ├── jsonExport.ts                     # Client-side JSON chat backup builder and downloader (DO_NOT_EDIT_BACKUP_FOR_nanobot.json)
│       ├── markdown.ts                       # Markdown-it + KaTeX + Highlight.js + DOMPurify renderer blocking remote images and unsafe SVGs/CSS
│       ├── plugins.ts                        # Registry of 11 MCP integrations with canonical endpoints, icons, and auth metadata
│       ├── r2.ts                             # Optional Cloudflare R2 encrypted chat archive helpers with local fallback
│       ├── shareUtils.ts                     # Shared noodle snapshot sanitizer, URL/ID parser, clipboard helper, privacy disclosure, and fork builder
│       ├── supabase.ts                       # Supabase Auth client, @nanobot.internal email generation, RPC lookups, profile/chat persistence, and sign-out helpers
│       ├── tavily.ts                         # Tavily web search, URL extraction, and Deep Research (mini/pro) client
│       └── workerClient.ts                   # Typed Cloudflare Worker REST API client for chats, MCP OAuth/tools, and shared noodles
├── supabase/                                 # Supabase PostgreSQL schema and database migrations
│   ├── schema.sql                            # Reference Supabase schema, RLS policies, composite ownership constraints, and RPCs
│   └── migrations/                           # Ordered PostgreSQL SQL migration scripts
│       ├── 20261104_deprecate_legacy_email.sql               # Optional destructive migration to drop legacy personal email column
│       ├── 20261104_reconcile_production_schema.sql          # Production schema reconciliation preserving legacy chats and email column
│       ├── 20261122_randomized_auth_email.sql                # Adds auth_email column, unique lower(auth_email) index, and lookup RPC
│       └── 20261124_reconcile_live_user_profiles_and_auth_rpcs.sql # Pending non-destructive reconciliation for user_profiles, RLS/grants, and atomic RPCs
├── tsconfig.json                             # TypeScript compiler configuration for the frontend
├── vite.config.ts                            # Vite development server and production bundler configuration
└── worker/                                   # Cloudflare Worker backend API directory
    ├── package.json                          # Worker package metadata, TypeScript devDependencies, and Wrangler scripts
    ├── package-lock.json                     # Worker npm dependency lockfile
    ├── schema.sql                            # Cloudflare D1 tables (conversations, messages, file_outputs, shared_chats, user_mcp_connections, mcp_oauth_states)
    ├── wrangler.toml                         # Cloudflare Wrangler configuration and D1 database binding
    └── src/                                  # Cloudflare Worker source directory
        └── index.ts                          # Worker API router for JWT auth, MCP 2026-07-28 OAuth/PKCE, D1 CRUD, shared noodles, and account deletion
```

## 📢 Latest Updates