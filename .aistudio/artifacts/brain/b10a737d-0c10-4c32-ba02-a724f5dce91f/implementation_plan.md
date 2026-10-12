# nanobot Full-Stack Architecture & Feature Expansion Plan

Comprehensive engineering plan to upgrade nanobot into a production-grade, secure, multi-featured AI workspace with Supabase backend integration, client-side AES-GCM chat encryption, universal multi-format file reading, settings & plugin system, Tavily Deep Research, and incognito operations.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed based on your requirements and clarification answers:
> - **Supabase Backend Configuration**: Strict environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) with explicit Supabase SQL migration files and client wrappers.
> - **Chat History Privacy**: Client-side **Web Crypto AES-GCM (256-bit)** derived via PBKDF2 from the user's password so stored database chats remain zero-knowledge ciphertext.
> - **Universal File Reader**: Transparent script analyzer and execution runner supporting arbitrary file formats (CSV, JSON, DOCX, XLSX, TXT, PY, PDF, etc.) while displaying the animated "Reading Files" indicator.
> - **Deployment Division**: Frontend structured for instantaneous Netlify deployment, paired with Supabase database schema, row-level security (RLS), and email authentication workflows.

---

## 1. Overview & Core Concept

**nanobot** is an autonomous AI assistant featuring real-time web search grounding, KaTeX mathematical typesetting, syntax-highlighted code rendering, and deep multimodal reasoning. This upgrade expands nanobot into a full-stack, authenticated system offering:
1. **Supabase Auth & User Onboarding**: Two-stage registration flow (email confirmation with custom branding template followed by unique credential setup for username, password, OpenRouter key, and Tavily key).
2. **Two-Column Settings Suite**: Modal with Account management, AI Configuration (custom system prompts and model training data collection toggle), MCP Plugins hub (Google Drive, Gmail, Docs, Notion, Firecrawl, Tavily), and Documentation.
3. **End-to-End Client Encryption**: Zero-knowledge chat encryption ensuring nobody (not even database administrators) can read conversational transcripts.
4. **Universal File Reading Engine**: Code-driven multi-format reader with "Reading Files" live visual feedback.
5. **Tavily Deep Research**: Instant single-hashtag (`#` for mini model) and double-hashtag (`##` for pro model) multi-angle research pipelines.
6. **Incognito Operations & Smooth Output**: One-click sunglasses/sun toggle (`🕶️`/`☀️`) for ephemeral unlogged sessions with training opt-out, backed by a fluid character streaming ticker.
7. **Crawler Indexing & SEO**: Removal of robot meta blockers and deployment of OpenGraph, Twitter cards, and Schema.org WebApplication structured data.

---

## 2. User Experience & Visual Design

### Key User Flows
- **Zero State & Header Actions**:
  - The signature neon green aura (`#39ff14`) composer and serif `nanobot` wordmark remain the focal point.
  - Top-right corner features distinct black buttons: **Sign In** and **Sign Up**.
  - Upon signing in, buttons transition into the interactive incognito toggle (`🕶️` normal mode, `☀️` incognito mode).
- **Registration & Verification**:
  - Clicking **Sign Up** opens a modal with header "Register to nanobot", an email input field, and a green "Confirm" button.
  - Submitting initiates Supabase email confirmation with the required sender template.
  - Confirmed users transition to the second form: Username, Password, hyperlinked OpenRouter API Key input, and hyperlinked Tavily API Key input.
  - Clicking deep green "Create Account" verifies global uniqueness and initializes the profile.
- **Settings Workspace**:
  - The left sidebar moves "Clear Chat History" slightly upward and renders a black "Settings" button below it.
  - The Settings modal features a 2-column desktop layout (compact left navigation menu, wide right content panel):
    - **Account**: Editable username, password, OpenRouter key, Tavily key, green "Save" button, red "Cancel" button, and deep red "Delete Account" button.
    - **AI Configuration**: Custom instruction box (Shift+Enter newline, Enter saves), green toggle "Enable Model Training" (default ON; when OFF sends `data_collection: "deny"`).
    - **Plugins**: Google Drive, Gmail, Google Docs, Notion, Firecrawl, Tavily with "+" connect actions and MCP integration readiness.
    - **About nanobot**: Notion documentation viewer link.
- **Deep Research & File Reading**:
  - Prompts starting with `#` or `##` trigger Tavily Deep Research with real-time status pulses.
  - Uploading documents triggers dynamic script analysis with "Reading Files" indicator, while direct images remain visual attachments.

### Visual Identity & Theme Tokens
- **Canvas**: Pure Pitch Black (`#000000`) dominant canvas.
- **Surfaces**: Ultra-dark panels (`#0a0a0a`, `#111111`) with fine hairline borders (`#333333`).
- **Aura Accent**: Neon Green glow (`#39ff14`) around the composer.
- **Actions**: Emerald / Deep Green (`#16a34a`, `#15803d`) for affirmative confirms; Crimson (`#dc2626`, `#b91c1c`) for alerts and deletions.
- **Typography**: Editorial serif header for `nanobot`, high-legibility sans for chat prose, tabular monospace (`font-mono`) for code and tokens.

---

## 3. Key Product Decisions & Trade-Offs

- **Client-Side AES-GCM with PBKDF2**:
  - *Chosen Approach*: Derive an encryption key from the user's password and a unique user salt using `crypto.subtle.deriveKey(PBKDF2)`. Encrypt chat payload with AES-GCM (256-bit) before writing to Supabase.
  - *Why*: Guarantees true end-to-end privacy. Supabase database records contain only encrypted ciphertexts and IVs.
- **30-Day Auto-Purge**:
  - *Chosen Approach*: Client-side timestamp filtering and a PostgreSQL cleanup function/trigger that purges chat sessions inactive for $\ge 30$ days (`NOW() - INTERVAL '30 days'`).
- **OpenRouter & Tavily BYOK (Bring Your Own Key)**:
  - *Chosen Approach*: Keys stored securely in the user's encrypted Supabase profile, loaded into the active session upon sign in.
- **Smooth Streaming Ticker**:
  - *Chosen Approach*: RequestAnimationFrame / high-frequency token smoothing buffer ensuring text streams cleanly without stutter or layout jumps.
- **Outsider Persona Guardrail**:
  - *Chosen Approach*: Update the base system prompt to instruct the AI that if the user asks for personal help, it must respond objectively as an external outsider.

---

## 4. Technical Architecture & Data Strategy

### System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          nanobot Frontend (Netlify)                    │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ Top Bar & Incognito   │  │ Modals: Auth (Sign In/Up) & Settings  │  │
│  │ (Sign In/Up or 🕶️/☀️) │  │ (Account, AI Config, Plugins, About)  │  │
│  └──────────┬────────────┘  └──────────────────┬────────────────────┘  │
│             │                                  │                       │
│  ┌──────────▼──────────────────────────────────▼────────────────────┐  │
│  │ Active Chat State & Web Crypto Encryption Engine (AES-GCM-256)   │  │
│  └──────────┬───────────────────┬──────────────────┬────────────────┘  │
│             │                   │                  │                   │
│  ┌──────────▼────────┐ ┌────────▼────────┐ ┌───────▼────────────────┐  │
│  │ OpenRouter API    │ │ Tavily Search   │ │ Multi-Format Script    │  │
│  │ (Chat / Nemotron) │ │ & Deep Research │ │ Analyzer (File Reader) │  │
│  └───────────────────┘ └─────────────────┘ └────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Encrypted Sessions & User Records
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Supabase Cloud Backend                         │
│                                                                        │
│  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Supabase Auth (Email)  │  │ public.user_profiles Table           │  │
│  │ Custom Signup Template │  │ (username, keys, ai_config, plugins) │  │
│  └────────────────────────┘  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ public.chats Table (ciphertext, iv, updated_at <= 30-day purge)  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Models

1. **User Profile (`user_profiles`)**:
   - `id` (UUID, references auth.users)
   - `username` (Text, UNIQUE)
   - `openrouter_key` (Text, encrypted/stored)
   - `tavily_key` (Text, encrypted/stored)
   - `ai_instructions` (Text)
   - `model_training` (Boolean, default true)
   - `plugins_connected` (JSONB)
   - `created_at`, `updated_at` (Timestamp)

2. **Encrypted Chat (`chats`)**:
   - `id` (UUID)
   - `user_id` (UUID)
   - `title_ciphertext` (Text)
   - `data_ciphertext` (Text)
   - `iv` (Text)
   - `pinned` (Boolean)
   - `created_at`, `updated_at` (Timestamp)

---

## 5. Implementation Stages

1. **Environment & SEO Foundation**:
   - Update `index.html` removing noindex/nofollow tags, adding proper titles, meta tags, and structured JSON-LD.
   - Configure `.env.example` with Supabase keys and deployment notes.
2. **Supabase Schema & Client**:
   - Create Supabase client library with Web Crypto helper (AES-GCM encryption/decryption).
   - Export SQL migration files (`supabase/schema.sql`) for Netlify-Supabase integration.
3. **Auth Modals & Flows**:
   - Build Sign Up modal with email trigger and two-stage account completion with uniqueness validation.
   - Build Sign In modal with credential validation.
4. **Settings Modal (2-Column Architecture)**:
   - Left menu tabs: Account, AI Configuration, Plugins, About nanobot.
   - Complete working handlers for account updates, custom instructions, training toggle, and plugin connections.
5. **Chat Engine Upgrades**:
   - Incognito mode toggle (`🕶️` / `☀️`) with training exclusion and non-persisted state.
   - Tavily Deep Research (`#` mini, `##` pro) runner with status indicator.
   - Universal file reader script analyzer with "Reading Files" state.
   - Smooth token rendering stream ticker.
   - Strict timestamped change documentation comments.
