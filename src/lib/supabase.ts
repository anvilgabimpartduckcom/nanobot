// nanobot Supabase Client: Genuine Supabase Auth, Strict User Isolation, and Authoritative Data Persistence [Commented by: Google AI Studio on 01/11/2026 01:52 PM]

import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { deriveKeyFromPassword, generateSalt, encryptText, decryptText } from './crypto';
import { clearAllLocalChatAndFileData } from './localChatStorage'; // Imported unified local chat and file-output cleanup helper [Commented by: Google AI Studio on 28/11/2026 07:30]

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

// UserProfile model strictly without personal email column; auth_email stores internal randomized @nanobot.internal identifier [Commented by: Google AI Studio at 22/11/2026 14:33]
export interface UserProfile {
  id: string;
  username: string;
  auth_email?: string;
  openrouter_key: string;
  tavily_key: string;
  ai_instructions: string;
  model_training: boolean;
  plugins_connected: Record<string, boolean>;
  salt: string;
  theme?: 'Neon Black' | 'Minimalist Light';
}

// Removed FileCodeOutput Supabase model under H-5: file outputs now remain strictly browser-local [Commented by: Google AI Studio on 28/11/2026 07:30]

const INTERNAL_AUTH_EMAIL_DOMAIN = 'nanobot.internal';
const LEGACY_AUTH_EMAIL_DOMAIN = 'nanobot.auth.internal';
const MAX_AUTH_EMAIL_SIGNUP_ATTEMPTS = 5;

function getWorkerBaseUrl(): string {
  return (
    (env.VITE_CLOUDFLARE_WORKER_URL as string) ||
    (env.VITE_WORKER_URL as string) ||
    'https://nanobot-api.mud-amiable-tweed.workers.dev'
  ).replace(/\/$/, '');
}

// Cryptographically random Supabase Auth email generator independent of username and password [Commented by: Google AI Studio at 22/11/2026 14:33]
export function formatAuthEmail(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('Secure random number generation (crypto.getRandomValues) is unavailable.');
  }
  const randomBytes = new Uint8Array(24);
  cryptoApi.getRandomValues(randomBytes);
  const identifier = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${identifier}@${INTERNAL_AUTH_EMAIL_DOMAIN}`;
}

// Legacy deterministic format retained strictly as read-only fallback for migrating pre-existing accounts [Commented by: Google AI Studio at 22/11/2026 14:33]
export function formatLegacyAuthEmail(username: string): string {
  const sanitized = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return `${sanitized || 'user'}@${LEGACY_AUTH_EMAIL_DOMAIN}`;
}

export function isLegacyAuthEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  return email.trim().toLowerCase().endsWith(`@${LEGACY_AUTH_EMAIL_DOMAIN}`);
}

// Classify RPC missing-function and network errors so broken backend configuration fails closed [Commented by: Google AI Studio at 24/11/2026 09:45]
function getSupabaseErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return typeof err === 'string' ? err : '';
}

function isMissingRpcError(err: unknown, rpcName?: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; status?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const status = typeof e.status === 'number' ? e.status : undefined;
  const code = typeof e.code === 'string' ? e.code.toUpperCase() : '';
  const combined = `${typeof e.message === 'string' ? e.message : ''} ${typeof e.details === 'string' ? e.details : ''} ${typeof e.hint === 'string' ? e.hint : ''}`.toLowerCase();

  if (status === 404 || code === 'PGRST202' || code === '42883') {
    return true;
  }
  if (
    combined.includes('could not find the function') ||
    combined.includes('does not exist') ||
    combined.includes('in the schema cache')
  ) {
    return true;
  }
  if (rpcName && combined.includes(rpcName.toLowerCase()) && combined.includes('not found')) {
    return true;
  }
  return false;
}

function isNetworkRpcError(err: unknown): boolean {
  const msg = getSupabaseErrorMessage(err).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('timeout')
  );
}

// Resolve stable internal auth email for login via SECURITY DEFINER RPC; fail closed on missing RPC or service failure [Commented by: Google AI Studio at 24/11/2026 09:48]
export async function getStoredAuthEmailForUsername(
  username: string,
  clientOverride?: SupabaseClient | null
): Promise<string | null> {
  const trimmed = username.trim();
  if (!trimmed) return null;

  const activeClient = clientOverride !== undefined ? clientOverride : supabase;
  if (!activeClient) {
    throw new Error('Authentication service is not configured. Unable to look up account credentials.');
  }

  let data: unknown;
  let error: unknown;
  try {
    const rpcResult = clientOverride
      ? await clientOverride.rpc('get_auth_email_for_username', {
          username_to_lookup: trimmed,
        })
      : supabase
        ? await supabase.rpc('get_auth_email_for_username', {
            username_to_lookup: trimmed,
          })
        : await activeClient.rpc('get_auth_email_for_username', {
            username_to_lookup: trimmed,
          });
    data = rpcResult.data;
    error = rpcResult.error;
  } catch (err: unknown) {
    if (isMissingRpcError(err, 'get_auth_email_for_username')) {
      throw new Error(
        'Sign-in is temporarily unavailable due to a database service configuration issue (missing get_auth_email_for_username RPC). Please contact the administrator.'
      );
    }
    if (isNetworkRpcError(err)) {
      throw new Error('Unable to reach the authentication service. Please check your connection and try again.');
    }
    throw new Error(`Account lookup failed: ${getSupabaseErrorMessage(err) || 'Authentication service error.'}`);
  }

  if (error) {
    if (isMissingRpcError(error, 'get_auth_email_for_username')) {
      throw new Error(
        'Sign-in is temporarily unavailable due to a database service configuration issue (missing get_auth_email_for_username RPC). Please contact the administrator.'
      );
    }
    if (isNetworkRpcError(error)) {
      throw new Error('Unable to reach the authentication service. Please check your connection and try again.');
    }
    throw new Error(`Account lookup failed: ${getSupabaseErrorMessage(error) || 'Authentication service error.'}`);
  }

  // Only a successful RPC returning empty/null permits the legacy @nanobot.auth.internal fallback
  if (data === null || data === undefined || (typeof data === 'string' && data.trim() === '')) {
    return null;
  }

  if (typeof data !== 'string' || !data.trim().includes('@')) {
    throw new Error('Account lookup returned an unexpected response from the authentication service.');
  }

  return data.trim().toLowerCase();
}

// Best-effort server-side migration for legacy @nanobot.auth.internal accounts via Cloudflare Worker Admin API [Commented by: Google AI Studio at 22/11/2026 14:33]
export async function migrateLegacyAuthEmailOnServer(accessToken?: string): Promise<boolean> {
  if (!accessToken || !supabase) return false;
  const workerBase = getWorkerBaseUrl();
  if (!workerBase) return false;

  try {
    const res = await fetch(`${workerBase}/api/auth/migrate-internal-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return false;
    const result = (await res.json().catch(() => null)) as { success?: boolean; migrated?: boolean } | null;
    if (result?.success && result?.migrated) {
      await supabase.auth.refreshSession().catch(() => {});
      return true;
    }
  } catch {
    // Non-blocking: preserve active login/session even if Worker endpoint is unreachable
  }
  return false;
}

// Update account password in Supabase Auth without modifying or regenerating internal auth email [Commented by: Google AI Studio at 22/11/2026 14:33]
export async function updateAccountPasswordInSupabase(newPassword: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  const trimmed = newPassword.trim();
  if (!trimmed) {
    throw new Error('New password cannot be empty.');
  }
  const { error } = await supabase.auth.updateUser({
    password: trimmed,
  });
  if (error) {
    throw new Error(error.message || 'Failed to update account password.');
  }
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
    // Verify connectivity against account profile table without querying conversations [Commented by: Google AI Studio on 28/11/2026 07:30]
    const { error } = await supabase.from('user_profiles').select('id').limit(1);
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

// Check username availability failing closed on missing RPC, network errors, or unexpected responses [Commented by: Google AI Studio at 24/11/2026 09:48]
export async function checkUsernameAvailable(
  username: string,
  clientOverride?: SupabaseClient | null
): Promise<boolean> {
  const trimmed = username.trim();
  if (!trimmed) return false;

  const activeClient = clientOverride !== undefined ? clientOverride : supabase;
  if (!activeClient) {
    throw new Error('Authentication service is not configured. Username availability cannot be verified.');
  }

  let data: unknown;
  let error: unknown;
  try {
    const rpcResult = clientOverride
      ? await clientOverride.rpc('check_username_available', {
          username_to_check: trimmed,
        })
      : supabase
        ? await supabase.rpc('check_username_available', {
            username_to_check: trimmed,
          })
        : await activeClient.rpc('check_username_available', {
            username_to_check: trimmed,
          });
    data = rpcResult.data;
    error = rpcResult.error;
  } catch (err: unknown) {
    if (isMissingRpcError(err, 'check_username_available')) {
      throw new Error(
        'Registration is temporarily unavailable due to a database service configuration issue (missing check_username_available RPC). Please contact the administrator.'
      );
    }
    if (isNetworkRpcError(err)) {
      throw new Error('Network error: unable to reach the authentication service to verify username availability. Please check your connection and try again.');
    }
    throw new Error(`Unable to verify username availability: ${getSupabaseErrorMessage(err) || 'Service error.'}`);
  }

  if (error) {
    if (isMissingRpcError(error, 'check_username_available')) {
      throw new Error(
        'Registration is temporarily unavailable due to a database service configuration issue (missing check_username_available RPC). Please contact the administrator.'
      );
    }
    if (isNetworkRpcError(error)) {
      throw new Error('Network error: unable to reach the authentication service to verify username availability. Please check your connection and try again.');
    }
    throw new Error(`Unable to verify username availability: ${getSupabaseErrorMessage(error) || 'Service error.'}`);
  }

  if (typeof data !== 'boolean') {
    throw new Error('Unable to verify username availability due to an unexpected response from the authentication service.');
  }

  return data;
}

export const LEGACY_LOCAL_PROFILES_STORAGE_KEY = 'nanobot_supabase_users';

export function clearLegacyLocalProfileCache(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_LOCAL_PROFILES_STORAGE_KEY);
    localStorage.removeItem('nanobot_active_user');
  } catch {}
}

// Genuine Supabase Auth Sign Up with fail-closed availability check and orphaned-session cleanup on profile setup failure [Commented by: Google AI Studio at 24/11/2026 09:45]
export async function signUpWithUsername(
  username: string,
  password: string,
  openrouterKey: string,
  tavilyKey: string,
  clientOverride?: SupabaseClient | null
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

  const activeClient = clientOverride !== undefined ? clientOverride : supabase;
  if (!activeClient) {
    throw new Error('Supabase client is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
  }

  // Check username availability first (fails closed if RPC is missing or service fails)
  const isAvailable = await checkUsernameAvailable(uName, clientOverride);
  if (!isAvailable) {
    throw new Error('This username is already taken. Please choose another username.');
  }

  // Snapshot any pre-existing unrelated session before attempting auth.signUp()
  let preExistingSession: Session | null = null;
  try {
    const { data: existingSessionData } = await activeClient.auth.getSession();
    preExistingSession = existingSessionData?.session ?? null;
  } catch {
    preExistingSession = null;
  }

  // 1. Create authentic Supabase Auth user with a randomized internal email and safe duplicate-email retry
  let authEmail = '';
  let authUser: User | null = null;
  let session: Session | null = null;
  let lastAuthErr: { message?: string; status?: number } | null = null;

  for (let attempt = 0; attempt < MAX_AUTH_EMAIL_SIGNUP_ATTEMPTS; attempt++) {
    authEmail = formatAuthEmail();
    const { data: authData, error: authErr } = await activeClient.auth.signUp({
      email: authEmail,
      password: pwd,
    });

    if (!authErr && authData.user) {
      authUser = authData.user;
      session = authData.session;
      break;
    }

    lastAuthErr = authErr;
    const msgLower = (authErr?.message || '').toLowerCase();
    const isDuplicateEmail =
      authErr?.status === 422 ||
      msgLower.includes('already registered') ||
      msgLower.includes('already exists') ||
      msgLower.includes('duplicate');

    if (!isDuplicateEmail) {
      break;
    }
  }

  if (lastAuthErr && !authUser) {
    const authErr = lastAuthErr;
    throw new Error(authErr.message || 'Failed to create user account with Supabase Auth.');
  }

  if (!authUser) {
    throw new Error('Supabase Auth did not return a valid user identity.');
  }

  // Establish authentic session
  if (!session) {
    const { data: signInData, error: signInErr } = await activeClient.auth.signInWithPassword({
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

  const createdUserId = authUser.id;
  const cleanupNewlyCreatedSession = async (): Promise<string | null> => {
    try {
      let currentSessionUserId: string | null = null;
      try {
        const { data: currentData } = await activeClient.auth.getSession();
        currentSessionUserId = currentData?.session?.user?.id ?? null;
      } catch {
        currentSessionUserId = session?.user?.id ?? null;
      }

      if (preExistingSession && preExistingSession.user?.id && preExistingSession.user.id !== createdUserId) {
        // Never sign out an unrelated pre-existing session; only clear the newly created session if it replaced local storage
        if (currentSessionUserId === createdUserId) {
          const { error: localSignOutErr } = await activeClient.auth.signOut({ scope: 'local' });
          if (localSignOutErr) {
            return localSignOutErr.message || 'Failed to remove orphaned signup session from local storage.';
          }
          if (
            typeof activeClient.auth.setSession === 'function' &&
            preExistingSession.access_token &&
            preExistingSession.refresh_token
          ) {
            const { error: restoreErr } = await activeClient.auth.setSession({
              access_token: preExistingSession.access_token,
              refresh_token: preExistingSession.refresh_token,
            });
            if (restoreErr) {
              return `Removed failed signup session, but could not restore previous session: ${restoreErr.message}`;
            }
          }
        }
        return null;
      }

      // Only sign out locally when no unrelated session is active
      if (!currentSessionUserId || currentSessionUserId === createdUserId) {
        const { error: localSignOutErr } = await activeClient.auth.signOut({ scope: 'local' });
        if (localSignOutErr) {
          return localSignOutErr.message || 'Failed to clear orphaned session from local storage.';
        }
      }
      return null;
    } catch (cleanupEx: unknown) {
      return cleanupEx instanceof Error ? cleanupEx.message : String(cleanupEx);
    }
  };

  let salt = '';
  let encryptedOpenRouter = '';
  let encryptedTavily = '';
  try {
    // 2. Generate zero-knowledge encryption salt & encrypt sensitive API keys (fails closed if key derivation or encryption errors)
    salt = generateSalt();
    const cryptoKey = await deriveKeyFromPassword(pwd, salt);
    encryptedOpenRouter = await encryptText(orKey, cryptoKey, salt);
    encryptedTavily = await encryptText(tvKey, cryptoKey, salt);
  } catch (cryptoErr: unknown) {
    const origMsg = getSupabaseErrorMessage(cryptoErr) || 'Failed to encrypt API credentials.';
    console.error('Failed to encrypt credentials during signup:', origMsg);
    const cleanupErr = await cleanupNewlyCreatedSession();
    if (cleanupErr) {
      console.error('Orphaned auth session cleanup failed after encryption error:', cleanupErr);
      const err = new Error(
        `Account setup failed while encrypting your credentials (${origMsg}). Automatic local session cleanup also failed (${cleanupErr}); please clear browser site data or sign out before retrying.`
      ) as Error & { originalError?: string; cleanupError?: string | null };
      err.originalError = origMsg;
      err.cleanupError = cleanupErr;
      throw err;
    }
    const err = new Error(
      `Account setup failed while encrypting your credentials: ${origMsg}. Your incomplete sign-in session was cleared.`
    ) as Error & { originalError?: string; cleanupError?: string | null };
    err.originalError = origMsg;
    err.cleanupError = null;
    throw err;
  }

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

  // 3. Persist profile record tied to authUser.id with randomized auth_email mapping (strictly without personal email) [Commented by: Google AI Studio at 22/11/2026 14:33]
  const baseProfilePayload = {
    id: authUser.id,
    username: uName,
    openrouter_key: encryptedOpenRouter,
    tavily_key: encryptedTavily,
    ai_instructions: '',
    model_training: true,
    plugins_connected: initialPlugins,
    salt: salt,
    theme: 'Neon Black',
  };

  let profileErr: { code?: string; message: string } | null = null;
  try {
    const primaryInsert = await activeClient.from('user_profiles').insert([
      {
        ...baseProfilePayload,
        auth_email: authEmail,
      },
    ]);
    profileErr = primaryInsert.error;

    if (
      profileErr &&
      (profileErr.code === '42703' || profileErr.code === 'PGRST204' || profileErr.message.includes('auth_email'))
    ) {
      // Graceful fallback if auth_email column migration has not yet been applied in Supabase; auth.users still retains authEmail
      const fallbackInsert = await activeClient.from('user_profiles').insert([baseProfilePayload]);
      profileErr = fallbackInsert.error;
    }
  } catch (insertEx: unknown) {
    profileErr = { message: getSupabaseErrorMessage(insertEx) || 'Database request failed while creating profile.' };
  }

  if (profileErr) {
    const rawProfileMsg = profileErr.message || 'Unknown database error';
    const isSchemaMismatch =
      rawProfileMsg.toLowerCase().includes('schema cache') ||
      profileErr.code === '42703' ||
      profileErr.code === 'PGRST204';
    const actionableMsg = isSchemaMismatch
      ? `Database profile schema is out of date (${rawProfileMsg}). Please apply the latest Supabase migration and try again.`
      : rawProfileMsg;

    console.error('Failed to create user profile in Supabase:', rawProfileMsg);
    const cleanupErr = await cleanupNewlyCreatedSession();

    if (cleanupErr) {
      console.error('Orphaned auth session cleanup failed after profile creation error:', cleanupErr);
      const err = new Error(
        `Account creation failed because your user profile could not be saved (${actionableMsg}). Automatic local session cleanup also failed (${cleanupErr}); please clear your browser session or sign out before retrying.`
      ) as Error & { originalError?: string; cleanupError?: string | null };
      err.originalError = actionableMsg;
      err.cleanupError = cleanupErr;
      throw err;
    }

    const err = new Error(
      `Account creation failed because your user profile could not be saved: ${actionableMsg}. Any incomplete local sign-in session has been cleared.`
    ) as Error & { originalError?: string; cleanupError?: string | null };
    err.originalError = actionableMsg;
    err.cleanupError = null;
    throw err;
  }

  const resolvedUser: UserProfile = {
    id: authUser.id,
    username: uName,
    auth_email: authEmail,
    openrouter_key: orKey,
    tavily_key: tvKey,
    ai_instructions: '',
    model_training: true,
    plugins_connected: initialPlugins,
    salt: salt,
    theme: 'Neon Black',
  };

  // Purge any obsolete localStorage profile cache instead of persisting decrypted credentials [Commented by: Google AI Studio at 23/11/2026 22:30]
  clearLegacyLocalProfileCache();

  return { user: resolvedUser, session };
}

// Genuine Supabase Auth Sign In retrieving stable internal auth email and migrating legacy accounts non-destructively [Commented by: Google AI Studio at 24/11/2026 09:45]
export async function signInWithUsername(
  username: string,
  password: string,
  clientOverride?: SupabaseClient | null
): Promise<{ user: UserProfile; session: Session }> {
  const uName = username.trim();
  const pwd = password.trim();

  if (!uName || !pwd) {
    throw new Error('Please enter both username and password.');
  }

  const activeClient = clientOverride !== undefined ? clientOverride : supabase;
  if (!activeClient) {
    throw new Error('Supabase client is not configured.');
  }

  // Look up existing internal auth email; only fall back to legacy @nanobot.auth.internal when RPC executes cleanly and returns null
  const storedAuthEmail = await getStoredAuthEmailForUsername(uName, clientOverride);
  const resolvedAuthEmail = storedAuthEmail || formatLegacyAuthEmail(uName);

  // 1. Authenticate with Supabase Auth
  const { data: authData, error: authErr } = await activeClient.auth.signInWithPassword({
    email: resolvedAuthEmail,
    password: pwd,
  });

  if (authErr || !authData.session || !authData.user) {
    throw new Error(authErr?.message || 'Invalid username or password.');
  }

  const userId = authData.user.id;
  const sessionEmail = (authData.user.email || resolvedAuthEmail).trim().toLowerCase();

  // 2. Fetch authenticated user's private profile using strict RLS auth.uid() = id
  const { data: profileRow, error: profileErr } = await activeClient
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr || !profileRow) {
    throw new Error('Profile record not found for this account.');
  }

  // Reconcile stored auth_email if non-legacy email is missing or differs on profile row
  if (sessionEmail && !isLegacyAuthEmail(sessionEmail) && profileRow.auth_email !== sessionEmail) {
    activeClient
      .from('user_profiles')
      .update({ auth_email: sessionEmail, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .then(() => {}, () => {});
  }

  // Trigger background migration for legacy @nanobot.auth.internal accounts preserving same user ID and password
  if (isLegacyAuthEmail(sessionEmail)) {
    void migrateLegacyAuthEmailOnServer(authData.session.access_token);
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
    auth_email: profileRow.auth_email || sessionEmail,
    openrouter_key: decryptedOr,
    tavily_key: decryptedTv,
    ai_instructions: decryptedInst,
    model_training: profileRow.model_training ?? true,
    plugins_connected: profileRow.plugins_connected || {},
    salt: profileRow.salt,
    theme: profileRow.theme || 'Neon Black',
  };

  // Purge any obsolete localStorage profile cache instead of persisting decrypted credentials [Commented by: Google AI Studio at 23/11/2026 22:30]
  clearLegacyLocalProfileCache();

  return { user: userProfile, session: authData.session };
}

// Restore active Supabase session and user profile on app load without regenerating internal auth email [Commented by: Google AI Studio at 22/11/2026 14:33]
export async function restoreActiveSession(passwordSecret?: string): Promise<{ user: UserProfile | null; session: Session | null }> {
  clearLegacyLocalProfileCache();
  if (!supabase) return { user: null, session: null };

  try {
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session || !session.user) {
      return { user: null, session: null };
    }

    const userId = session.user.id;
    const sessionEmail = (session.user.email || '').trim().toLowerCase();
    const { data: profileRow, error: profileErr } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr || !profileRow) {
      return { user: null, session };
    }

    if (sessionEmail && !isLegacyAuthEmail(sessionEmail) && profileRow.auth_email !== sessionEmail) {
      supabase
        .from('user_profiles')
        .update({ auth_email: sessionEmail, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .then(() => {}, () => {});
    }

    if (isLegacyAuthEmail(sessionEmail)) {
      void migrateLegacyAuthEmailOnServer(session.access_token);
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
      auth_email: profileRow.auth_email || sessionEmail || undefined,
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

// Sign out from Supabase Auth with local-session fallback and fail-closed error propagation [Commented by: Google AI Studio at 25/11/2026 22:57]
export async function signOutSupabase(): Promise<void> {
  clearLegacyLocalProfileCache();
  if (!supabase) return;

  let globalErrorMessage: string | null = null;
  try {
    const res = await supabase.auth.signOut();
    if (res?.error) {
      globalErrorMessage = res.error.message || 'Global sign-out error';
    }
  } catch (err: unknown) {
    globalErrorMessage = err instanceof Error ? err.message : 'Unexpected sign-out error';
  }

  if (globalErrorMessage) {
    console.warn('Supabase sign out error; ensuring local session termination:', globalErrorMessage);
    const localRes = await supabase.auth.signOut({ scope: 'local' });
    if (localRes?.error) {
      throw new Error(localRes.error.message || globalErrorMessage);
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


    // 2. Clear all regular, incognito, legacy, migration, and file-output local storage entries for this browser [Commented by: Google AI Studio on 28/11/2026 07:30]
    clearAllLocalChatAndFileData(userId, { includeIncognito: true, includeGuest: true });
    clearLegacyLocalProfileCache();

    // 3. Sign out of Supabase Auth
    await supabase.auth.signOut().catch(() => {});
    return true;
  } catch (err) {
    console.error('Failed to delete account from Supabase:', err);
    throw err;
  }
}

// Removed Supabase conversation, message, migration, and file_code_outputs persistence helpers under H-5: regular/incognito chats and file outputs remain strictly browser-local [Commented by: Google AI Studio on 28/11/2026 07:30]
