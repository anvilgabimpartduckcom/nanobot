// {Enhanced Supabase client with live table syncing and connection probing} [Commented by: Google AI Studio on 10/13/2026 03:17 AM]

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// {Added multi-prefix environment variable support for Netlify and Supabase} [Commented by: Google AI Studio on 10/13/2026 10:17 AM]
const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string) ||
  '';

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
  '';

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
    [key: string]: boolean;
  };
  salt: string;
  // {Added theme preference support for Neon Black and Minimalist Light themes} [Commented by: Google AI Studio on 20/10/2026 11:27 AM]
  theme?: 'Neon Black' | 'Minimalist Light';
}

// {Added FileCodeOutput model and Supabase persistence functions for AI file reading code outputs} [Commented by: Google AI Studio on 19/10/2026 11:02 AM]
export interface FileCodeOutput {
  id?: string;
  user_id: string;
  conversation_id: string;
  source_file_id: string;
  file_name: string;
  file_type: string;
  output_type: string;
  reader_code?: string;
  extracted_output: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface EncryptedChatRecord {
  id: string;
  user_id: string;
  title_ciphertext: string;
  data_ciphertext: string;
  iv: string;
  salt: string;
  pinned: boolean;
  updated_at: string;
}

// Check live Supabase connection status
export async function testSupabaseConnection(): Promise<{ connected: boolean; message: string }> {
  if (!supabase) {
    return { connected: false, message: 'Netlify environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) pending in local preview.' };
  }

  try {
    const { error } = await supabase.from('user_profiles').select('id').limit(1);
    if (error) {
      return { connected: false, message: `Connected to Supabase, but encountered table query notice: ${error.message}` };
    }
    return { connected: true, message: 'Successfully connected to live Supabase PostgreSQL database.' };
  } catch (err: unknown) {
    const e = err as Error;
    return { connected: false, message: `Connection error: ${e.message}` };
  }
}

// Local persistent mock store when Supabase environment variables are pending in preview
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

export async function fetchUserProfiles(): Promise<UserProfile[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('user_profiles').select('*');
      if (!error && data && data.length > 0) {
        return data as UserProfile[];
      }
    } catch (e) {
      console.warn('Remote user_profiles fetch notice:', e);
    }
  }
  return getLocalProfiles();
}

export function getLocalEncryptedChats(userId: string): EncryptedChatRecord[] {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CHATS_KEY) || '[]');
    return all.filter((c: EncryptedChatRecord) => {
      // 30 days auto-purge filter: 30 * 24 * 60 * 60 * 1000 ms
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const isRecent = Date.now() - new Date(c.updated_at).getTime() < thirtyDaysMs;
      return c.user_id === userId && isRecent;
    });
  } catch {
    return [];
  }
}

export async function fetchUserEncryptedChats(userId: string): Promise<EncryptedChatRecord[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (!error && data) {
        // Enforce 30 days auto-purge filter
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        return (data as EncryptedChatRecord[]).filter(
          (c) => Date.now() - new Date(c.updated_at).getTime() < thirtyDaysMs
        );
      }
    } catch (e) {
      console.warn('Remote chats fetch notice:', e);
    }
  }
  return getLocalEncryptedChats(userId);
}

export async function persistEncryptedChatRecord(chatRecord: EncryptedChatRecord) {
  // Always keep in local encrypted store as backup
  try {
    let all = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CHATS_KEY) || '[]');
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    all = all.filter((c: EncryptedChatRecord) => Date.now() - new Date(c.updated_at).getTime() < thirtyDaysMs);
    const idx = all.findIndex((c: EncryptedChatRecord) => c.id === chatRecord.id);
    if (idx >= 0) all[idx] = chatRecord;
    else all.push(chatRecord);
    localStorage.setItem(LOCAL_STORAGE_CHATS_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save encrypted chat locally', e);
  }

  // Sync to live Supabase if connected
  if (supabase) {
    try {
      await supabase.from('chats').upsert([chatRecord]);
    } catch (e) {
      console.warn('Supabase upsert chat notice:', e);
    }
  }
}

export async function removeEncryptedChatRecord(chatId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CHATS_KEY) || '[]');
    const next = all.filter((c: EncryptedChatRecord) => c.id !== chatId);
    localStorage.setItem(LOCAL_STORAGE_CHATS_KEY, JSON.stringify(next));
  } catch (e) {
    console.error('Failed to delete chat locally', e);
  }

  if (supabase) {
    try {
      await supabase.from('chats').delete().eq('id', chatId);
    } catch (e) {
      console.warn('Supabase delete chat notice:', e);
    }
  }
}

// {Save AI file reader code outputs to Supabase public.file_code_outputs table} [Commented by: Google AI Studio on 19/10/2026 11:02 AM]
export async function saveFileCodeOutputToSupabase(record: FileCodeOutput): Promise<boolean> {
  const localKey = `nanobot_file_outputs_${record.user_id}_${record.conversation_id}`;
  try {
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    const filtered = existing.filter((o: FileCodeOutput) => o.source_file_id !== record.source_file_id);
    filtered.push(record);
    localStorage.setItem(localKey, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Local file code output cache note:', err);
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('file_code_outputs').upsert([
        {
          user_id: record.user_id,
          conversation_id: record.conversation_id,
          source_file_id: record.source_file_id,
          file_name: record.file_name,
          file_type: record.file_type,
          output_type: record.output_type,
          reader_code: record.reader_code || '',
          extracted_output: record.extracted_output,
          metadata: record.metadata || {},
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'id' });
      if (error) {
        console.warn('Supabase file_code_outputs upsert notice:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Supabase file_code_outputs error:', e);
      return false;
    }
  }
  return true;
}

// {Fetch AI file reader code outputs from Supabase public.file_code_outputs table} [Commented by: Google AI Studio on 19/10/2026 11:02 AM]
export async function fetchFileCodeOutputsFromSupabase(
  userId: string,
  conversationId: string
): Promise<FileCodeOutput[]> {
  const localKey = `nanobot_file_outputs_${userId}_${conversationId}`;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('file_code_outputs')
        .select('*')
        .eq('user_id', userId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        return data as FileCodeOutput[];
      }
    } catch (e) {
      console.warn('Supabase fetchFileCodeOutputs notice:', e);
    }
  }

  try {
    return JSON.parse(localStorage.getItem(localKey) || '[]');
  } catch {
    return [];
  }
}

// {Delete AI file reader code outputs from Supabase and local cache when a conversation is deleted} [Commented by: Google AI Studio on 19/10/2026 11:19 AM]
export async function deleteFileCodeOutputsFromSupabase(
  userId: string,
  conversationId: string
): Promise<boolean> {
  const localKey = `nanobot_file_outputs_${userId}_${conversationId}`;
  try {
    localStorage.removeItem(localKey);
  } catch (err) {
    console.warn('Local file code output removal note:', err);
  }

  if (supabase) {
    try {
      const { error } = await supabase
        .from('file_code_outputs')
        .delete()
        .eq('user_id', userId)
        .eq('conversation_id', conversationId);
      if (error) {
        console.warn('Supabase file_code_outputs delete notice:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Supabase file_code_outputs delete error:', e);
      return false;
    }
  }
  return true;
}

// {Purge expired AI file reader code outputs older than 30 days from Supabase and local storage} [Commented by: Google AI Studio on 19/10/2026 11:19 AM]
export async function purgeExpiredFileCodeOutputs(userId: string): Promise<void> {
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  if (supabase) {
    try {
      await supabase
        .from('file_code_outputs')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', thirtyDaysAgoIso);
    } catch (e) {
      console.warn('Supabase purgeExpiredFileCodeOutputs notice:', e);
    }
  }
}
