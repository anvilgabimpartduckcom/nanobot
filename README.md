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
<!-- Updated Project Structure and Latest Updates with targeted production repairs [Commented by: Google AI Studio on 01/11/2026 04:24 PM] -->

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
├── package.json                # Frontend Node.js dependencies and scripts (lint, build, test:auth, test:mcp)
├── package-lock.json           # Exact resolved dependency tree for reproducible CI builds (npm ci validated)
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite build configuration with Tailwind CSS plugin
├── README.md                   # Project documentation
├── SECURITY.md                 # Security policy and vulnerability reporting instructions
├── scripts/
│   ├── integration_compatibility_monitor.py # Read-only upstream MCP integration changelog monitor
│   ├── verify_auth_and_database.ts # Comprehensive 10-point Supabase Auth, PostgreSQL schema, RLS, encryption, and persistence verification suite (27 tests)
│   └── verify_mcp_backend.ts   # Comprehensive MCP backend, database, crypto, and protocol verification test suite (32 tests)
├── worker/                     # Cloudflare Worker backend
│   ├── package.json            # Worker dependencies & Wrangler scripts
│   ├── src/index.ts            # Worker REST API with MCP engine (/api/mcp/*), AES-GCM credential encryption, SSRF protection, Supabase auth, and D1 persistence
│   ├── schema.sql              # Cloudflare D1 tables (conversations, messages, file_outputs, shared_chats, user_mcp_connections)
│   └── wrangler.toml           # Cloudflare Wrangler configuration & D1 binding
├── supabase/
│   └── schema.sql              # Production PostgreSQL tables (user_profiles, conversations, messages, file_code_outputs) with composite ownership foreign keys, atomic RPCs, and search_path hardening
└── src/
    ├── main.tsx                # React application mount point
    ├── App.tsx                 # Main chat interface, Supabase session auto-restore, authoritative chat sync, and OpenRouter MCP tool loop
    ├── index.css               # Tailwind CSS imports, neon aura glow, and scrollbar styles
    ├── components/
    │   ├── AboutModal.tsx      # Standalone About nanobot modal with permanent service acknowledgments
    │   ├── AuthModal.tsx       # Direct username/password registration and signin enforcing valid Supabase Auth sessions
    │   └── SettingsModal.tsx   # Two-column settings with fail-closed credential encryption, session-restored lock banner, and safe account deletion
    └── lib/
        ├── crypto.ts           # Isomorphic Web Crypto PBKDF2 key derivation and AES-GCM zero-knowledge client encryption failing closed on errors
        ├── fileReader.ts       # Universal code-driven file analyzer for non-image files with stable fileIds
        ├── indexedDb.ts        # Browser IndexedDB local-only original user file storage & orphaned file cleanup
        ├── markdown.ts         # Markdown, KaTeX math parsing, and Highlight.js styling
        ├── pdfExport.ts        # Formatted PDF export engine generating structured A4 PDFs with jsPDF
        ├── plugins.ts          # Catalogue of 11 verified MCP integrations with canonical endpoints, consumer-grade labels, and OAuth metadata
        ├── r2.ts               # Cloudflare R2 archive integration utilities
        ├── supabase.ts         # Supabase client with authentic Supabase Auth, fail-closed credential persistence, atomic conversation RPCs, and safe migration
        ├── tavily.ts           # Tavily search, URL scraping, and # / ## Deep Research runners
        └── workerClient.ts     # Cloudflare Worker REST API client with Bearer token authentication and typed MCP methods
```

## 📢 Latest Updates
<!-- Erased previous contents and applied latest updates [Commented by: Google AI Studio on 01/11/2026 04:24 PM] -->

- **Fail-Closed Zero-Knowledge Encryption**:
  - Refactored `encryptText` and `decryptText` in `src/lib/crypto.ts` to strictly fail closed. Removed all fallback mechanisms that previously returned plaintext upon error, ensuring unencrypted sensitive API credentials are never written to storage.
  - Hardened callers in `src/lib/supabase.ts` and `src/components/SettingsModal.tsx` to throw and reject persistence if encryption keys are missing or derivation fails.

- **Strict Session Enforcement for Authentication**:
  - Updated `signUpWithUsername` and `signInWithUsername` in `src/lib/supabase.ts` to require a non-null, valid Supabase Auth session before returning or writing authenticated profile records.
  - Handled projects with email confirmation enabled by presenting an explicit, actionable error explaining the requirement to disable "Confirm email" in Supabase Auth settings for username-based login.
  - Updated `AuthModal.tsx` to verify session existence prior to triggering the application's login success callback.
  - Added username format validation in `validateUsername` restricting usernames to alphanumeric characters, underscores, hyphens, and periods to guarantee deterministic, collision-free internal auth emails.

- **Atomic Conversation & Message Persistence**:
  - Implemented the `public.save_conversation_and_messages` PostgreSQL RPC function in `supabase/schema.sql` running inside a single database transaction. This eliminates non-atomic delete-then-insert sequences and prevents data loss if writing fails.
  - Updated `persistConversationToSupabase` in `src/lib/supabase.ts` to execute the atomic RPC, preserving message UUIDs and returning strict boolean success indicators.
  - Hardened fallback persistence logic to verify conversation upsert before clearing old messages.

- **Database-Level Message-to-Conversation Ownership**:
  - Added a composite unique constraint `uq_conversations_id_user UNIQUE (id, user_id)` to `public.conversations` in `supabase/schema.sql`.
  - Added a composite foreign key `fk_messages_conversation_user FOREIGN KEY (conversation_id, user_id) REFERENCES public.conversations(id, user_id) ON DELETE CASCADE` to `public.messages`.
  - Enforces at the database engine level that a message can only reference a conversation belonging to the exact same authenticated user.

- **Security Definer Function Hardening**:
  - Added explicit `SET search_path = public, auth` to all `SECURITY DEFINER` functions (`check_username_available`, `save_conversation_and_messages`, `delete_user_account`) to neutralize search path hijacking risks.
  - Revoked public execution privileges with explicit role grants (`anon, authenticated` for username checks; `authenticated` for user operations).

- **Resilient Local-to-Cloud Migration**:
  - Rewrote `migrateLocalChatsToSupabase` to distinguish database query failures from legitimately empty databases (`countErr` vs `count === 0`).
  - Added write verification for each conversation during migration, retaining local storage records until all chats are successfully confirmed in the authoritative remote database.

- **Safe Account Deletion & Session Restore Handling**:
  - Implemented `public.delete_user_account()` RPC in `supabase/schema.sql` allowing authenticated users to cascade-delete their own data (`file_code_outputs`, `messages`, `conversations`, `user_profiles`) without exposing service-role keys.
  - Added UI indicator and notice in `SettingsModal.tsx` and `App.tsx` clarifying that when sessions are restored on page reload, zero-knowledge encrypted API keys remain locked until the account password is provided.

- **Expanded Verification Test Suite**:
  - Expanded `scripts/verify_auth_and_database.ts` to 27 comprehensive tests across all 10 targeted production repair mandates (27/27 passed).
  - Maintained `scripts/verify_mcp_backend.ts` (32/32 tests passed).
  - Both test suites, TypeScript typechecking (`npm run lint`), and Vite production build (`npm run build`) pass cleanly with 100% success.
