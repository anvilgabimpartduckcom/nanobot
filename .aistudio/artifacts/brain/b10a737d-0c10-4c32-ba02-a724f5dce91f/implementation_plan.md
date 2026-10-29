# Implementation Plan: Nanobot Major Feature Updates & Architecture Overhaul

This plan details the implementation of the 15 requested updates, shifting chat persistence to encrypted client-side storage, introducing contextual three-dot menus, supporting shared noodle URL importing, upgrading the AI model to `nvidia/nemotron-3.5-super-vl:free` with a 1M token ceiling, refining settings, expanding Add-ons with OAuth modal simulation, and rebranding to "Noodles".

---

## 1. Architecture & Storage Migration
- **Local Encrypted Storage**:
  - Store all user conversations, messages, and AI reasoning strictly in browser `localStorage` under `nanobot_encrypted_chats`, encrypted using Web Crypto PBKDF2/AES-GCM (`cryptoKey`).
  - Remove the 30-day auto-purge filter on locally stored noodles so user conversations remain permanently stored on their device until manually cleared.
  - Discontinue uploading routine unshared chat sessions and messages to Cloudflare D1.
- **Cloudflare D1 Public Shares**:
  - Cloudflare D1 backend is strictly reserved for shared noodles (`/api/share`).
  - When a user shares a noodle, an encrypted snapshot containing messages, reasoning, and code outputs (no raw file bytes) is sent to Cloudflare with 30-day retention.
  - If the same user updates the noodle and clicks "Share" again, the existing Cloudflare snapshot is replaced under the exact same share URL.

---

## 2. Contextual Three-Dot Menus & Header UI
- **Signed-in New Noodle View (0 messages)**:
  - Replace the existing top-right `Import Chat` and sunglasses/sun buttons with a borderless three-dots button (`...`).
  - Clicking `...` toggles a dropdown menu beneath it with:
    - **Incognito Noodle**: Accompanied by a green toggle switch (default: OFF).
    - **Import Noodle**: Hovering or clicking reveals sub-options: `Import .txt` and `Provide URL`.
  - No emojis in menu items.
- **Signed-in Running Noodle View (> 0 messages)**:
  - Replace the top-right header buttons with a borderless three-dots button (`...`).
  - Clicking `...` toggles a dropdown menu beneath it with:
    - **Share**
    - **Export Noodle**
  - No emojis in menu items.
  - Bypassed entirely when Incognito mode is active.
- **Incognito Mode Behavior**:
  - When the green toggle switch is ON:
    - Active noodle is not saved to history (`persistChat` is bypassed).
    - Running noodle menu (`Share`, `Export Noodle`) is completely hidden.
    - Model data collection / training is forced OFF (`data_collection: 'deny'`).

---

## 3. Share & Import URL Flows
- **Sharing Noodle**:
  - Clicking `Share` copies the shareable URL directly to the user's clipboard and displays a subtle confirmation toast.
  - Backs up the snapshot to Cloudflare D1 with a 30-day expiration.
- **Signed-In Import via URL**:
  - Flow: `...` -> `Import Noodle` -> `Provide URL`.
  - Opens a modal centered on the screen with heading `Enter URL` and an input field.
  - On Enter: Fetches the shared noodle from Cloudflare (`/api/share/:id`), creates an active editable noodle session in the current account, and saves it to local storage. Users can immediately continue the conversation.
- **Signed-Out Import Shared Noodle**:
  - In signed-out mode, place an `Import Shared Noodle` button to the left of `Sign In` / `Sign Up`.
  - Clicking it opens the centered `Enter URL` modal.
  - On Enter: Loads the shared noodle in read-only view mode without history persistence or editable composer.

---

## 4. User Message Hover Actions (Copy & Inline Edit)
- **Hover Trigger**:
  - Hovering over any user-sent message bubble reveals `Copy` and `Edit` buttons below it.
- **Copy Action**:
  - Copies the exact user prompt text to the clipboard with visual confirmation.
- **Edit Action**:
  - Expands the message into an inline editable `<textarea>` with autofocus and blinking cursor.
  - Pressing `Enter` resends the updated message: updates the noodle from that message index forward, re-executes AI generation, and saves the updated history.
  - Pressing `Shift+Enter` inserts a new line.
  - Includes a cancel option (Esc or Cancel button) to discard changes.

---

## 5. Model Upgrade, Token Ceiling & Context Window
- **Model Upgrade**:
  - Update OpenRouter model ID to `nvidia/nemotron-3.5-super-vl:free`.
- **Token Ceiling**:
  - Increase context ceiling to **1,000,000 tokens** (1M tokens).
- **Context Message Depth**:
  - Increase conversation history sent to the model to the last **8 messages** (`chat.messages.slice(-8)`).
  - Explicitly sanitize context messages: exclude model reasoning and raw file code outputs from the conversation history array sent to OpenRouter.

---

## 6. Settings Modal & About Sections Refinements
- **Settings Modal**:
  - Completely erase the `Appearance` tab navigation button and its panel.
  - Retain the theme selector (Neon Black vs. Minimalist Light) inside the `Account Settings` tab.
- **About nanobot Sections**:
  - In both `AboutModal.tsx` and `SettingsModal.tsx` (About tab):
    - Remove the `Note:` label from the boxed note section.
    - Erase the second bullet point (Ctrl+S backup warning), retaining only the primary note text.

---

## 7. Add-ons (Plugin Marketplace Rebranding & MCP OAuth Flow)
- **Rebranding & Cleanup**:
  - Rebrand `Plugin Marketplace` to `Add-ons`.
  - Remove the toggle switches next to the `Connect` buttons.
- **Alphabetical Arrangement**:
  - Sort all MCP services alphabetically: Cloudflare, Firecrawl, GitHub, Gmail, Google Docs, Google Drive, Netlify, Notion, Slack, Supabase, Tavily.
- **New MCP Add-ons**:
  - Add `GitHub`, `Slack`, `Cloudflare`, `Supabase`, and `Netlify` to `MCP_PLUGINS`.
- **Interactive OAuth Connection Modal**:
  - Clicking `Connect` opens an interactive OAuth authorization modal simulating a real SaaS connection flow:
    - **GitHub**: Includes repository scope choice: `All repositories` vs. `Only select repositories` (with repository name input).
    - **Slack**: Scope selection (channels, messages, workspace permissions).
    - **Cloudflare / Supabase / Netlify**: Project and API authorization scopes.
  - Authorizing marks the Add-on as connected.

---

## 8. "Noodle" Terminology Rebranding
- Replace terminology across the application:
  - `New Chat` -> `New Noodle`
  - `Chat` -> `Noodle`
  - `Chats` -> `Noodles`
  - `Chat History` -> `Noodle History`
  - `Share Chat` -> `Share Noodle`
  - `Export Chat` -> `Export Noodle`

---

## Verification & Validation Plan
1. **TypeScript Linting**: Run `npm run lint` (`tsc --noEmit`) to verify zero syntax or typing errors.
2. **Production Build**: Run `npm run build` (`vite build`) to verify bundle compilation.
3. **Applet Compilation**: Run `compile_applet` and `lint_applet`.
4. **Functional Testing**:
   - Verify signed-in new noodle three-dot menu (Incognito toggle and Import Noodle sub-menu).
   - Verify signed-in running noodle three-dot menu (Share and Export Noodle).
   - Verify hover on user messages reveals Copy and Edit; verify inline edit with Enter and Shift+Enter.
   - Verify 'Import Shared Noodle' modal in signed-out state and 'Provide URL' modal in signed-in state.
   - Verify OpenRouter payload has model `nvidia/nemotron-3.5-super-vl:free` with 8 messages and reasoning omitted.
   - Verify Settings modal has no Appearance tab, theme toggle is in Account tab, and Add-ons are alphabetical with OAuth connect modal.
