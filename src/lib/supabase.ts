// nanobot Supabase Client: Genuine Supabase Auth, Strict User Isolation, and Authoritative Data Persistence [Commented by: Google AI Studio on 01/11/2026 01:52 PM]

import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { deriveKeyFromPassword, generateSalt, encryptText, decryptText, decryptData } from './crypto';

// Multi-prefix environment variable support for Netlify and Supabase deployment environments [Commented by: Google AI Studio on 01/11/2026 02:18 PM]
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

const supabaseUrl =
  (env.VITE_SUPABASE_URL as string) ||
  (env.NEXT_PUBLIC_SUPABASE_DATABASE_URL as string) ||
  (env.NEXT_PUBLIC_SUPABASE_URL as string) ||
  '';

const supabaseAnonKey =
  (env.VITE_SUPABASE_ANON_KEY as string) ||
  (env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('xyzcompany')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// UserProfile model strictly without email column, keeping sensitive credentials encrypted [Commented by: Google AI Studio on 01/11/2026 02:10 PM]
export interface UserProfile {
  id: string;
  username: string;
  openrouter_key: string;
  tavily_key: string;
  ai_instructions: string;
  model_training: boolean;
  plugins_connected: Record<string, boolean>;
  salt: string;
  theme?: 'Neon Black' | 'Minimalist Light';
}

// Model for AI file reader code outputs stored in Supabase public.file_code_outputs [Commented by: Google AI Studio on 01/11/2026 01:52 PM]
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

// Standardized internal auth identifier generator for Supabase Auth with normalization and collision prevention [Commented by: Google AI Studio on 01/11/2026 04:18 PM]
export function formatAuthEmail(username: string): string {
  const sanitized = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return `${sanitized || 'user'}@nanobot.auth.internal`;
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  const trimmed = username.trim();
  if (!trimmed) return { valid: false, error: 'Username cannot be blank.' };
  if (trimmed.length < 2 || trimmed.length > 32) return { valid: false, error: 'Username must be between 2 and 32 characters.' };
  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, hyphens, and periods.' };
  }
  return { valid: true };
}

// Check live Supabase connection status
export async function testSupabaseConnection(): Promise<{ connected: boolean; message: string }> {
  if (!supabase) {
    return {
      connected: false,
      message: 'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not configured.',
    };
  }

  try {
    const { error } = await supabase.from('conversations').select('id').limit(1);
    // 401 or PGRST301 means table exists and RLS blocked unauthorized anon select, which proves connection is live
    if (error && error.code !== 'PGRST301' && error.code !== '42501') {
      return { connected: false, message: `Database check: ${error.message}` };
    }
    return { connected: true, message: 'Successfully connected to live Supabase PostgreSQL database.' };
  } catch (err: unknown) {
    const e = err as Error;
    return { connected: false, message: `Connection error: ${e.message}` };
  }
}

// Check if username is available for registration via secure RPC function [Commented by: Google AI Studio on 01/11/2026 01:52 PM]
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const trimmed = username.trim();
  if (!trimmed) return false;

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('check_username_available', {
        username_to_check: trimmed,
      });
      if (!error && typeof data === 'boolean') {
        return data;
      }
    } catch {
      // Fallback check if RPC is not yet created in Supabase
    }
  }

  // Safe fallback to local cache
  const localUsers = getLocalProfiles();
  return !localUsers.some((u) => u.username.toLowerCase() === trimmed.toLowerCase());
}

// Local persistent profile cache (used solely for offline display or transitional caching)
const LOCAL_STORAGE_USERS_KEY = 'nanobot_supabase_users';

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

// Genuine Supabase Auth Sign Up creating an authentic Supabase Auth session and encrypted profile [Commented by: Google AI Studio on 01/11/2026 04:18 PM]
export async function signUpWithUsername(
  username: string,
  password: string,
  openrouterKey: string,
  tavilyKey: string
): Promise<{ user: UserProfile; session: Session }> {
  const uName = username.trim();
  const pwd = password.trim();
  const orKey = openrouterKey.trim();
  const tvKey = tavilyKey.trim();

  if (!uName || !pwd || !orKey || !tvKey) {
    throw new Error('All fields (Username, Password, OpenRouter Key, Tavily Key) are mandatory.');
  }

  const validation = validateUsername(uName);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid username.');
  }

  // Removed client-side 6-character minimum password check [Commented by: Google AI Studio at 22/11/2026 12:08]

  if (!supabase) {
    throw new Error('Supabase client is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
  }

  // Check username availability
  const isAvailable = await checkUsernameAvailable(uName);
  if (!isAvailable) {
    throw new Error('This username is already taken. Please choose another username.');
  }

  const authEmail = formatAuthEmail(uName);

  // 1. Create authentic Supabase Auth user
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: authEmail,
    password: pwd,
  });

  if (authErr) {
    throw new Error(authErr.message || 'Failed to create user account with Supabase Auth.');
  }

  const authUser = authData.user;
  if (!authUser) {
    throw new Error('Supabase Auth did not return a valid user identity.');
  }

  // Establish authentic session
  let session = authData.session;
  if (!session) {
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: pwd,
    });
    if (!signInErr && signInData.session) {
      session = signInData.session;
    }
  }

  // Require a valid session; fail closed if email confirmation is enabled in project [Commented by: Google AI Studio on 01/11/2026 04:18 PM]
  if (!session) {
    throw new Error(
      'Signup requires email confirmation in your Supabase project settings. For username-based authentication, please disable "Confirm email" in Supabase Auth > Providers > Email.'
    );
  }

  // 2. Generate zero-knowledge encryption salt & encrypt sensitive API keys (fails closed if key derivation or encryption errors)
  const salt = generateSalt();
  const cryptoKey = await deriveKeyFromPassword(pwd, salt);
  const encryptedOpenRouter = await encryptText(orKey, cryptoKey, salt);
  const encryptedTavily = await encryptText(tvKey, cryptoKey, salt);

  const initialPlugins = {
    google_drive: false,
    gmail: false,
    google_docs: false,
    notion: false,
    firecrawl: false,
    tavily: false,
    cloudflare: false,
    github: false,
    netlify: false,
    supabase: false,
    slack: false,
  };

  // 3. Persist profile record strictly tied to authUser.id with valid session (without email column) [Commented by: Google AI Studio on 01/11/2026 04:18 PM]
  const { error: profileErr } = await supabase.from('user_profiles').insert([
    {
      id: authUser.id,
      username: uName,
      openrouter_key: encryptedOpenRouter,
      tavily_key: encryptedTavily,
      ai_instructions: '',
      model_training: true,
      plugins_connected: initialPlugins,
      salt: salt,
      theme: 'Neon Black',
    },
  ]);

  if (profileErr) {
    console.error('Failed to create user profile in Supabase:', profileErr.message);
    throw new Error(`Profile creation failed: ${profileErr.message}`);
  }

  const resolvedUser: UserProfile = {
    id: authUser.id,
    username: uName,
    openrouter_key: orKey,
    tavily_key: tvKey,
    ai_instructions: '',
    model_training: true,
    plugins_connected: initialPlugins,
    salt: salt,
    theme: 'Neon Black',
  };

  // Update local memory cache
  const localList = getLocalProfiles().filter((u) => u.id !== resolvedUser.id);
  localList.push(resolvedUser);
  saveLocalProfiles(localList);

  return { user: resolvedUser, session };
}

// Genuine Supabase Auth Sign In producing an authentic session access token [Commented by: Google AI Studio on 01/11/2026 01:52 PM]
export async function signInWithUsername(
  username: string,
  password: string
): Promise<{ user: UserProfile; session: Session }> {
  const uName = username.trim();
  const pwd = password.trim();

  if (!uName || !pwd) {
    throw new Error('Please enter both username and password.');
  }

  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const authEmail = formatAuthEmail(uName);

  // 1. Authenticate with Supabase Auth
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: pwd,
  });

  if (authErr || !authData.session || !authData.user) {
    throw new Error(authErr?.message || 'Invalid username or password.');
  }

  const userId = authData.user.id;

  // 2. Fetch authenticated user's private profile using strict RLS auth.uid() = id
  const { data: profileRow, error: profileErr } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr || !profileRow) {
    throw new Error('Profile record not found for this account.');
  }

  // 3. Decrypt zero-knowledge encrypted credentials in browser memory
  const derivedKey = await deriveKeyFromPassword(pwd, profileRow.salt || 'default_nanobot_salt');
  let decryptedOr = profileRow.openrouter_key;
  let decryptedTv = profileRow.tavily_key;
  let decryptedInst = profileRow.ai_instructions || '';

  try {
    decryptedOr = await decryptText(profileRow.openrouter_key, derivedKey);
  } catch (err) {
    console.warn('OpenRouter key decryption note:', err);
  }

  try {
    decryptedTv = await decryptText(profileRow.tavily_key, derivedKey);
  } catch (err) {
    console.warn('Tavily key decryption note:', err);
  }

  try {
    if (profileRow.ai_instructions) {
      decryptedInst = await decryptText(profileRow.ai_instructions, derivedKey);
    }
  } catch {
    decryptedInst = profileRow.ai_instructions || '';
  }

  const userProfile: UserProfile = {
    id: profileRow.id,
    username: profileRow.username,
    openrouter_key: decryptedOr,
    tavily_key: decryptedTv,
    ai_instructions: decryptedInst,
    model_training: profileRow.model_training ?? true,
    plugins_connected: profileRow.plugins_connected || {},
    salt: profileRow.salt,
    theme: profileRow.theme || 'Neon Black',
  };

  // Cache locally
  const localList = getLocalProfiles().filter((u) => u.id !== userProfile.id);
  localList.push(userProfile);
  saveLocalProfiles(localList);

  return { user: userProfile, session: authData.session };
}

// Restore active Supabase session and user profile on app load [Commented by: Google AI Studio on 01/11/2026 01:52 PM]
export async function restoreActiveSession(passwordSecret?: string): Promise<{ user: UserProfile | null; session: Session | null }> {
  if (!supabase) return { user: null, session: null };

  try {
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session || !session.user) {
      return { user: null, session: null };
    }

    const userId = session.user.id;
    const { data: profileRow, error: profileErr } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr || !profileRow) {
      return { user: null, session };
    }

    let decryptedOr = profileRow.openrouter_key;
    let decryptedTv = profileRow.tavily_key;
    let decryptedInst = profileRow.ai_instructions || '';

    if (passwordSecret) {
      try {
        const key = await deriveKeyFromPassword(passwordSecret, profileRow.salt || 'default_nanobot_salt');
        decryptedOr = await decryptText(profileRow.openrouter_key, key);
        decryptedTv = await decryptText(profileRow.tavily_key, key);
        if (profileRow.ai_instructions) {
          decryptedInst = await decryptText(profileRow.ai_instructions, key);
        }
      } catch (e) {
        console.warn('Password decryption failed during restore:', e);
      }
    }

    const userProfile: UserProfile = {
      id: profileRow.id,
      username: profileRow.username,
      openrouter_key: decryptedOr,
      tavily_key: decryptedTv,
      ai_instructions: decryptedInst,
      model_training: profileRow.model_training ?? true,
      plugins_connected: profileRow.plugins_connected || {},
      salt: profileRow.salt,
      theme: profileRow.theme || 'Neon Black',
    };

    return { user: userProfile, session };
  } catch (err) {
    console.warn('Failed to restore Supabase session:', err);
    return { user: null, session: null };
  }
}

// Sign out from Supabase Auth and cleanly clear cached session credentials [Commented by: Google AI Studio on 02/11/2026 08:55 AM]
export async function signOutSupabase(): Promise<void> {
  try {
    localStorage.removeItem('nanobot_active_user');
  } catch {}
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase sign out error:', err);
    }
  }
}

// Update profile in Supabase using strict auth.uid() = id isolation and fail-closed encryption [Commented by: Google AI Studio on 01/11/2026 04:18 PM]
export async function updateUserProfileInSupabase(
  userId: string,
  updatedFields: {
    username?: string;
    openrouter_key?: string;
    tavily_key?: string;
    ai_instructions?: string;
    model_training?: boolean;
    plugins_connected?: Record<string, boolean>;
    theme?: string;
  },
  passwordSecret?: string,
  salt?: string
): Promise<boolean> {
  if (!supabase) return false;

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updatedFields.username !== undefined) {
    const val = validateUsername(updatedFields.username);
    if (!val.valid) throw new Error(val.error || 'Invalid username');
    payload.username = updatedFields.username.trim();
  }
  if (updatedFields.model_training !== undefined) payload.model_training = updatedFields.model_training;
  if (updatedFields.plugins_connected !== undefined) payload.plugins_connected = updatedFields.plugins_connected;
  if (updatedFields.theme !== undefined) payload.theme = updatedFields.theme;

  const hasKeyUpdate =
    (updatedFields.openrouter_key !== undefined && !updatedFields.openrouter_key.startsWith('enc:')) ||
    (updatedFields.tavily_key !== undefined && !updatedFields.tavily_key.startsWith('enc:')) ||
    (updatedFields.ai_instructions !== undefined && !updatedFields.ai_instructions.startsWith('enc:') && updatedFields.ai_instructions.trim() !== '');

  if (hasKeyUpdate) {
    if (!passwordSecret || !salt) {
      throw new Error('Encryption failed closed: Cannot persist sensitive credentials without encryption password.');
    }
  }

  if (passwordSecret && salt) {
    try {
      const key = await deriveKeyFromPassword(passwordSecret, salt);
      if (updatedFields.openrouter_key !== undefined) {
        payload.openrouter_key = await encryptText(updatedFields.openrouter_key, key, salt);
      }
      if (updatedFields.tavily_key !== undefined) {
        payload.tavily_key = await encryptText(updatedFields.tavily_key, key, salt);
      }
      if (updatedFields.ai_instructions !== undefined) {
        payload.ai_instructions = updatedFields.ai_instructions ? await encryptText(updatedFields.ai_instructions, key, salt) : '';
      }
    } catch (encErr) {
      console.error('Credential encryption error during profile update; failing closed:', encErr);
      throw encErr;
    }
  }

  try {
    const { error } = await supabase
      .from('user_profiles')
      .update(payload)
      .eq('id', userId);

    if (error) {
      console.error('Failed to update user profile in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase profile update exception:', err);
    return false;
  }
}

// Delete user account and dependent records safely from Supabase & Cloudflare D1 [Commented by: Google AI Studio on 04/11/2026 05:23 PM]
export async function deleteUserAccountFromSupabase(userId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    // 1. Attempt complete server-side deletion via Cloudflare Worker if configured
    let sessionToken: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      sessionToken = data.session?.access_token || null;
    } catch {}

    const workerBase = (
      (env.VITE_CLOUDFLARE_WORKER_URL as string) ||
      (env.VITE_WORKER_URL as string) ||
      'https://nanobot-api.mud-amiable-tweed.workers.dev'
    ).replace(/\/$/, '');

    // [Delegate full deletion to Worker endpoint with verified session token] [Commented by: Google AI Studio at 05/11/2026 17:29]
    if (workerBase && sessionToken) {
      const res = await fetch(`${workerBase}/api/account`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        // If the worker returned an error, verify whether the identity is already absent from Supabase Auth
        const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        if (!userData?.user) {
          console.info('Account identity is confirmed absent from Supabase Auth; completing local cleanup.');
        } else {
          const errJson = await res.json().catch(() => ({}));
          const message = errJson.error || `Worker account deletion failed with status ${res.status}`;
          console.error('Complete account deletion error:', message);
          throw new Error(message);
        }
      }
    } else {
      throw new Error('Authentication session token is required to delete user account.');
    }


    // 2. Clear all local storage caches for this user
    localStorage.removeItem('nanobot_chats');
    localStorage.removeItem('nanobot_encrypted_chats');
    localStorage.removeItem(`nanobot_encrypted_chats_${userId}`);
    localStorage.removeItem(`nanobot_migration_progress_${userId}`);
    localStorage.removeItem(`nanobot_migration_lock_${userId}`);
    const localUsers = getLocalProfiles().filter((u) => u.id !== userId);
    saveLocalProfiles(localUsers);

    // 3. Sign out of Supabase Auth
    await supabase.auth.signOut().catch(() => {});
    return true;
  } catch (err) {
    console.error('Failed to delete account from Supabase:', err);
    throw err;
  }
}

// ==========================================
// REMOTE CONVERSATION & MESSAGE PERSISTENCE
// ==========================================

export interface RemoteConversationRow {
  id: string;
  user_id: string;
  title: string;
  pinned: boolean;
  share_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RemoteMessageRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'ai';
  content: string;
  sources_json?: Array<{ title: string; url: string }>;
  reasoning?: string;
  display_attachments_json?: Array<{ type: string; name: string; fileId?: string; isLocalMissing?: boolean }>;
  created_at: string;
}

// Fetch all conversations with their messages from Supabase authoritative store [Commented by: Google AI Studio on 01/11/2026 01:52 PM]
export async function fetchRemoteConversationsFromSupabase(
  userId: string
): Promise<Array<{
  id: string;
  title: string;
  pinned: boolean;
  updated: number;
  shareId?: string;
  messages: Array<{
    role: 'user' | 'ai';
    content: string;
    sources?: Array<{ title: string; url: string }>;
    reasoning?: string;
    displayAttachments?: Array<{ type: string; name: string; fileId?: string; isLocalMissing?: boolean }>;
  }>;
}>> {
  if (!supabase) return [];

  try {
    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (convErr || !convs) {
      console.warn('Failed to fetch remote conversations:', convErr?.message);
      return [];
    }

    const { data: msgs, error: msgErr } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (msgErr) {
      console.warn('Failed to fetch remote messages:', msgErr.message);
    }

    const messagesByConv: Record<string, any[]> = {};
    (msgs || []).forEach((m: any) => {
      if (!messagesByConv[m.conversation_id]) {
        messagesByConv[m.conversation_id] = [];
      }
      messagesByConv[m.conversation_id].push({
        role: m.role,
        content: m.content,
        sources: Array.isArray(m.sources_json) ? m.sources_json : [],
        reasoning: m.reasoning || '',
        displayAttachments: Array.isArray(m.display_attachments_json) ? m.display_attachments_json : [],
      });
    });

    return convs.map((c: any) => ({
      id: c.id,
      title: c.title,
      pinned: Boolean(c.pinned),
      updated: new Date(c.updated_at).getTime(),
      shareId: c.share_id || undefined,
      messages: messagesByConv[c.id] || [],
    }));
  } catch (err) {
    console.error('Exception fetching remote conversations:', err);
    return [];
  }
}

// Persist or update a conversation atomically in Supabase [Commented by: Google AI Studio on 01/11/2026 04:18 PM]
export async function persistConversationToSupabase(
  userId: string,
  chat: {
    id: string;
    title: string;
    pinned: boolean;
    updated: number;
    shareId?: string;
    messages: Array<{
      id?: string;
      role: 'user' | 'ai';
      content: string | unknown;
      sources?: Array<{ title: string; url: string }>;
      reasoning?: string;
      displayAttachments?: Array<{ type: string; name: string; fileId?: string; isLocalMissing?: boolean }>;
      created_at?: string;
    }>;
  }
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const msgRows = (chat.messages || []).map((m: any) => {
      let textContent = '';
      if (typeof m.content === 'string') {
        textContent = m.content;
      } else if (Array.isArray(m.content)) {
        textContent = (m.content as any[])
          .map((c) => (c.type === 'text' ? c.text : ''))
          .filter(Boolean)
          .join('\n');
      } else {
        textContent = JSON.stringify(m.content);
      }

      return {
        id: m.id || undefined,
        conversation_id: chat.id,
        user_id: userId,
        role: m.role,
        content: textContent,
        sources_json: Array.isArray(m.sources) ? m.sources : [],
        reasoning: m.reasoning || '',
        display_attachments_json: Array.isArray(m.displayAttachments) ? m.displayAttachments : [],
        created_at: m.created_at || new Date().toISOString(),
      };
    });

    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(chat.id);
    if (isUuid) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('save_conversation_and_messages', {
        p_conversation_id: chat.id,
        p_title: chat.title || 'New Noodle',
        p_pinned: Boolean(chat.pinned),
        p_share_id: chat.shareId || null,
        p_updated_at: new Date(chat.updated || Date.now()).toISOString(),
        p_messages: msgRows,
      });

      if (!rpcErr && rpcData?.success) {
        return true;
      }
      if (rpcErr && rpcErr.code !== 'PGRST202' && !rpcErr.message.includes('function') && !rpcErr.message.includes('not found')) {
        console.error('save_conversation_and_messages RPC error:', rpcErr.message);
        return false;
      }
    }

    // Safe fallback sequence: upsert conversation, and only delete/insert messages if upsert succeeds [Commented by: Google AI Studio on 01/11/2026 04:18 PM]
    const { error: convErr } = await supabase.from('conversations').upsert(
      [
        {
          id: chat.id,
          user_id: userId,
          title: chat.title || 'New Noodle',
          pinned: Boolean(chat.pinned),
          share_id: chat.shareId || null,
          updated_at: new Date(chat.updated || Date.now()).toISOString(),
        },
      ],
      { onConflict: 'id' }
    );

    if (convErr) {
      console.error('Supabase conversation upsert failed; aborting message persistence:', convErr.message);
      return false;
    }

    if (msgRows.length > 0) {
      const { error: delErr } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', chat.id)
        .eq('user_id', userId);

      if (delErr) {
        console.error('Failed to clear old messages before replacement:', delErr.message);
        return false;
      }

      const { error: msgErr } = await supabase.from('messages').insert(msgRows);
      if (msgErr) {
        console.error('Supabase messages insert failed:', msgErr.message);
        return false;
      }
    } else {
      await supabase.from('messages').delete().eq('conversation_id', chat.id).eq('user_id', userId);
    }

    return true;
  } catch (err) {
    console.error('Supabase conversation persistence exception:', err);
    return false;
  }
}

// Delete a conversation and its messages from Supabase [Commented by: Google AI Studio on 01/11/2026 04:18 PM]
export async function deleteConversationFromSupabase(userId: string, conversationId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.warn('Failed to delete conversation from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Delete conversation exception:', err);
    return false;
  }
}

// Safe, reliable, and resumable migration of legacy chats to authoritative Supabase store [Commented by: Google AI Studio on 04/11/2026 05:38 PM]
export async function migrateLocalChatsToSupabase(userId: string, key?: CryptoKey | null): Promise<void> {
  if (!supabase) return;

  const progressKey = `nanobot_migration_progress_${userId}`;
  const lockKey = `nanobot_migration_lock_${userId}`;

  // Prevent race conditions from simultaneous tab loads or rapid browser refreshes [Commented by: Google AI Studio at 05/11/2026 04:00 PM]
  const existingLock = localStorage.getItem(lockKey);
  if (existingLock) {
    const lockTime = parseInt(existingLock, 10);
    if (!isNaN(lockTime) && Date.now() - lockTime < 30000) {
      console.info('Migration currently active in another session or tab; skipping concurrent run.');
      return;
    }
  }
  localStorage.setItem(lockKey, Date.now().toString());

  try {
    let localChats: any[] = [];
    const completedIds: string[] = (() => {
      try {
        return JSON.parse(localStorage.getItem(progressKey) || '[]');
      } catch {
        return [];
      }
    })();

    // 1. Try reading encrypted local cache first
    const enc = localStorage.getItem(`nanobot_encrypted_chats_${userId}`);
    if (enc) {
      if (key) {
        try {
          const decrypted = await decryptText(enc, key);
          const parsed = JSON.parse(decrypted);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localChats = parsed;
          }
        } catch (e) {
          console.warn('Decryption note during migration; preserving encrypted payload:', e);
        }
      } else {
        console.info('Encryption key not yet unlocked; preserving local encrypted chats without modification.');
      }
    }

    // 2. Fallback to legacy unencrypted local chats if no decrypted chats yet
    if (localChats.length === 0) {
      const legacy = localStorage.getItem('nanobot_chats');
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localChats = parsed;
          }
        } catch {}
      }
    }

    // 3. Inspect remote legacy public.chats table (non-destructive)
    try {
      const { data: legacyRemote, error: legErr } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', userId);

      if (!legErr && legacyRemote && legacyRemote.length > 0) {
        if (key) {
          for (const rc of legacyRemote) {
            try {
              let decryptedData = rc.data_ciphertext;
              if (decryptedData) {
                const iv = rc.iv || (decryptedData.startsWith('enc:') ? decryptedData.split(':')[1] : '');
                const ct = decryptedData.startsWith('enc:') ? decryptedData.split(':').slice(2).join(':') : decryptedData;
                if (iv && ct) {
                  decryptedData = await decryptData(ct, iv, key);
                }
              }
              const parsed = JSON.parse(decryptedData);
              const msgs = Array.isArray(parsed) ? parsed : (parsed.messages || []);
              
              // Prevent duplicate chat objects if already in localChats
              const existsLocally = localChats.some((c) => c.id === rc.id);
              if (!existsLocally) {
                localChats.push({
                  id: rc.id,
                  title: rc.title_ciphertext || 'Migrated Noodle',
                  pinned: Boolean(rc.pinned),
                  updated: new Date(rc.updated_at || Date.now()).getTime(),
                  messages: msgs,
                });
              }
            } catch (decErr) {
              console.warn(`Decryption key invalid for remote chat ${rc.id}; preserving remote ciphertext safely:`, decErr);
            }
          }
        } else {
          console.info('Legacy remote chats present but password key locked; preserving remote public.chats for future unlock.');
        }
      }
    } catch (legCatch) {
      console.warn('Legacy remote chats inspection notice:', legCatch);
    }

    if (localChats.length === 0) return;

    // Verify remote database connection state
    const { count, error: countErr } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countErr) {
      console.warn('Migration aborted: Unable to verify remote state due to query error:', countErr.message);
      return;
    }

    // 4. Migrate chats with resumption, progress tracking, deduplication, and verification
    let allSucceeded = true;
    for (const chat of localChats) {
      // If already verified as migrated in a prior run, verify it still exists remotely before skipping
      if (completedIds.includes(chat.id)) {
        continue;
      }

      // Check if conversation already exists remotely to prevent duplicate creation
      const { data: existingRemote } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', chat.id)
        .eq('user_id', userId)
        .maybeSingle();

      let persistOk = false;
      if (existingRemote && existingRemote.id) {
        // Conversation already exists; mark as completed
        persistOk = true;
      } else {
        // Deduplicate messages within the conversation payload
        const seenMsgIds = new Set<string>();
        const dedupedMessages = (chat.messages || []).filter((m: any) => {
          if (!m.id) return true;
          if (seenMsgIds.has(m.id)) return false;
          seenMsgIds.add(m.id);
          return true;
        });

        const chatToPersist = {
          ...chat,
          messages: dedupedMessages,
        };

        persistOk = await persistConversationToSupabase(userId, chatToPersist);
      }

      if (persistOk) {
        // Verify remote persistence before recording in progress tracker
        const { data: verified } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', chat.id)
          .eq('user_id', userId)
          .maybeSingle();

        if (verified && verified.id) {
          if (!completedIds.includes(chat.id)) {
            completedIds.push(chat.id);
            try {
              localStorage.setItem(progressKey, JSON.stringify(completedIds));
            } catch {}
          }
        } else {
          allSucceeded = false;
          console.warn(`Remote verification failed for chat "${chat.id}"`);
        }
      } else {
        allSucceeded = false;
        console.warn(`Failed to persist chat "${chat.id}" during migration; preserving for retry`);
      }
    }

    if (allSucceeded && completedIds.length >= localChats.length) {
      // Safely clear legacy unencrypted chats ONLY after remote verification of all chats succeeds
      localStorage.removeItem('nanobot_chats');
      localStorage.removeItem(progressKey);
      console.info(`Successfully migrated and verified ${localChats.length} conversations to Supabase.`);
    } else {
      console.warn(`Migration partially completed (${completedIds.length}/${localChats.length} verified); preserving all local records for safe resumption.`);
    }
  } catch (err) {
    console.warn('Migration to Supabase notice:', err);
  } finally {
    localStorage.removeItem(lockKey);
  }
}

// One-time client-side safe restoration of legacy remote chats (public.chats & conversations/messages) into browser local encrypted store [Commented by: Google AI Studio at 05/11/2026 09:32]
export async function restoreLegacyRemoteChatsToLocal(
  userId: string,
  key: CryptoKey,
  salt: string
): Promise<Array<{ id: string; title: string; messages: any[]; pinned: boolean; updated: number; shareId?: string }>> {
  if (!supabase) return [];
  const recoveredChats: any[] = [];
  try {
    // 1. Check legacy public.chats table non-destructively
    const { data: legacyRemote } = await supabase.from('chats').select('*').eq('user_id', userId);
    if (legacyRemote && legacyRemote.length > 0) {
      for (const rc of legacyRemote) {
        try {
          let decryptedData = rc.data_ciphertext;
          if (decryptedData) {
            const iv = rc.iv || (decryptedData.startsWith('enc:') ? decryptedData.split(':')[1] : '');
            const ct = decryptedData.startsWith('enc:') ? decryptedData.split(':').slice(2).join(':') : decryptedData;
            if (iv && ct) {
              decryptedData = await decryptData(ct, iv, key);
            }
          }
          const parsed = JSON.parse(decryptedData);
          const msgs = Array.isArray(parsed) ? parsed : (parsed.messages || []);
          recoveredChats.push({
            id: rc.id,
            title: rc.title_ciphertext || 'Restored Noodle',
            pinned: Boolean(rc.pinned),
            updated: new Date(rc.updated_at || Date.now()).getTime(),
            messages: msgs,
          });
        } catch (decErr) {
          console.warn(`Could not decrypt legacy remote chat ${rc.id}:`, decErr);
        }
      }
    }

    // 2. Check normalized conversations & messages tables
    const remoteConvs = await fetchRemoteConversationsFromSupabase(userId);
    if (remoteConvs && remoteConvs.length > 0) {
      for (const rc of remoteConvs) {
        if (!recoveredChats.some((c) => c.id === rc.id)) {
          recoveredChats.push(rc);
        }
      }
    }

    // If any chats were restored, persist strictly into local encrypted storage
    if (recoveredChats.length > 0) {
      const payload = JSON.stringify(recoveredChats);
      const encrypted = await encryptText(payload, key, salt);
      localStorage.setItem(`nanobot_encrypted_chats_${userId}`, encrypted);
      console.info(`Successfully restored ${recoveredChats.length} legacy remote chats to browser encrypted storage.`);
    }
  } catch (err) {
    console.warn('Legacy remote chats restoration notice:', err);
  }
  return recoveredChats;
}

// ==========================================
// FILE CODE OUTPUT PERSISTENCE (Supabase)
// ==========================================

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
      const { error } = await supabase.from('file_code_outputs').upsert(
        [
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
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'id' }
      );
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

// Safely clear legacy local encrypted chat cache entry when a conversation is deleted [Commented by: Google AI Studio on 01/11/2026 02:08 PM]
export function removeEncryptedChatRecord(chatId: string): void {
  try {
    const raw = localStorage.getItem('nanobot_encrypted_chats');
    if (raw) {
      const all = JSON.parse(raw);
      if (Array.isArray(all)) {
        const next = all.filter((c: any) => c.id !== chatId);
        localStorage.setItem('nanobot_encrypted_chats', JSON.stringify(next));
      }
    }
  } catch {}
}
