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
<!-- Updated Project Structure and Latest Updates with Supabase Auth, RLS repair, email column removal, and persistence hierarchy [Commented by: Google AI Studio on 01/11/2026 02:25 PM] -->

```
nanobot/
├── .env.example                # Environment variable reference for Netlify, Supabase, and Cloudflare secrets (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_CLOUDFLARE_WORKER_URL, MCP_ENCRYPTION_SECRET)
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
│   ├── verify_auth_and_database.ts # Comprehensive Supabase Auth, PostgreSQL schema, RLS user isolation, and persistence verification suite
│   └── verify_mcp_backend.ts   # Comprehensive MCP backend, database, crypto, and protocol verification test suite
├── worker/                     # Cloudflare Worker backend
│   ├── package.json            # Worker dependencies & Wrangler scripts
│   ├── src/index.ts            # Worker REST API with MCP engine (/api/mcp/*), AES-GCM credential encryption, SSRF protection, Supabase auth, and D1 persistence
│   ├── schema.sql              # Cloudflare D1 tables (conversations, messages, file_outputs, shared_chats, user_mcp_connections)
│   └── wrangler.toml           # Cloudflare Wrangler configuration & D1 binding
├── supabase/
│   └── schema.sql              # Production PostgreSQL tables (user_profiles, conversations, messages, file_code_outputs) with strict auth.uid() RLS policies
└── src/
    ├── main.tsx                # React application mount point
    ├── App.tsx                 # Main chat interface, Supabase session auto-restore, authoritative chat sync, and OpenRouter MCP tool loop
    ├── index.css               # Tailwind CSS imports, neon aura glow, and scrollbar styles
    ├── components/
    │   ├── AboutModal.tsx      # Standalone About nanobot modal with permanent service acknowledgments
    │   ├── AuthModal.tsx       # Direct username/password registration and signin creating authentic Supabase Auth sessions
    │   └── SettingsModal.tsx   # Two-column settings: Account, AI Config, Add-ons & Integrations with OAuth buttons, live verification, and About
    └── lib/
        ├── crypto.ts           # Isomorphic Web Crypto PBKDF2 key derivation and AES-GCM zero-knowledge client encryption
        ├── fileReader.ts       # Universal code-driven file analyzer for non-image files with stable fileIds
        ├── indexedDb.ts        # Browser IndexedDB local-only original user file storage & orphaned file cleanup
        ├── markdown.ts         # Markdown, KaTeX math parsing, and Highlight.js styling
        ├── pdfExport.ts        # Formatted PDF export engine generating structured A4 PDFs with jsPDF
        ├── plugins.ts          # Catalogue of 11 verified MCP integrations with canonical endpoints, consumer-grade labels, and OAuth metadata
        ├── r2.ts               # Cloudflare R2 archive integration utilities
        ├── supabase.ts         # Supabase client with authentic Supabase Auth (signUpWithUsername, signInWithUsername, session restoration, and remote persistence)
        ├── tavily.ts           # Tavily search, URL scraping, and # / ## Deep Research runners
        └── workerClient.ts     # Cloudflare Worker REST API client with Bearer token authentication and typed MCP methods
```

## 📢 Latest Updates
<!-- Updated Latest Updates with Supabase Auth, RLS repair, email column removal, and persistence hierarchy [Commented by: Google AI Studio on 01/11/2026 02:25 PM] -->

- **Complete Authentication Architecture Repair**:
  - Implemented genuine Supabase Auth session management (`signUpWithUsername`, `signInWithPassword`, `signOutSupabase`, and `restoreActiveSession`) replacing the legacy unauthenticated profile query workaround.
  - Eliminated fallback to unauthenticated localStorage-only user accounts; successful signup and signin now establish authenticated Supabase sessions with automated token refreshes.
  - Updated `workerClient.ts` to supply genuine Supabase Bearer access tokens to the Cloudflare Worker backend, ensuring full end-to-end cryptographic authentication.

- **Strict Removal of the Email Column from User Profiles**:
  - Completely removed the `email` column from `public.user_profiles` in `supabase/schema.sql` and the TypeScript `UserProfile` interface.
  - Profile identities are bound directly to `auth.users(id)` via `UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`.
  - Registration and authentication use an internal deterministic GoTrue-compatible identifier (`formatAuthEmail`) at the Supabase Auth layer, completely decoupling authentication mechanics from user profile data.
  - Replaced all legacy `.eq('email', user.email)` database queries with strict `.eq('id', user.id)` matching the authenticated user's `auth.uid()`.

- **Database & Row Level Security (RLS) Repair**:
  - Hardened `supabase/schema.sql` by replacing insecure `USING (true)` policies with strict tenant isolation: `auth.uid() = id` on `user_profiles` and `auth.uid() = user_id` on `conversations`, `messages`, and `file_code_outputs`.
  - Revoked broad anonymous access to private profile data; PostgREST access is strictly granted to `authenticated` and `service_role`.
  - Added a secure `check_username_available` `SECURITY DEFINER` RPC function to permit pre-registration username availability checks without exposing any user records or private credentials.

- **Data Persistence Hierarchy & Safe Migration**:
  - Established Supabase as the authoritative persistent cloud store for private user account data (profiles, preferences, zero-knowledge encrypted API credentials, conversations, messages, and AI file code outputs).
  - Cloudflare Worker and D1 are dedicated to authenticated backend operations, shared public chat links (`shared_chats`), and user MCP integration connections (`user_mcp_connections`).
  - Implemented automatic, non-destructive migration (`migrateLocalChatsToSupabase`) that uploads existing local storage chats (`nanobot_chats` and `nanobot_encrypted_chats_<userId>`) to Supabase upon first authenticated signin.
  - Browser localStorage is preserved strictly as a fast, offline-resilient local cache.

- **Zero-Knowledge Client-Side Credential Encryption**:
  - API keys (OpenRouter and Tavily) and custom instructions are encrypted client-side using PBKDF2 (100,000 iterations, SHA-256) and AES-GCM 256-bit encryption before being transmitted or persisted.
  - Upgraded `src/lib/crypto.ts` with universal runtime compatibility across Vite browser environments and Node.js testing.
  - Verified that wrong passwords and corrupted ciphertexts are strictly rejected without leaking plaintext credentials.

- **Automated Verification Suites**:
  - Created `scripts/verify_auth_and_database.ts` (17 tests) validating schema definitions, RLS policies, email column absence, auth email determinism, and PBKDF2/AES-GCM encryption.
  - Maintained `scripts/verify_mcp_backend.ts` (32 tests) validating Worker endpoints, D1 schema, and all 11 MCP integrations.
  - All 49 automated tests pass with 100% success; TypeScript (`tsc --noEmit`) and Vite production build pass cleanly.
