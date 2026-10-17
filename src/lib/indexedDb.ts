// {IndexedDB manager for local-only original user file storage with quota and error handling} [Commented by: Google AI Studio on 15/10/2026 9:22 AM]

export interface LocalStoredFile {
  fileId: string;
  chatId: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  lastModified: number;
  savedAt: string;
}

const DB_NAME = 'nanobot_local_files_db';
const DB_VERSION = 1;
const STORE_NAME = 'original_files';

let dbPromise: Promise<IDBDatabase> | null = null;

// Initialize or open the IndexedDB database
function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'fileId' });
        store.createIndex('by_chatId', 'chatId', { unique: false });
        store.createIndex('by_savedAt', 'savedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Failed to open IndexedDB.'));
    };

    request.onblocked = () => {
      console.warn('IndexedDB database open request blocked.');
    };
  });

  return dbPromise;
}

/**
 * Save an original user file blob strictly to the user's browser IndexedDB.
 * Never transmits file bytes to any cloud storage.
 */
export async function saveOriginalFile(
  chatId: string,
  fileId: string,
  fileBlob: Blob | File,
  name: string,
  type: string,
  size: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: LocalStoredFile = {
        fileId,
        chatId,
        name,
        type: type || 'application/octet-stream',
        size,
        blob: fileBlob,
        lastModified: fileBlob instanceof File ? fileBlob.lastModified : Date.now(),
        savedAt: new Date().toISOString()
      };

      const request = store.put(record);

      request.onsuccess = () => {
        resolve({ success: true });
      };

      request.onerror = (e) => {
        const error = (e.target as IDBRequest).error;
        let errorMessage = 'Failed to store file locally.';
        if (error?.name === 'QuotaExceededError') {
          errorMessage = 'Browser storage quota exceeded. Please free local browser space or delete older chats.';
        } else if (error) {
          errorMessage = `Storage error: ${error.message}`;
        }
        console.warn('IndexedDB saveOriginalFile warning:', errorMessage, error);
        resolve({ success: false, error: errorMessage });
      };

      tx.onerror = (e) => {
        const error = tx.error;
        const msg = error?.name === 'QuotaExceededError'
          ? 'Browser storage quota exceeded.'
          : error?.message || 'Transaction error storing file.';
        resolve({ success: false, error: msg });
      };
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.warn('IndexedDB open error during save:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Retrieve a specific original file from browser IndexedDB.
 */
export async function getOriginalFile(fileId: string): Promise<LocalStoredFile | null> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(fileId);

      request.onsuccess = () => {
        resolve((request.result as LocalStoredFile) || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Retrieve all original files associated with a specific chat from browser IndexedDB.
 */
export async function getOriginalFilesForChat(chatId: string): Promise<LocalStoredFile[]> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('by_chatId');
      const request = index.getAll(chatId);

      request.onsuccess = () => {
        resolve((request.result as LocalStoredFile[]) || []);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

/**
 * Delete a specific original file from browser IndexedDB.
 */
export async function deleteOriginalFile(fileId: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(fileId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Fail silently
  }
}

/**
 * Delete all original files associated with a chat from browser IndexedDB.
 */
export async function deleteOriginalFilesForChat(chatId: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('by_chatId');
      const req = index.getAllKeys(chatId);

      req.onsuccess = () => {
        const keys = req.result || [];
        keys.forEach((k) => store.delete(k));
        resolve();
      };

      req.onerror = () => resolve();
    });
  } catch {
    // Fail silently
  }
}

/**
 * Clear all stored original files from browser IndexedDB.
 */
export async function clearAllOriginalFiles(): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Fail silently
  }
}

/**
 * Clean up orphaned local files whose chats no longer exist in the provided active chat list.
 */
export async function cleanupOrphanedFiles(activeChatIds: string[]): Promise<number> {
  try {
    const db = await getDb();
    const activeSet = new Set(activeChatIds);
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      let cleanedCount = 0;

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const file = cursor.value as LocalStoredFile;
          if (!activeSet.has(file.chatId)) {
            cursor.delete();
            cleanedCount++;
          }
          cursor.continue();
        } else {
          resolve(cleanedCount);
        }
      };

      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}
