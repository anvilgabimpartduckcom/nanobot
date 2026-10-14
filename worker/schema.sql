-- {Cloudflare D1 SQL schema for Nanobot conversations and message persistence} [Commented by: Google AI Studio on October 14, 2026 at 10:55 AM]

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
