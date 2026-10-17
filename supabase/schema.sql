-- {Updated Supabase schema with salt column for multi-device zero-knowledge decryption} [Commented by: Google AI Studio on 10/13/2026 10:51 AM]

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table (Stores credentials, uniqueness constraints, and salt for encryption key derivation)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    openrouter_key TEXT UNIQUE NOT NULL,
    tavily_key TEXT UNIQUE NOT NULL,
    ai_instructions TEXT DEFAULT '',
    model_training BOOLEAN DEFAULT TRUE,
    plugins_connected JSONB DEFAULT '{"google_drive":false,"gmail":false,"google_docs":false,"notion":false,"firecrawl":false,"tavily":false}'::jsonb,
    salt TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security for user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for uniqueness and login"
    ON public.user_profiles FOR SELECT
    USING (true);

CREATE POLICY "Allow insert profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow update profile"
    ON public.user_profiles FOR UPDATE
    USING (true);

CREATE POLICY "Allow delete profile"
    ON public.user_profiles FOR DELETE
    USING (true);

-- 3. Zero-Knowledge Encrypted Chats Table
-- Contains client-side AES-GCM ciphertexts only. Admins cannot read conversational content.
CREATE TABLE IF NOT EXISTS public.chats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
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

CREATE POLICY "Allow all operations for user chats"
    ON public.chats FOR ALL
    USING (true);

-- 4. Automatic 30-Day Inactive Chat Purge Function
CREATE OR REPLACE FUNCTION purge_inactive_chats()
RETURNS void AS $$
BEGIN
    DELETE FROM public.chats
    WHERE updated_at < (NOW() - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
