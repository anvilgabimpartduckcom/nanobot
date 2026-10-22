-- {Cloudflare D1 SQL schema for Nanobot conversations, messages, and AI-generated file outputs} [Commented by: Google AI Studio on 15/10/2026 9:22 AM]

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index for fast user conversation listing sorted by recency
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated 
  ON conversations (user_id, updated_at DESC);

-- 2. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
  content TEXT NOT NULL,
  sources_json TEXT,
  reasoning TEXT,
  display_attachments_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes for fast conversation transcript retrieval
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
  ON messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_messages_user 
  ON messages (user_id);

-- 3. AI-Generated File Outputs Table (Persisting extracted text, reader scripts, and structured data summaries, NEVER original raw file bytes)
-- {Added file_outputs table for cross-device AI output persistence with foreign-key cascading deletion} [Commented by: Google AI Studio on 15/10/2026 9:22 AM]
CREATE TABLE IF NOT EXISTS file_outputs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  source_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  output_type TEXT NOT NULL, -- 'text_extraction' | 'reader_script' | 'structured_summary'
  output_content TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes for fast lookup of conversation file outputs
CREATE INDEX IF NOT EXISTS idx_file_outputs_conversation 
  ON file_outputs (conversation_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_file_outputs_user 
  ON file_outputs (user_id);

CREATE INDEX IF NOT EXISTS idx_file_outputs_source_file 
  ON file_outputs (source_file_id);

-- 4. Shared Chats Table (Public snapshot links with 30-day retention and scraper protection)
-- {Added shared_chats table for 30-day snapshot sharing with automatic expiration} [Commented by: Google AI Studio on 22/10/2026 04:48 AM]
CREATE TABLE IF NOT EXISTS shared_chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  messages_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_chats_expires 
  ON shared_chats (expires_at);
