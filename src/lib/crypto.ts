// Nanobot Web Crypto AES-GCM-256 Client-Side Zero-Knowledge Encryption [Commented by: Google AI Studio on 01/11/2026 02:20 PM]

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  salt: string;
}

const webCrypto = typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : (typeof window !== 'undefined' ? window.crypto : undefined);

// Helper to convert Uint8Array to Base64 with universal runtime support [Commented by: Google AI Studio on 01/11/2026 02:20 PM]
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

// Helper to convert Base64 to Uint8Array with universal runtime support [Commented by: Google AI Studio on 01/11/2026 02:20 PM]
export function base64ToBuffer(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Generate random salt for key derivation
export function generateSalt(length = 16): string {
  if (!webCrypto) throw new Error('Web Crypto API is not available in the current runtime environment');
  const salt = webCrypto.getRandomValues(new Uint8Array(length));
  return bufferToBase64(salt);
}

// Derive AES-GCM 256-bit CryptoKey from password and salt using PBKDF2 [Commented by: Google AI Studio on 01/11/2026 02:20 PM]
export async function deriveKeyFromPassword(password: string, saltBase64: string): Promise<CryptoKey> {
  if (!webCrypto || !webCrypto.subtle) throw new Error('Web Crypto Subtle API is not available');
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = base64ToBuffer(saltBase64);

  const baseKey = await webCrypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return webCrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer as unknown as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt plaintext string using derived CryptoKey [Commented by: Google AI Studio on 01/11/2026 02:20 PM]
export async function encryptData(data: string, key: CryptoKey, saltBase64: string): Promise<EncryptedPayload> {
  if (!webCrypto || !webCrypto.subtle) throw new Error('Web Crypto Subtle API is not available');
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(data);
  const iv = webCrypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await webCrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encodedData
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
    salt: saltBase64
  };
}

// Decrypt ciphertext using derived CryptoKey [Commented by: Google AI Studio on 01/11/2026 02:20 PM]
export async function decryptData(ciphertextBase64: string, ivBase64: string, key: CryptoKey): Promise<string> {
  if (!webCrypto || !webCrypto.subtle) throw new Error('Web Crypto Subtle API is not available');
  try {
    const ciphertext = base64ToBuffer(ciphertextBase64);
    const iv = base64ToBuffer(ivBase64);

    const decryptedBuffer = await webCrypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as ArrayBuffer
      },
      key,
      ciphertext as unknown as ArrayBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed. Invalid key or corrupted data.', error);
    throw new Error('Unable to decrypt data. Invalid password or corrupted ciphertext.');
  }
}

// Helper functions for zero-knowledge transparent string encryption and decryption [Commented by: Google AI Studio on 01/11/2026 04:18 PM]
export async function encryptText(text: string, key: CryptoKey, salt: string): Promise<string> {
  if (!text) return text;
  if (!key) {
    throw new Error('Encryption failed closed: Missing cryptographic key.');
  }
  try {
    const enc = await encryptData(text, key, salt);
    return `enc:${enc.iv}:${enc.ciphertext}`;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Encryption failed closed: ${message}`);
  }
}

export async function decryptText(encryptedText: string, key: CryptoKey): Promise<string> {
  if (!encryptedText || !encryptedText.startsWith('enc:')) return encryptedText;
  if (!key) {
    throw new Error('Decryption failed closed: Missing cryptographic key.');
  }
  const parts = encryptedText.split(':');
  if (parts.length < 3) {
    throw new Error('Decryption failed closed: Malformed encrypted token format.');
  }
  const iv = parts[1];
  const ciphertext = parts.slice(2).join(':');
  return await decryptData(ciphertext, iv, key);
}
