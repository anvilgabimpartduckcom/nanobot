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
<!-- Updated Project Structure and Latest Updates with uploaded PNG favicon asset [Commented by: Google AI Studio at 22/11/2026 11:59] -->

```
nanobot/
├── .env.example                # Environment variable reference for Netlify, Supabase, and Cloudflare Worker secrets (MCP_ENCRYPTION_SECRET and optional *_OAUTH_CLIENT_ID / *_OAUTH_CLIENT_SECRET)
├── .github/
│   └── workflows/
│       ├── codeql.yml          # GitHub Actions CodeQL security scanning
│       ├── deploy-worker.yml   # Automated Cloudflare Worker deployment via Wrangler & GitHub Secrets
│       ├── integration-compatibility-monitor.yml # Weekly scheduled MCP provider compatibility and changelog monitor
│       └── verify-frontend.yml # Automated PR & commit frontend typecheck, lockfile verification, and build
├── .gitignore                  # Git ignore rules for node_modules, build outputs, and local env files
├── index.html                  # HTML entry point with PNG favicon, SEO, KaTeX & Highlight.js CSS
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
│   ├── verify_auth_and_database.ts # Supabase Auth, PostgreSQL schema, RLS, encryption, and persistence verification suite
│   └── verify_mcp_backend.ts   # Mocked Cloudflare Worker MCP, D1, AES-GCM crypto, protocol, and MCP 2026-07-28 OAuth 2.1 + PKCE verification suite (38 checks)
├── worker/                     # Cloudflare Worker backend
│   ├── package.json            # Worker dependencies & Wrangler scripts
│   ├── src/index.ts            # Worker REST API with MCP 2026-07-28 engine (/api/mcp/*, /oauth/client-metadata.json, /api/mcp/oauth/*), AES-GCM encryption, SSRF guard, Supabase auth, and D1 persistence
│   ├── schema.sql              # Cloudflare D1 tables (conversations, messages, file_outputs, shared_chats, user_mcp_connections, mcp_oauth_states)
│   └── wrangler.toml           # Cloudflare Wrangler configuration & D1 binding
├── supabase/
│   └── schema.sql              # Production PostgreSQL tables (user_profiles, conversations, messages, file_code_outputs) with composite ownership foreign keys, atomic RPCs, and search_path hardening
├── public/
│   └── assets/aistudio/
│       └── favicon_a85ae92d.png # Chatbot PNG favicon asset
└── src/
    ├── main.tsx                # React application mount point
    ├── App.tsx                 # Main chat interface, composer plus menu (Upload File, Deep Research toggle, Learn Step By Step), OpenRouter Effort slider, Supabase session sync, and OpenRouter MCP tool loop
    ├── index.css               # Tailwind CSS imports, neon aura glow, green/white Effort slider styles, and scrollbar styles
    ├── components/
    │   ├── AboutModal.tsx      # Standalone About nanobot modal with permanent service acknowledgments
    │   ├── AuthModal.tsx       # Direct username/password registration and signin enforcing valid Supabase Auth sessions
    │   └── SettingsModal.tsx   # Two-column settings with ChatGPT-style "Install Plugin" backend OAuth Add-ons, credential encryption, session-restored lock banner, and safe account deletion
    └── lib/
        ├── crypto.ts           # Isomorphic Web Crypto PBKDF2 key derivation and AES-GCM zero-knowledge client encryption failing closed on errors
        ├── fileReader.ts       # Universal code-driven file analyzer for non-image files with stable fileIds
        ├── indexedDb.ts        # Browser IndexedDB local-only original user file storage & orphaned file cleanup
        ├── markdown.ts         # Markdown, KaTeX math parsing, and Highlight.js styling
        ├── pdfExport.ts        # Formatted PDF export engine generating structured A4 PDFs with jsPDF
        ├── plugins.ts          # Catalogue of 11 verified MCP integrations with canonical endpoints, remote Streamable HTTP MCP URLs, consumer-grade labels, and OAuth metadata
        ├── r2.ts               # Cloudflare R2 archive integration utilities
        ├── supabase.ts         # Supabase client with authentic Supabase Auth, fail-closed credential persistence, atomic conversation RPCs, and safe migration
        ├── tavily.ts           # Tavily search, URL scraping, and Deep Research (mini / pro) orchestration runners
        └── workerClient.ts     # Cloudflare Worker REST API client with Bearer token authentication and typed MCP / OAuth methods
```

## 📢 Latest Updates
<!-- Updated Latest Updates with AuthModal signup help text capitalization fix [Commented by: Google AI Studio at 22/11/2026 12:13] -->

- **AuthModal Copy Update**:
  - Updated the signup prompt in `src/components/AuthModal.tsx` from `"Need Help with creating account?"` to `"Need help with creating account?"`.

- **MCP `2026-07-28` Backend OAuth 2.1 + PKCE & ChatGPT-Style Add-ons**:
  - Updated `worker/src/index.ts` and `worker/schema.sql` (`mcp_oauth_states` table) to implement backend-managed OAuth 2.1 with PKCE (`S256`), single-use CSRF state validation, RFC 9728 Protected Resource Metadata discovery, RFC 8414 Authorization Server Metadata discovery, Client ID Metadata Document (`GET /oauth/client-metadata.json` & `GET /.well-known/mcp-client.json`), RFC 7591 Dynamic Client Registration fallback, and optional static Worker OAuth client secrets (`*_OAUTH_CLIENT_ID` / `*_OAUTH_CLIENT_SECRET` documented in `.env.example`).
  - Added `POST /api/mcp/oauth/start` and `GET /api/mcp/oauth/callback` to exchange authorization codes on the Worker backend, encrypt `access_token` / `refresh_token` with AES-GCM (`MCP_ENCRYPTION_SECRET`) into Cloudflare D1, execute MCP `2026-07-28` Streamable HTTP JSON-RPC (`MCP-Protocol-Version: 2026-07-28`, JSON + SSE) tool discovery and `tools/call`, and auto-refresh expiring OAuth tokens on `/api/mcp/call` and `/api/mcp/test`.
  - Updated `src/lib/plugins.ts`, `src/lib/workerClient.ts`, and `src/components/SettingsModal.tsx` so clicking **Install Plugin** initiates backend OAuth discovery, opens authorization in a new tab, listens for `MCP_OAUTH_COMPLETE` (`postMessage` + polling fallback), and falls back to the guided token modal only when a provider lacks dynamic OAuth discovery or static Worker client secrets.

- **Composer `➕` Menu, Deep Research Toggle & Learn Step By Step Mode**:
  - Replaced `#` and `##` message prefix triggers in `src/App.tsx` with a black popup menu on the `➕` button offering `📁 Upload File`, `🔬 Deep Research`, and `🪜 Learn Step By Step`.
  - Selecting **Deep Research** displays an inline switch beside `➕` labeled **Deep Research** (left, `mini` runner) and **Super Deep Research** (right, `pro` runner) with an always-black track and always-green slider knob.
  - Selecting **Learn Step By Step** activates a persistent learning mode banner and injects structured step-by-step tutoring instructions into the system prompt on every chat turn.

- **OpenRouter Reasoning `Effort` Slider**:
  - Added a 3-stop green slider (`Low`, `Medium`, `High`) with a white circular thumb (`src/index.css` & `src/App.tsx`) labeled **Effort** to the left of the Send button.
  - Maps `Low` to `reasoning: { enabled: false }` (with HTTP 400 fallback to `{ effort: 'none' }` or omitting `reasoning`), `Medium` to `reasoning: { effort: 'medium' }`, and `High` to `reasoning: { effort: 'high' }` in OpenRouter chat completion requests.

- **Verification & Build Checks**:
  - Ran `npm run test:mcp` against mocked D1/fetch harnesses: 38 checks completed with 0 failures (`26 PASS`, `11 MOCK TEST ONLY`, `1 CONFIGURATION REQUIRED`).
  - Ran `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`): both succeeded with zero errors.
  - Live deployment of the updated Cloudflare Worker (`worker/src/index.ts`), D1 schema (`worker/schema.sql`), optional provider OAuth secrets, and live end-to-end browser/OAuth testing have not yet been executed against production infrastructure.
  
## New here? You might love these
<!-- A hyperlinks section [Commented by: Developer on 21/11/26 11:17 AM] -->
### [nanobot 101](https://tropical-chime-8c1.notion.site/nanobot-101-3f4b104092f3804792d0c68bca97e821): A helper docs on nanobot, where you can learn all about it and get technical details.
### [AI News](https://tropical-chime-8c1.notion.site/AI-News-3e6b104092f38092a013ff0804763a13): Not exactly related to nanobot, but you might want to visit here if you care about AI news every week.
