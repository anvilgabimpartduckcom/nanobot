-- Stage 4C final migration: fixes concurrent ownership race in save_conversation_and_messages via ROW_COUNT check, uses now() for all TIMESTAMPTZ defaults/fallbacks, drops exact live user_profiles policies, and preserves all Stage 4B hardenings [Commented by: Google AI Studio at 24/11/2026 17:01]

-- 1. Schema Usage Privileges (pg_catalog.gen_random_uuid() is built into PostgreSQL 13+; no extra extensions needed)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Reconcile public.user_profiles without altering or overwriting existing user data
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS salt TEXT NOT NULL DEFAULT '';
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'Neon Black';
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS auth_email TEXT;
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS ai_instructions TEXT DEFAULT '';
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS model_training BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS plugins_connected JSONB DEFAULT '{"google_drive":false,"gmail":false,"google_docs":false,"notion":false,"firecrawl":false,"tavily":false,"cloudflare":false,"github":false,"netlify":false,"supabase":false,"slack":false}'::jsonb;

-- Drop empty default on salt after column reconciliation so future inserts cannot omit a valid cryptographic salt,
-- without modifying any pre-existing encrypted rows or inventing synthetic salts.
ALTER TABLE public.user_profiles
    ALTER COLUMN salt DROP DEFAULT;

-- Reconcile column defaults explicitly for columns that already existed on live user_profiles (without touching existing row values)
ALTER TABLE public.user_profiles
    ALTER COLUMN theme SET DEFAULT 'Neon Black';
ALTER TABLE public.user_profiles
    ALTER COLUMN ai_instructions SET DEFAULT '';
ALTER TABLE public.user_profiles
    ALTER COLUMN model_training SET DEFAULT TRUE;

DO $$
DECLARE
    v_plugins_type TEXT;
    v_created_at_type TEXT;
    v_updated_at_type TEXT;
BEGIN
    SELECT data_type
    INTO v_plugins_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'plugins_connected';

    IF v_plugins_type = 'jsonb' THEN
        ALTER TABLE public.user_profiles
            ALTER COLUMN plugins_connected SET DEFAULT '{"google_drive":false,"gmail":false,"google_docs":false,"notion":false,"firecrawl":false,"tavily":false,"cloudflare":false,"github":false,"netlify":false,"supabase":false,"slack":false}'::jsonb;
    ELSIF v_plugins_type = 'json' THEN
        ALTER TABLE public.user_profiles
            ALTER COLUMN plugins_connected SET DEFAULT '{"google_drive":false,"gmail":false,"google_docs":false,"notion":false,"firecrawl":false,"tavily":false,"cloudflare":false,"github":false,"netlify":false,"supabase":false,"slack":false}'::json;
    END IF;

    SELECT data_type
    INTO v_created_at_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'created_at';

    IF v_created_at_type = 'timestamp with time zone' THEN
        ALTER TABLE public.user_profiles
            ALTER COLUMN created_at SET DEFAULT now();
    END IF;

    SELECT data_type
    INTO v_updated_at_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'updated_at';

    IF v_updated_at_type = 'timestamp with time zone' THEN
        ALTER TABLE public.user_profiles
            ALTER COLUMN updated_at SET DEFAULT now();
    END IF;
END $$;

-- Enforce non-empty cryptographic salt on all new user_profiles inserts without blocking updates on hypothetical legacy rows
CREATE OR REPLACE FUNCTION public.enforce_user_profile_salt_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF NEW.salt IS NULL OR pg_catalog.btrim(NEW.salt) = '' THEN
        RAISE EXCEPTION 'user_profiles.salt must be a non-empty generated cryptographic salt';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_profile_salt_on_insert ON public.user_profiles;
CREATE TRIGGER trg_enforce_user_profile_salt_on_insert
    BEFORE INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_user_profile_salt_on_insert();

-- Preserve legacy email column if present while dropping NOT NULL/unique blockers; drop legacy API-key unique constraints
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'email'
    ) THEN
        ALTER TABLE public.user_profiles ALTER COLUMN email DROP NOT NULL;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_profiles_email_key' AND connamespace = 'public'::regnamespace
    ) THEN
        ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_email_key;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_profiles_openrouter_key_key' AND connamespace = 'public'::regnamespace
    ) THEN
        ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_openrouter_key_key;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_profiles_tavily_key_key' AND connamespace = 'public'::regnamespace
    ) THEN
        ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_tavily_key_key;
    END IF;
END $$;

-- Enforce case-insensitive uniqueness on username and non-null internal auth_email
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_lower_username
    ON public.user_profiles (pg_catalog.lower(username));

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_lower_auth_email
    ON public.user_profiles (pg_catalog.lower(auth_email))
    WHERE auth_email IS NOT NULL;

-- Backfill auth_email from auth.users ONLY for nanobot internal domains (never personal emails)
UPDATE public.user_profiles up
SET auth_email = pg_catalog.lower(pg_catalog.btrim(au.email))
FROM auth.users au
WHERE up.id = au.id
  AND (up.auth_email IS NULL OR pg_catalog.btrim(up.auth_email) = '')
  AND au.email IS NOT NULL
  AND (
      pg_catalog.lower(pg_catalog.btrim(au.email)) LIKE '%@nanobot.internal'
      OR pg_catalog.lower(pg_catalog.btrim(au.email)) LIKE '%@nanobot.auth.internal'
  );

-- Harden Row Level Security & table privileges on public.user_profiles (no anon direct table access).
-- Drop both the exact existing live policies ("Users can select/insert/update/delete own profile")
-- and canonical/legacy policy names before recreating owner-only policies.
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow select for uniqueness and login" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow insert profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow update profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow delete profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.user_profiles;

CREATE POLICY "Users can view their own profile"
    ON public.user_profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
    ON public.user_profiles FOR DELETE
    TO authenticated
    USING (auth.uid() = id);

REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.user_profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO authenticated, service_role;

-- 3. Secure RPC: check_username_available(TEXT) -> BOOLEAN
-- Fails closed (FALSE) for null, blank, or invalid username formats; never exposes profile rows.
CREATE OR REPLACE FUNCTION public.check_username_available(username_to_check TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
    SELECT CASE
        WHEN username_to_check IS NULL
          OR pg_catalog.length(pg_catalog.btrim(username_to_check)) < 2
          OR pg_catalog.length(pg_catalog.btrim(username_to_check)) > 32
          OR pg_catalog.btrim(username_to_check) !~ '^[a-zA-Z0-9_.-]+$'
        THEN FALSE
        ELSE NOT EXISTS (
            SELECT 1
            FROM public.user_profiles up
            WHERE pg_catalog.lower(up.username) = pg_catalog.lower(pg_catalog.btrim(username_to_check))
        )
    END;
$$;

REVOKE ALL ON FUNCTION public.check_username_available(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon, authenticated;

-- 4. Secure RPC: get_auth_email_for_username(TEXT) -> TEXT
-- Architecture note: Direct browser-to-Supabase signInWithPassword() requires resolving a user's
-- randomized @nanobot.internal email before authentication, so anon execute cannot be removed without
-- moving sign-in behind a Worker proxy. This RPC mitigates exposure by validating format, filtering out
-- deleted auth.users rows, and strictly permitting only @nanobot.internal / @nanobot.auth.internal values.
CREATE OR REPLACE FUNCTION public.get_auth_email_for_username(username_to_lookup TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
    SELECT resolved.candidate_email
    FROM (
        SELECT pg_catalog.lower(pg_catalog.btrim(
            COALESCE(NULLIF(pg_catalog.btrim(au.email), ''), NULLIF(pg_catalog.btrim(up.auth_email), ''))
        )) AS candidate_email
        FROM public.user_profiles up
        JOIN auth.users au ON au.id = up.id AND au.deleted_at IS NULL
        WHERE username_to_lookup IS NOT NULL
          AND pg_catalog.length(pg_catalog.btrim(username_to_lookup)) BETWEEN 2 AND 32
          AND pg_catalog.btrim(username_to_lookup) ~ '^[a-zA-Z0-9_.-]+$'
          AND pg_catalog.lower(up.username) = pg_catalog.lower(pg_catalog.btrim(username_to_lookup))
        LIMIT 1
    ) resolved
    WHERE resolved.candidate_email ~ '^[^@\s]+@(nanobot\.internal|nanobot\.auth\.internal)$';
$$;

REVOKE ALL ON FUNCTION public.get_auth_email_for_username(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_email_for_username(TEXT) TO anon, authenticated;

-- 5. Preserve and harden legacy public.chats table (no active code inserts/updates public.chats; read/delete only)
DO $$
BEGIN
    IF pg_catalog.to_regclass('public.chats') IS NOT NULL THEN
        ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Users can manage own chats" ON public.chats;
        DROP POLICY IF EXISTS "Users can view own chats" ON public.chats;
        DROP POLICY IF EXISTS "Users can delete own chats" ON public.chats;
        CREATE POLICY "Users can view own chats"
            ON public.chats FOR SELECT
            TO authenticated
            USING ((SELECT auth.uid()) = user_id);
        CREATE POLICY "Users can delete own chats"
            ON public.chats FOR DELETE
            TO authenticated
            USING ((SELECT auth.uid()) = user_id);
        REVOKE ALL ON TABLE public.chats FROM PUBLIC, anon, authenticated;
        GRANT SELECT, DELETE ON TABLE public.chats TO authenticated;
        GRANT ALL ON TABLE public.chats TO service_role;
    END IF;
END $$;

-- 6. Idempotently create conversations, messages, file_code_outputs, and lifecycle RPCs
-- Note: conversations.id, messages.id, and messages.conversation_id use TEXT (defaulting to gen_random_uuid()::text)
-- because src/App.tsx generates Date.now().toString() conversation IDs and msg_* fallback IDs, matching file_code_outputs and D1.
CREATE TABLE IF NOT EXISTS public.conversations (
    id TEXT PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Noodle',
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    share_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT uq_conversations_id_user UNIQUE (id, user_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_conversations_id_user' AND connamespace = 'public'::regnamespace
    ) THEN
        ALTER TABLE public.conversations ADD CONSTRAINT uq_conversations_id_user UNIQUE (id, user_id);
    END IF;
END $$;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own conversations" ON public.conversations;
CREATE POLICY "Users can manage their own conversations"
    ON public.conversations FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user
    ON public.conversations (user_id, pinned DESC, updated_at DESC);
REVOKE ALL ON TABLE public.conversations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.conversations TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid()::text,
    conversation_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
    content TEXT NOT NULL,
    sources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    reasoning TEXT,
    display_attachments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT fk_messages_conversation_user FOREIGN KEY (conversation_id, user_id)
        REFERENCES public.conversations(id, user_id) ON DELETE CASCADE
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_messages_conversation_user' AND connamespace = 'public'::regnamespace
    ) THEN
        ALTER TABLE public.messages
            ADD CONSTRAINT fk_messages_conversation_user
            FOREIGN KEY (conversation_id, user_id)
            REFERENCES public.conversations(id, user_id) ON DELETE CASCADE;
    END IF;
END $$;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own messages" ON public.messages;
CREATE POLICY "Users can manage their own messages"
    ON public.messages FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON public.messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_user
    ON public.messages (user_id, created_at ASC);
REVOKE ALL ON TABLE public.messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messages TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.file_code_outputs (
    id TEXT PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL,
    source_file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    output_type TEXT NOT NULL,
    reader_code TEXT,
    extracted_output TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.file_code_outputs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for file_code_outputs" ON public.file_code_outputs;
DROP POLICY IF EXISTS "Users can manage their own file code outputs" ON public.file_code_outputs;
CREATE POLICY "Users can manage their own file code outputs"
    ON public.file_code_outputs FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE INDEX IF NOT EXISTS idx_file_code_outputs_user
    ON public.file_code_outputs (user_id);
CREATE INDEX IF NOT EXISTS idx_file_code_outputs_user_created
    ON public.file_code_outputs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_file_code_outputs_conversation
    ON public.file_code_outputs (user_id, conversation_id, created_at ASC);
REVOKE ALL ON TABLE public.file_code_outputs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.file_code_outputs TO authenticated, service_role;

-- Drop legacy UUID overload if present before creating TEXT-compatible signature
DROP FUNCTION IF EXISTS public.save_conversation_and_messages(UUID, TEXT, BOOLEAN, TEXT, TIMESTAMP WITH TIME ZONE, JSONB);

CREATE OR REPLACE FUNCTION public.save_conversation_and_messages(
    p_conversation_id TEXT,
    p_title TEXT,
    p_pinned BOOLEAN,
    p_share_id TEXT,
    p_updated_at TIMESTAMP WITH TIME ZONE,
    p_messages JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_conv_id TEXT;
    v_existing_owner UUID;
    v_row_count INTEGER := 0;
    v_msg JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to save conversation';
    END IF;

    v_conv_id := pg_catalog.btrim(p_conversation_id);
    IF v_conv_id IS NULL OR v_conv_id = '' THEN
        RAISE EXCEPTION 'Valid conversation ID is required';
    END IF;

    -- Explicitly verify ownership under row lock before upsert
    SELECT c.user_id
    INTO v_existing_owner
    FROM public.conversations c
    WHERE c.id = v_conv_id
    FOR UPDATE;

    IF FOUND AND v_existing_owner <> v_user_id THEN
        RAISE EXCEPTION 'Forbidden: conversation belongs to another user';
    END IF;

    INSERT INTO public.conversations (id, user_id, title, pinned, share_id, updated_at)
    VALUES (
        v_conv_id,
        v_user_id,
        COALESCE(p_title, 'New Noodle'),
        COALESCE(p_pinned, FALSE),
        p_share_id,
        COALESCE(p_updated_at, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        pinned = EXCLUDED.pinned,
        share_id = EXCLUDED.share_id,
        updated_at = EXCLUDED.updated_at
    WHERE public.conversations.user_id = v_user_id;

    -- Guard against concurrent cross-user INSERT race where ON CONFLICT WHERE skips DO UPDATE (ROW_COUNT = 0)
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count = 0 THEN
        RAISE EXCEPTION 'Forbidden: unable to save conversation due to concurrent ownership conflict';
    END IF;

    DELETE FROM public.messages
    WHERE conversation_id = v_conv_id AND user_id = v_user_id;

    IF p_messages IS NOT NULL THEN
        IF pg_catalog.jsonb_typeof(p_messages) <> 'array' THEN
            RAISE EXCEPTION 'p_messages must be a JSON array';
        END IF;

        IF pg_catalog.jsonb_array_length(p_messages) > 0 THEN
            FOR v_msg IN SELECT value FROM pg_catalog.jsonb_array_elements(p_messages)
            LOOP
                IF pg_catalog.jsonb_typeof(v_msg) <> 'object' THEN
                    RAISE EXCEPTION 'Each entry in p_messages must be a JSON object';
                END IF;

                INSERT INTO public.messages (
                    id,
                    conversation_id,
                    user_id,
                    role,
                    content,
                    sources_json,
                    reasoning,
                    display_attachments_json,
                    created_at
                )
                VALUES (
                    COALESCE(NULLIF(pg_catalog.btrim(v_msg->>'id'), ''), pg_catalog.gen_random_uuid()::text),
                    v_conv_id,
                    v_user_id,
                    v_msg->>'role',
                    COALESCE(v_msg->>'content', ''),
                    CASE
                        WHEN pg_catalog.jsonb_typeof(v_msg->'sources_json') = 'array' THEN v_msg->'sources_json'
                        ELSE '[]'::jsonb
                    END,
                    v_msg->>'reasoning',
                    CASE
                        WHEN pg_catalog.jsonb_typeof(v_msg->'display_attachments_json') = 'array' THEN v_msg->'display_attachments_json'
                        ELSE '[]'::jsonb
                    END,
                    COALESCE(
                        NULLIF(pg_catalog.btrim(v_msg->>'created_at'), '')::TIMESTAMPTZ,
                        now()
                    )
                );
            END LOOP;
        END IF;
    END IF;

    RETURN pg_catalog.jsonb_build_object('success', true, 'conversation_id', v_conv_id);
END;
$$;

REVOKE ALL ON FUNCTION public.save_conversation_and_messages(TEXT, TEXT, BOOLEAN, TEXT, TIMESTAMP WITH TIME ZONE, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_conversation_and_messages(TEXT, TEXT, BOOLEAN, TEXT, TIMESTAMP WITH TIME ZONE, JSONB) TO authenticated;

-- Account data purge RPC executed by Cloudflare Worker DELETE /api/account with the user's JWT;
-- Cloudflare Worker subsequently deletes the auth.users identity via Admin API (SUPABASE_SERVICE_ROLE_KEY) and purges D1.
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required for account deletion';
    END IF;

    IF pg_catalog.to_regclass('public.chats') IS NOT NULL THEN
        DELETE FROM public.chats WHERE user_id = v_user_id;
    END IF;

    DELETE FROM public.file_code_outputs WHERE user_id = v_user_id;
    DELETE FROM public.messages WHERE user_id = v_user_id;
    DELETE FROM public.conversations WHERE user_id = v_user_id;
    DELETE FROM public.user_profiles WHERE id = v_user_id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- 7. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
