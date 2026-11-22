-- Reconcile production Supabase schema: non-destructive additive migration preserving legacy chats [Commented by: Google AI Studio on 04/11/2026 05:23 PM]

-- 1. Enable UUID Extension & Schema Usage
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Reconcile public.user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    openrouter_key TEXT NOT NULL,
    tavily_key TEXT NOT NULL,
    ai_instructions TEXT DEFAULT '',
    model_training BOOLEAN DEFAULT TRUE,
    plugins_connected JSONB DEFAULT '{"google_drive":false,"gmail":false,"google_docs":false,"notion":false,"firecrawl":false,"tavily":false,"cloudflare":false,"github":false,"netlify":false,"supabase":false,"slack":false}'::jsonb,
    salt TEXT NOT NULL DEFAULT '',
    theme TEXT DEFAULT 'Neon Black',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure missing columns exist on existing production user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS salt TEXT NOT NULL DEFAULT '';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'Neon Black';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS ai_instructions TEXT DEFAULT '';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS model_training BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS plugins_connected JSONB DEFAULT '{"google_drive":false,"gmail":false,"google_docs":false,"notion":false,"firecrawl":false,"tavily":false,"cloudflare":false,"github":false,"netlify":false,"supabase":false,"slack":false}'::jsonb;

-- Non-destructively preserve legacy email column: drop NOT NULL and unique constraint so it never blocks new privacy-first signups while retaining all legacy data [Commented by: Google AI Studio on 04/11/2026 05:38 PM]
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'email'
    ) THEN
        ALTER TABLE public.user_profiles ALTER COLUMN email DROP NOT NULL;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_email_key'
    ) THEN
        ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_email_key;
    END IF;
END $$;

-- Drop legacy unique constraints on openrouter_key and tavily_key if they exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_openrouter_key_key'
    ) THEN
        ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_openrouter_key_key;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_tavily_key_key'
    ) THEN
        ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_tavily_key_key;
    END IF;
END $$;

-- Ensure database-level case-insensitive unique index on lower(username)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_lower_username ON public.user_profiles (lower(username));

-- Row Level Security for user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

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

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO authenticated, service_role;

-- 3. Username Availability Checker RPC
CREATE OR REPLACE FUNCTION public.check_username_available(username_to_check TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE lower(username) = lower(trim(username_to_check))
    );
$$;

REVOKE ALL ON FUNCTION public.check_username_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon, authenticated;

-- 4. Reconcile public.conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Noodle',
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    share_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_conversations_id_user UNIQUE (id, user_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_conversations_id_user'
    ) THEN
        ALTER TABLE public.conversations ADD CONSTRAINT uq_conversations_id_user UNIQUE (id, user_id);
    END IF;
END $$;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own conversations" ON public.conversations;
CREATE POLICY "Users can manage their own conversations"
    ON public.conversations FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_user
    ON public.conversations (user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.conversations TO authenticated, service_role;

-- 5. Reconcile public.messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
    content TEXT NOT NULL,
    sources_json JSONB DEFAULT '[]'::jsonb,
    reasoning TEXT,
    display_attachments_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_messages_conversation_user FOREIGN KEY (conversation_id, user_id)
        REFERENCES public.conversations(id, user_id) ON DELETE CASCADE
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_messages_conversation_user'
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
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON public.messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_messages_user
    ON public.messages (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messages TO authenticated, service_role;

-- 6. Reconcile public.file_code_outputs
CREATE TABLE IF NOT EXISTS public.file_code_outputs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL,
    source_file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    output_type TEXT NOT NULL,
    reader_code TEXT,
    extracted_output TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.file_code_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for file_code_outputs" ON public.file_code_outputs;
DROP POLICY IF EXISTS "Users can manage their own file code outputs" ON public.file_code_outputs;

CREATE POLICY "Users can manage their own file code outputs"
    ON public.file_code_outputs FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_file_code_outputs_user
    ON public.file_code_outputs (user_id);

CREATE INDEX IF NOT EXISTS idx_file_code_outputs_conversation
    ON public.file_code_outputs (conversation_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.file_code_outputs TO authenticated, service_role;

-- 7. Legacy public.chats Protection & RLS
-- PRESERVE legacy chats table: do NOT drop; protect with RLS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chats') THEN
        ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Users can view own chats" ON public.chats;
        DROP POLICY IF EXISTS "Users can delete own chats" ON public.chats;
        CREATE POLICY "Users can view own chats" ON public.chats FOR SELECT TO authenticated USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own chats" ON public.chats FOR DELETE TO authenticated USING (auth.uid() = user_id);
        GRANT SELECT, DELETE ON TABLE public.chats TO authenticated, service_role;
    END IF;
END $$;

-- 8. Additive Migration: Populate conversations from legacy chats (Non-destructive)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chats') THEN
        INSERT INTO public.conversations (id, user_id, title, pinned, created_at, updated_at)
        SELECT 
            CASE 
                WHEN c.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
                THEN c.id::UUID 
                ELSE gen_random_uuid() 
            END,
            c.user_id,
            COALESCE(c.title_ciphertext, 'Migrated Noodle'),
            COALESCE(c.pinned, FALSE),
            c.created_at,
            c.updated_at
        FROM public.chats c
        WHERE NOT EXISTS (
            SELECT 1 FROM public.conversations conv WHERE conv.user_id = c.user_id AND conv.title = c.title_ciphertext
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 9. Atomic Save RPC Function
CREATE OR REPLACE FUNCTION public.save_conversation_and_messages(
    p_conversation_id UUID,
    p_title TEXT,
    p_pinned BOOLEAN,
    p_share_id TEXT,
    p_updated_at TIMESTAMP WITH TIME ZONE,
    p_messages JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_msg JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to save conversation';
    END IF;

    -- Upsert the conversation owned strictly by the authenticated user
    INSERT INTO public.conversations (id, user_id, title, pinned, share_id, updated_at)
    VALUES (
        p_conversation_id,
        v_user_id,
        COALESCE(p_title, 'New Noodle'),
        COALESCE(p_pinned, FALSE),
        p_share_id,
        COALESCE(p_updated_at, timezone('utc'::text, now()))
    )
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        pinned = EXCLUDED.pinned,
        share_id = EXCLUDED.share_id,
        updated_at = EXCLUDED.updated_at
    WHERE public.conversations.user_id = v_user_id;

    -- Replace messages atomically within this single transaction
    DELETE FROM public.messages
    WHERE conversation_id = p_conversation_id AND user_id = v_user_id;

    IF p_messages IS NOT NULL AND jsonb_typeof(p_messages) = 'array' AND jsonb_array_length(p_messages) > 0 THEN
        FOR v_msg IN SELECT * FROM jsonb_array_elements(p_messages)
        LOOP
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
                CASE 
                    WHEN v_msg->>'id' IS NOT NULL AND (v_msg->>'id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
                    THEN (v_msg->>'id')::UUID 
                    ELSE gen_random_uuid() 
                END,
                p_conversation_id,
                v_user_id,
                v_msg->>'role',
                COALESCE(v_msg->>'content', ''),
                COALESCE(v_msg->'sources_json', '[]'::jsonb),
                v_msg->>'reasoning',
                COALESCE(v_msg->'display_attachments_json', '[]'::jsonb),
                COALESCE((v_msg->>'created_at')::TIMESTAMPTZ, timezone('utc'::text, now()))
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'conversation_id', p_conversation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.save_conversation_and_messages(UUID, TEXT, BOOLEAN, TEXT, TIMESTAMP WITH TIME ZONE, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_conversation_and_messages(UUID, TEXT, BOOLEAN, TEXT, TIMESTAMP WITH TIME ZONE, JSONB) TO authenticated;

-- 10. Comprehensive Account Deletion RPC
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required for account deletion';
    END IF;

    -- Clean up legacy chats if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chats') THEN
        DELETE FROM public.chats WHERE user_id = v_user_id;
    END IF;

    DELETE FROM public.file_code_outputs WHERE user_id = v_user_id;
    DELETE FROM public.messages WHERE user_id = v_user_id;
    DELETE FROM public.conversations WHERE user_id = v_user_id;
    DELETE FROM public.user_profiles WHERE id = v_user_id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
