-- {Defined Supabase database schema, RLS policies, 30-day chat cleanup, and user profiles} [Commented by: Sonic on 10/12/2026 10:47 AM]

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    openrouter_key TEXT UNIQUE NOT NULL,
    tavily_key TEXT UNIQUE NOT NULL,
    ai_instructions TEXT DEFAULT '',
    model_training BOOLEAN DEFAULT TRUE,
    plugins_connected JSONB DEFAULT '{"google_drive":false,"gmail":false,"google_docs":false,"notion":false,"firecrawl":false,"tavily":false}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security for user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
    ON public.user_profiles FOR DELETE
    USING (auth.uid() = id);

-- 3. Zero-Knowledge Encrypted Chats Table
-- Contains client-side AES-GCM ciphertexts only. Admins cannot read conversational content.
CREATE TABLE IF NOT EXISTS public.chats (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title_ciphertext TEXT NOT NULL,
    data_ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    salt TEXT NOT NULL,
    pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security for chats
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chats"
    ON public.chats FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chats"
    ON public.chats FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chats"
    ON public.chats FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats"
    ON public.chats FOR DELETE
    USING (auth.uid() = user_id);

-- 4. Automatic 30-Day Inactive Chat Purge Function
CREATE OR REPLACE FUNCTION purge_inactive_chats()
RETURNS void AS $$
BEGIN
    DELETE FROM public.chats
    WHERE updated_at < (NOW() - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Helper Function to verify field uniqueness prior to registration
CREATE OR REPLACE FUNCTION check_credentials_unique(
    p_email TEXT,
    p_username TEXT,
    p_openrouter_key TEXT,
    p_tavily_key TEXT
)
RETURNS JSONB AS $$
DECLARE
    email_taken BOOLEAN;
    username_taken BOOLEAN;
    openrouter_taken BOOLEAN;
    tavily_taken BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE LOWER(email) = LOWER(p_email)) INTO email_taken;
    SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE LOWER(username) = LOWER(p_username)) INTO username_taken;
    SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE openrouter_key = p_openrouter_key) INTO openrouter_taken;
    SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE tavily_key = p_tavily_key) INTO tavily_taken;

    RETURN jsonb_build_object(
        'email_available', NOT email_taken,
        'username_available', NOT username_taken,
        'openrouter_available', NOT openrouter_taken,
        'tavily_available', NOT tavily_taken,
        'all_unique', (NOT email_taken AND NOT username_taken AND NOT openrouter_taken AND NOT tavily_taken)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
