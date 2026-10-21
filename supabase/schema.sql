-- {Updated Supabase schema: user profiles, credentials, custom instructions, and AI file code outputs strictly in Supabase; user chats stored exclusively in Cloudflare} [Commented by: Google AI Studio on 19/10/2026 11:02 AM]

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table
-- Stores username, email, zero-knowledge salt, API keys (OpenRouter & Tavily), AI custom instructions, and connected MCP plugins
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
    -- {Added theme column in Supabase user_profiles table with default Neon Black} [Commented by: Google AI Studio on 20/10/2026 11:47 AM]
    theme TEXT DEFAULT 'Neon Black',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration for existing deployments to add theme column safely
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'Neon Black';

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

-- 3. AI File Code Outputs Table
-- Persists the code written by the AI model to read any non-image files, along with execution output and file metadata
CREATE TABLE IF NOT EXISTS public.file_code_outputs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    source_file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    output_type TEXT NOT NULL, -- 'reader_script' | 'text_extraction' | 'code_execution'
    reader_code TEXT,          -- The exact code written by the AI model to read/inspect the file
    extracted_output TEXT NOT NULL, -- The extracted output or data summary resulting from reading the file
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security for file_code_outputs
ALTER TABLE public.file_code_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for file_code_outputs"
    ON public.file_code_outputs FOR ALL
    USING (true);

-- Indexes for fast lookup of conversation file code outputs
CREATE INDEX IF NOT EXISTS idx_file_code_outputs_user
    ON public.file_code_outputs (user_id);

CREATE INDEX IF NOT EXISTS idx_file_code_outputs_conversation
    ON public.file_code_outputs (conversation_id, created_at DESC);
