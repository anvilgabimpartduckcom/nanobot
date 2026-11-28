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
│   ├── verify_auth_and_database.ts           # Supabase Auth, PostgreSQL schema, RLS, encryption, JSON export, shared-noodle, clean logout, and H-5 local-first privacy regression suite
│   └── verify_mcp_backend.ts                 # Mocked Cloudflare Worker MCP, D1, AES-GCM crypto, OAuth 2.1 + PKCE, and shared-noodle test suite (45 checks)
├── src/                                      # Frontend React + TypeScript application source directory
│   ├── App.tsx                               # Main chat UI, Chat/Agent/Voice mode switcher, Web Speech + Fish Audio Voice mode, JSON backup export, shared noodle flows, browser-local chat/incognito storage, and MCP tool-calling loop
│   ├── index.css                             # Tailwind CSS v4 styles, Neon Black / Minimalist Light themes, dynamic accent color variables, Effort slider, and scrollbars
│   ├── main.tsx                              # React root mount importing bundled KaTeX, Highlight.js, and application styles
│   ├── components/                           # Reusable React modal and UI components
│   │   ├── AboutModal.tsx                    # Standalone About nanobot modal with H-5 storage/threat-model privacy disclosures, external links, and service credits
│   │   ├── AuthModal.tsx                     # Username/password sign-up and sign-in modal enforcing valid Supabase Auth sessions
│   │   └── SettingsModal.tsx                 # Two-column settings modal for Account, Theme & Colour palettes, AI Configuration, MCP Add-ons OAuth/tokens, About disclosures, Sign Out, and Delete Account
│   └── lib/                                  # Frontend utility, cryptography, API client, and storage modules
│       ├── crypto.ts                         # Web Crypto PBKDF2 key derivation and fail-closed AES-256-GCM encryption/decryption helpers
│       ├── fileReader.ts                     # Client-side document/spreadsheet/PDF text extractor and Python reader script synthesizer
│       ├── indexedDb.ts                      # Browser IndexedDB storage for raw user-uploaded files and cleanup helpers
│       ├── jsonExport.ts                     # Client-side JSON chat backup builder and downloader (DO_NOT_EDIT_BACKUP_FOR_nanobot.json)
│       ├── localChatStorage.ts               # Browser-local persistence for regular chats, dedicated incognito chats, local file outputs/reader scripts, fail-closed lock handling, and cleanup helpers
│       ├── markdown.ts                       # Markdown-it + KaTeX + Highlight.js + DOMPurify renderer blocking remote images and unsafe SVGs/CSS
│       ├── plugins.ts                        # Registry of 11 MCP integrations with canonical endpoints, icons, and auth metadata
│       ├── r2.ts                             # Legacy Cloudflare R2 archive helper module (unused by active frontend under H-5)
│       ├── shareUtils.ts                     # Shared noodle snapshot sanitizer, URL/ID parser, clipboard helper, privacy disclosure, and fork builder
│       ├── supabase.ts                       # Supabase Auth client, @nanobot.internal email generation, RPC lookups, profile management, and account deletion cleanup
│       ├── tavily.ts                         # Tavily web search, URL extraction, and Deep Research (mini/pro) client
│       ├── theme.ts                          # Theme and dynamic 8-family lightest-to-darkest accent color palette definitions and CSS variable helpers
│       ├── voice.ts                          # Fish Audio S2.1 Pro voice registry, Random voice tag extractor, speech sanitizer, and OpenRouter TTS client
│       └── workerClient.ts                   # Typed Cloudflare Worker REST API client for shared noodles, MCP OAuth/tools, admin actions, and synced user preferences
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
    ├── schema.sql                            # Cloudflare D1 tables (conversations, messages, file_outputs, shared_chats, user_mcp_connections, mcp_oauth_states, user_preferences)
    ├── wrangler.toml                         # Cloudflare Wrangler configuration and D1 database binding
    └── src/                                  # Cloudflare Worker source directory
        └── index.ts                          # Worker API router for JWT auth, MCP 2026-07-28 OAuth/PKCE, D1 CRUD, shared noodles, user preferences, and account deletion
```

## 📢 Latest Updates
<!-- Replaced Latest Updates with H-5 local-first privacy architecture correction summary [Commented by: Google AI Studio on 28/11/2026 07:35] -->
- **H-5 Privacy Architecture Correction (Browser-Local Conversations)**: Removed all frontend regular-chat, message, and file-output (`reader_code` / extracted text) persistence and sync calls to Supabase and Cloudflare Worker D1 (`workerClient.ts`, `supabase.ts`, `App.tsx`). Regular chats and file outputs now persist exclusively in browser `localStorage` via `src/lib/localChatStorage.ts` (encrypted locally with your account password when signed in, failing closed when locked without downgrading to plaintext or falling back to cloud storage).
- **Dedicated Incognito Persistence (`nanobot_incognito_chats`)**: Incognito conversations and incognito file outputs now persist across page refreshes in a dedicated `localStorage` store isolated from regular history, Supabase, and Cloudflare. Toggling Incognito mode off preserves incognito history; it is cleared only on explicit user clear or account deletion.
- **Cloudflare Shared Noodles & Accurate Disclosures**: Shared chats continue using Cloudflare (`/api/shares`, `/api/public/shares/:shareId`) with 30-day expiry and owner revocation. Updated `AboutModal.tsx`, `SettingsModal.tsx`, and `shareUtils.ts` disclosures to reflect exact Supabase/Cloudflare/browser-local boundaries and clarify that browser storage does not protect against extensions, XSS, or device compromise.
- **H-5 Verification & Cleanup**: Added H-5 regression tests in `scripts/verify_auth_and_database.ts` and ensured explicit clear and account deletion clean up regular, encrypted, incognito, migration, and local file-output keys.