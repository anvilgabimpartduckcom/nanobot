<!-- {Created comprehensive production README for GitHub export and Netlify-Supabase deployment} [Commented by: Sonic on 10/13/2026 03:22 AM] -->

# nanobot 🕷️

> Autonomous AI Assistant with Real-Time Web Grounding, Deep Research, Universal File Reading, and Zero-Knowledge Client-Side Encryption.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com)

---

## 🌟 Key Capabilities

- **Two-Stage Supabase Authentication**: Email verification workflow paired with globally unique username, password, OpenRouter, and Tavily key requirements.
- **Client-Side Zero-Knowledge Encryption**: All chat transcripts and titles are encrypted using **Web Crypto AES-GCM (256-bit)** derived via PBKDF2 from the user's password before leaving the client. Database administrators cannot read chat transcripts.
- **Universal Code-Driven File Reader**: Non-image documents (PDF, CSV, JSON, TXT, PY, XLSX, etc.) trigger dynamic script analysis and extraction with an animated `"Reading Files"` indicator, while images stream directly into multimodal vision.
- **Tavily Deep Research**:
  - `# <query>`: Fast mini research with live source synthesis.
  - `## <query>`: Comprehensive multi-angle pro research report.
- **Incognito Sessions**: One-click sunglasses/sun toggle (`🕶️`/`☀️`) that omits database persistence and passes `data_collection: "deny"` to OpenRouter.
- **Two-Column Settings Suite**:
  - **Account**: Credential management, hyperlinked key editors, account deletion.
  - **AI Configuration**: Custom system instructions (Enter saves, Shift+Enter newline), and model training data toggle.
  - **MCP Plugins**: Google Drive, Gmail, Google Docs, Notion, Firecrawl, and Tavily.
  - **About nanobot**: Official documentation viewer link.
- **SEO & Open Crawling**: Fully indexable by search engines, featuring Schema.org structured metadata and KaTeX math typesetting.
- **30-Day Auto Purge**: Chats inactive for 30 days are automatically deleted.

---

## 🚀 Deployment to Netlify & Supabase

### 1. Supabase Database Setup
Execute the SQL schema located in `supabase/schema.sql` inside your [Supabase SQL Editor](https://app.supabase.com):
```bash
# Contains:
# - public.user_profiles table (with uniqueness constraints)
# - public.chats table (ciphertext and IV storage)
# - purge_inactive_chats() stored procedure
# - Row Level Security (RLS) policies
```

### 2. Netlify Environment Variables
In **Netlify Site Configuration -> Environment Variables**, configure:
```env
VITE_SUPABASE_URL="https://<your-project-id>.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOi..."
```

*(Note: If using Netlify's official Supabase integration extension, these variables are injected automatically).*

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Verify TypeScript compilation and linter
npm run lint

# Build production bundle
npm run build
```

---

## 📄 License
Apache-2.0
