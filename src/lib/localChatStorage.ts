// Pure browser-local persistence helpers for regular chats, incognito chats, and local file outputs (zero cloud/Supabase fallback) [Commented by: Google AI Studio on 28/11/2026 07:25]

import { encryptText, decryptText } from './crypto';

export const REGULAR_GUEST_CHATS_KEY = 'nanobot_chats';
export const LEGACY_ENCRYPTED_CHATS_KEY = 'nanobot_encrypted_chats';
export const INCOGNITO_CHATS_KEY = 'nanobot_incognito_chats';
export const INCOGNITO_MODE_KEY = 'nanobot_incognito_mode';

export function getEncryptedChatsStorageKey(userId: string): string {
  return `nanobot_encrypted_chats_${userId}`;
}

export function getLocalFileOutputsStorageKey(scope: string, conversationId: string): string {
  return `nanobot_file_outputs_${scope}_${conversationId}`;
}

export interface LocalChatAttachmentRef {
  type: string;
  name: string;
  fileId?: string;
  isLocalMissing?: boolean;
}

export interface LocalChatMessage {
  id?: string;
  role: 'user' | 'ai';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  createdAt?: string;
  sources?: Array<{ title: string; url: string }>;
  reasoning?: string;
  displayAttachments?: LocalChatAttachmentRef[];
  metadata?: Record<string, unknown>;
}

export interface LocalChatSession {
  id: string;
  title: string;
  messages: LocalChatMessage[];
  pinned: boolean;
  updated: number;
  shareId?: string;
}

export interface LocalFileOutputRecord {
  id?: string;
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

export interface LocalPersistenceResult {
  success: boolean;
  locked?: boolean;
  isQuotaError?: boolean;
  error?: string;
}

export interface LocalLoadChatsResult {
  chats: LocalChatSession[];
  locked: boolean;
  hasEncryptedData: boolean;
  migratedLegacyGuestChats?: boolean;
  error?: string;
}

function getStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function classifyStorageWriteError(err: unknown): { isQuotaError: boolean; message: string } {
  const e = err as { name?: string; code?: number; message?: string } | null;
  const msg = e?.message || String(err || 'Unknown browser storage error');
  const isQuota =
    e?.name === 'QuotaExceededError' ||
    e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e?.code === 22 ||
    e?.code === 1014 ||
    msg.toLowerCase().includes('quota');

  if (isQuota) {
    return {
      isQuotaError: true,
      message:
        'Browser localStorage quota exceeded. Please delete older chats or export backups; changes could not be saved locally.',
    };
  }
  return {
    isQuotaError: false,
    message: `Browser localStorage save failed (${msg}). Changes could not be saved locally.`,
  };
}

// Persist regular chats strictly in browser localStorage; fail closed without key and never fall back to cloud storage [Commented by: Google AI Studio on 28/11/2026 07:25]
export async function saveRegularChatsLocally(
  allChats: LocalChatSession[],
  opts: {
    userId?: string | null;
    cryptoKey?: CryptoKey | null;
    salt?: string | null;
  } = {}
): Promise<LocalPersistenceResult> {
  const storage = getStorage();
  if (!storage) {
    return {
      success: false,
      error: 'Browser localStorage is unavailable. Regular chats could not be saved.',
    };
  }

  if (opts.userId) {
    if (!opts.cryptoKey) {
      return {
        success: false,
        locked: true,
        error:
          'Your encrypted regular chat history is locked. Open Settings > Account and enter your password to unlock before saving regular chats.',
      };
    }

    try {
      const payload = JSON.stringify(allChats);
      const encrypted = await encryptText(payload, opts.cryptoKey, opts.salt || 'salt');
      storage.setItem(getEncryptedChatsStorageKey(opts.userId), encrypted);
      return { success: true };
    } catch (err: unknown) {
      const classified = classifyStorageWriteError(err);
      return {
        success: false,
        isQuotaError: classified.isQuotaError,
        error: classified.message,
      };
    }
  }

  try {
    storage.setItem(REGULAR_GUEST_CHATS_KEY, JSON.stringify(allChats));
    return { success: true };
  } catch (err: unknown) {
    const classified = classifyStorageWriteError(err);
    return {
      success: false,
      isQuotaError: classified.isQuotaError,
      error: classified.message,
    };
  }
}

// Load regular chats strictly from browser localStorage; never read from Supabase or downgrade encrypted signed-in history [Commented by: Google AI Studio on 28/11/2026 07:25]
export async function loadRegularChatsLocally(
  opts: {
    userId?: string | null;
    cryptoKey?: CryptoKey | null;
    salt?: string | null;
  } = {}
): Promise<LocalLoadChatsResult> {
  const storage = getStorage();
  if (!storage) {
    return {
      chats: [],
      locked: false,
      hasEncryptedData: false,
      error: 'Browser localStorage is unavailable.',
    };
  }

  if (opts.userId) {
    const encryptedKey = getEncryptedChatsStorageKey(opts.userId);
    let rawEncrypted: string | null = null;
    try {
      rawEncrypted = storage.getItem(encryptedKey);
    } catch {
      return {
        chats: [],
        locked: false,
        hasEncryptedData: false,
        error: 'Unable to read regular chat history from browser localStorage.',
      };
    }

    if (!opts.cryptoKey) {
      return {
        chats: [],
        locked: true,
        hasEncryptedData: Boolean(rawEncrypted),
        error:
          'Your encrypted regular chat history is locked on this session. Open Settings > Account and enter your password to unlock your saved chats.',
      };
    }

    if (rawEncrypted) {
      try {
        const decrypted = await decryptText(rawEncrypted, opts.cryptoKey);
        const parsed = JSON.parse(decrypted);
        return {
          chats: Array.isArray(parsed) ? parsed : [],
          locked: false,
          hasEncryptedData: true,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to decrypt local chat history.';
        return {
          chats: [],
          locked: true,
          hasEncryptedData: true,
          error: `Could not decrypt local regular chat history (${message}). Verify your password in Settings > Account.`,
        };
      }
    }

    // One-time local-only upgrade of unencrypted guest chats into this user's encrypted local store (never sent to Supabase) [Commented by: Google AI Studio on 28/11/2026 07:25]
    try {
      const legacyGuest = storage.getItem(REGULAR_GUEST_CHATS_KEY);
      if (legacyGuest) {
        const parsed = JSON.parse(legacyGuest);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const saveRes = await saveRegularChatsLocally(parsed, {
            userId: opts.userId,
            cryptoKey: opts.cryptoKey,
            salt: opts.salt,
          });
          if (saveRes.success) {
            storage.removeItem(REGULAR_GUEST_CHATS_KEY);
            return {
              chats: parsed,
              locked: false,
              hasEncryptedData: true,
              migratedLegacyGuestChats: true,
            };
          }
          return {
            chats: parsed,
            locked: false,
            hasEncryptedData: false,
            error: saveRes.error,
          };
        }
      }
    } catch {}

    return { chats: [], locked: false, hasEncryptedData: false };
  }

  try {
    const raw = storage.getItem(REGULAR_GUEST_CHATS_KEY);
    if (!raw) return { chats: [], locked: false, hasEncryptedData: false };
    const parsed = JSON.parse(raw);
    return {
      chats: Array.isArray(parsed) ? parsed : [],
      locked: false,
      hasEncryptedData: false,
    };
  } catch {
    return {
      chats: [],
      locked: false,
      hasEncryptedData: false,
      error: 'Stored regular chat data could not be parsed from localStorage.',
    };
  }
}

// Persist incognito chats in a dedicated isolated localStorage key without touching regular chats, Supabase, or Cloudflare [Commented by: Google AI Studio on 28/11/2026 07:25]
export function saveIncognitoChatsLocally(incognitoChats: LocalChatSession[]): LocalPersistenceResult {
  const storage = getStorage();
  if (!storage) {
    return {
      success: false,
      error: 'Browser localStorage is unavailable. Incognito chats could not be saved locally.',
    };
  }

  try {
    storage.setItem(INCOGNITO_CHATS_KEY, JSON.stringify(incognitoChats));
    return { success: true };
  } catch (err: unknown) {
    const classified = classifyStorageWriteError(err);
    return {
      success: false,
      isQuotaError: classified.isQuotaError,
      error: classified.message,
    };
  }
}

// Restore incognito chats strictly from dedicated localStorage key across page refreshes [Commented by: Google AI Studio on 28/11/2026 07:25]
export function loadIncognitoChatsLocally(): { chats: LocalChatSession[]; error?: string } {
  const storage = getStorage();
  if (!storage) {
    return { chats: [], error: 'Browser localStorage is unavailable.' };
  }

  try {
    const raw = storage.getItem(INCOGNITO_CHATS_KEY);
    if (!raw) return { chats: [] };
    const parsed = JSON.parse(raw);
    return { chats: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { chats: [], error: 'Stored incognito chats could not be parsed from localStorage.' };
  }
}

// Persist incognito mode flag without deleting incognito chat history when toggled off [Commented by: Google AI Studio on 28/11/2026 07:25]
export function setIncognitoModeFlagLocally(active: boolean): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(INCOGNITO_MODE_KEY, active ? 'true' : 'false');
  } catch {}
}

export function getIncognitoModeFlagLocally(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    return storage.getItem(INCOGNITO_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Explicit incognito history cleanup (only invoked on explicit user clear or account deletion) [Commented by: Google AI Studio on 28/11/2026 07:25]
export function clearIncognitoHistoryLocally(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(INCOGNITO_CHATS_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (k && k.startsWith('nanobot_file_outputs_incognito_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => storage.removeItem(k));
  } catch {}
}

// Save extracted file outputs and reader_code strictly to browser localStorage (never Supabase) [Commented by: Google AI Studio on 28/11/2026 07:25]
export async function saveLocalFileOutput(
  scope: string,
  record: LocalFileOutputRecord,
  opts?: {
    cryptoKey?: CryptoKey | null;
    salt?: string | null;
    requireEncryption?: boolean;
  }
): Promise<LocalPersistenceResult> {
  const storage = getStorage();
  if (!storage) {
    return {
      success: false,
      error: 'Browser localStorage is unavailable. File outputs could not be saved locally.',
    };
  }

  if (opts?.requireEncryption && !opts.cryptoKey) {
    return {
      success: false,
      locked: true,
      error: 'Encryption key is locked; unlock your account in Settings > Account to save encrypted file outputs.',
    };
  }

  let recordToStore: LocalFileOutputRecord = {
    ...record,
    updated_at: record.updated_at || new Date().toISOString(),
    created_at: record.created_at || new Date().toISOString(),
  };

  if (opts?.cryptoKey) {
    try {
      const encExtracted =
        recordToStore.extracted_output && !recordToStore.extracted_output.startsWith('enc:')
          ? await encryptText(recordToStore.extracted_output, opts.cryptoKey, opts.salt || 'salt')
          : recordToStore.extracted_output;
      const encReader =
        recordToStore.reader_code && !recordToStore.reader_code.startsWith('enc:')
          ? await encryptText(recordToStore.reader_code, opts.cryptoKey, opts.salt || 'salt')
          : recordToStore.reader_code;
      recordToStore = {
        ...recordToStore,
        extracted_output: encExtracted,
        reader_code: encReader,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to encrypt file output locally.',
      };
    }
  }

  const localKey = getLocalFileOutputsStorageKey(scope, record.conversation_id);
  try {
    const existingRaw = storage.getItem(localKey);
    const parsed = existingRaw ? JSON.parse(existingRaw) : [];
    const existing: LocalFileOutputRecord[] = Array.isArray(parsed) ? parsed : [];
    const filtered = existing.filter((o) => o.source_file_id !== recordToStore.source_file_id);
    filtered.push(recordToStore);
    storage.setItem(localKey, JSON.stringify(filtered));
    return { success: true };
  } catch (err: unknown) {
    const classified = classifyStorageWriteError(err);
    return {
      success: false,
      isQuotaError: classified.isQuotaError,
      error: classified.message,
    };
  }
}

// Load extracted file outputs and reader_code strictly from browser localStorage [Commented by: Google AI Studio on 28/11/2026 07:25]
export async function loadLocalFileOutputs(
  scope: string,
  conversationId: string,
  cryptoKey?: CryptoKey | null
): Promise<LocalFileOutputRecord[]> {
  const storage = getStorage();
  if (!storage) return [];

  const localKey = getLocalFileOutputsStorageKey(scope, conversationId);
  let records: LocalFileOutputRecord[] = [];
  try {
    const raw = storage.getItem(localKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) records = parsed;
    }
  } catch {
    return [];
  }

  return Promise.all(
    records.map(async (rec) => {
      let extracted = rec.extracted_output || '';
      let readerCode = rec.reader_code || '';
      if (cryptoKey) {
        if (extracted.startsWith('enc:')) {
          try {
            extracted = await decryptText(extracted, cryptoKey);
          } catch {}
        }
        if (readerCode.startsWith('enc:')) {
          try {
            readerCode = await decryptText(readerCode, cryptoKey);
          } catch {}
        }
      }
      return {
        ...rec,
        extracted_output: extracted,
        reader_code: readerCode,
      };
    })
  );
}

// Delete per-conversation file outputs and legacy local file metadata strictly from localStorage [Commented by: Google AI Studio on 28/11/2026 07:25]
export function deleteLocalConversationArtifacts(scope: string, conversationId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(getLocalFileOutputsStorageKey(scope, conversationId));
    storage.removeItem(`nanobot_files_${conversationId}`);
    storage.removeItem(`nanobot_r2_archive_${conversationId}`);
  } catch {}
}

// Comprehensive local cleanup for account deletion covering regular, incognito, migration, and file-output keys [Commented by: Google AI Studio on 28/11/2026 07:25]
export function clearAllLocalChatAndFileData(
  userId?: string | null,
  opts: { includeIncognito?: boolean; includeGuest?: boolean } = { includeIncognito: true, includeGuest: true }
): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    if (opts.includeGuest !== false) {
      storage.removeItem(REGULAR_GUEST_CHATS_KEY);
    }
    storage.removeItem(LEGACY_ENCRYPTED_CHATS_KEY);
    storage.removeItem('nanobot_active_user');

    if (userId) {
      storage.removeItem(getEncryptedChatsStorageKey(userId));
      storage.removeItem(`nanobot_migration_progress_${userId}`);
      storage.removeItem(`nanobot_migration_lock_${userId}`);
    }

    if (opts.includeIncognito !== false) {
      storage.removeItem(INCOGNITO_CHATS_KEY);
      storage.removeItem(INCOGNITO_MODE_KEY);
    }

    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (!k) continue;
      if (k.startsWith('nanobot_files_') || k.startsWith('nanobot_r2_archive_')) {
        keysToRemove.push(k);
        continue;
      }
      if (userId && (k.startsWith(`nanobot_file_outputs_${userId}_`) || k.startsWith(`nanobot_migration_`) && k.includes(userId))) {
        keysToRemove.push(k);
        continue;
      }
      if (opts.includeGuest !== false && k.startsWith('nanobot_file_outputs_guest_')) {
        keysToRemove.push(k);
        continue;
      }
      if (opts.includeIncognito !== false && k.startsWith('nanobot_file_outputs_incognito_')) {
        keysToRemove.push(k);
        continue;
      }
    }
    keysToRemove.forEach((k) => storage.removeItem(k));
  } catch {}
}
