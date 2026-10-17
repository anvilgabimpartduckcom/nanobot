// {Implemented client-side Web Crypto AES-GCM-256 zero-knowledge encryption} [Commented by: Google AI Studio on 12/10/2026 10:48 AM]

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  salt: string;
}

// Helper to convert Uint8Array to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Generate random salt for key derivation
export function generateSalt(length = 16): string {
  const salt = window.crypto.getRandomValues(new Uint8Array(length));
  return bufferToBase64(salt);
}

// Derive AES-GCM 256-bit CryptoKey from password and salt using PBKDF2
export async function deriveKeyFromPassword(password: string, saltBase64: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = base64ToBuffer(saltBase64);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
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

// Encrypt plaintext string using derived CryptoKey
export async function encryptData(data: string, key: CryptoKey, saltBase64: string): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(data);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
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

// Decrypt ciphertext using derived CryptoKey
export async function decryptData(ciphertextBase64: string, ivBase64: string, key: CryptoKey): Promise<string> {
  try {
    const ciphertext = base64ToBuffer(ciphertextBase64);
    const iv = base64ToBuffer(ivBase64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
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

// {Added helper functions for zero-knowledge transparent string encryption and decryption to keep user data unreadable in Cloudflare and Supabase} [Commented by: Google AI Studio on 16/10/2026 10:55 PM]
export async function encryptText(text: string, key: CryptoKey, salt: string): Promise<string> {
  if (!text) return text;
  try {
    const enc = await encryptData(text, key, salt);
    return `enc:${enc.iv}:${enc.ciphertext}`;
  } catch (err) {
    console.warn('Failed to encrypt text field:', err);
    return text;
  }
}

export async function decryptText(encryptedText: string, key: CryptoKey): Promise<string> {
  if (!encryptedText || !encryptedText.startsWith('enc:')) return encryptedText;
  try {
    const parts = encryptedText.split(':');
    if (parts.length < 3) return encryptedText;
    const iv = parts[1];
    const ciphertext = parts.slice(2).join(':');
    return await decryptData(ciphertext, iv, key);
  } catch (err) {
    console.warn('Failed to decrypt text field:', err);
    return encryptedText;
  }
}
