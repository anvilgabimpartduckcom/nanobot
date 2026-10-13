// {Created Supabase client with environment variable binding and zero-failure authentication fallback} [Commented by: Sonic on 10/12/2026 10:49 AM]

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('xyzcompany')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  openrouter_key: string;
  tavily_key: string;
  ai_instructions: string;
  model_training: boolean;
  plugins_connected: {
    google_drive: boolean;
    gmail: boolean;
    google_docs: boolean;
    notion: boolean;
    firecrawl: boolean;
    tavily: boolean;
  };
  salt: string;
}

// Local persistent mock store when Supabase environment variables are pending
const LOCAL_STORAGE_USERS_KEY = 'nanobot_supabase_users';
const LOCAL_STORAGE_CHATS_KEY = 'nanobot_encrypted_chats';

export function getLocalProfiles(): UserProfile[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveLocalProfiles(profiles: UserProfile[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error('Failed to save profiles locally', e);
  }
}

export function getLocalEncryptedChats(userId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CHATS_KEY) || '[]');
    return all.filter((c: { user_id: string; updated_at: number }) => {
      // 30 days auto-purge filter: 30 * 24 * 60 * 60 * 1000 ms
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const isRecent = Date.now() - new Date(c.updated_at).getTime() < thirtyDaysMs;
      return c.user_id === userId && isRecent;
    });
  } catch {
    return [];
  }
}

export function saveLocalEncryptedChat(chatRecord: {
  id: string;
  user_id: string;
  title_ciphertext: string;
  data_ciphertext: string;
  iv: string;
  salt: string;
  pinned: boolean;
  updated_at: string;
}) {
  try {
    let all = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CHATS_KEY) || '[]');
    // Filter out chats older than 30 days automatically
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    all = all.filter((c: { updated_at: string }) => Date.now() - new Date(c.updated_at).getTime() < thirtyDaysMs);
    
    const idx = all.findIndex((c: { id: string }) => c.id === chatRecord.id);
    if (idx >= 0) {
      all[idx] = chatRecord;
    } else {
      all.push(chatRecord);
    }
    localStorage.setItem(LOCAL_STORAGE_CHATS_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save encrypted chat locally', e);
  }
}

export function deleteLocalEncryptedChat(chatId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CHATS_KEY) || '[]');
    const next = all.filter((c: { id: string }) => c.id !== chatId);
    localStorage.setItem(LOCAL_STORAGE_CHATS_KEY, JSON.stringify(next));
  } catch (e) {
    console.error('Failed to delete chat locally', e);
  }
}
