# nanobot Netlify Environment Variables & Supabase Integration Plan

Production alignment plan configuring nanobot to strictly read Supabase credentials via Netlify environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`), ensuring seamless deployment without manual runtime configuration.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Credentials Provisioning**: Pre-configured in Netlify environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).
> - **ChatGPT Integration**: Your ChatGPT connection has already set up the Supabase database schema and Netlify environment variables.
> - **Production Readiness**: The application automatically binds to the Netlify-injected environment variables upon deployment and validates connection health on load.

---

## 1. Required Netlify Environment Variables

Ensure ChatGPT (or your Netlify dashboard) has set the following variables in **Netlify Site Configuration -> Environment Variables**:

| Variable Name | Description | Where to find in Supabase |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase Project API URL (`https://<project-ref>.supabase.co`) | Supabase Dashboard -> Project Settings -> API -> Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Public/Anon API Key (`eyJhbGciOi...`) | Supabase Dashboard -> Project Settings -> API -> Project API Keys -> `anon` / `public` |

*Note: Since Netlify is connected to Supabase via Netlify's official extension, these two variables are automatically injected into the build environment.*

---

## 2. Frontend Implementation Specifications

1. **Automatic Netlify Environment Binding**:
   - `src/lib/supabase.ts` reads `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`.
   - Creates the live `@supabase/supabase-js` client instance.
   - Provides a live connection health check and status feedback.
2. **Seamless Fallback in Local/Preview**:
   - If accessed in the AI Studio preview environment before Netlify deployment is triggered, displays a clear indicator indicating "Ready for Netlify deployment", while allowing preview testing.
3. **Database Operations**:
   - **User Sign Up**: Checks global uniqueness against `public.user_profiles` across Email, Username, OpenRouter Key, and Tavily Key, creates record, and dispatches confirmation email.
   - **User Sign In**: Verifies credentials and unlocks client AES-GCM encryption key.
   - **Zero-Knowledge Encrypted Chats**: Saves only AES-GCM ciphertexts and IVs to `public.chats`.
   - **30-Day Auto Purge**: Handled both via client timestamp filter and PostgreSQL purge function.
4. **Export Readiness**:
   - Clean, verified build with zero errors on `npm run build` and `npm run lint`.

---

## 3. Next Steps

Upon your approval, we will finalize the Netlify environment variable binding in `src/lib/supabase.ts` and `src/App.tsx`, run full compilation and lint verification, and confirm the application is ready for export to your public GitHub repository and Netlify.
