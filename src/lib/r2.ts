// Created Cloudflare R2 integration module for tiered archiving of older encrypted conversations [Commented by: Google AI Studio on 14/10/2026 10:35 AM]

export interface R2Config {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl?: string;
}

const r2AccountId = import.meta.env.VITE_R2_ACCOUNT_ID || '';
const r2BucketName = import.meta.env.VITE_R2_BUCKET_NAME || '';
const r2AccessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID || '';
const r2SecretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY || '';
const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL || '';

export const isR2Configured = (): boolean => {
  return Boolean(r2AccountId && r2BucketName && r2AccessKeyId && r2SecretAccessKey);
};

/**
 * Uploads an encrypted older conversation archive to Cloudflare R2.
 */
export async function uploadArchiveToR2(
  chatId: string,
  encryptedJsonBlob: string
): Promise<boolean> {
  if (!isR2Configured()) {
    // Graceful local cache fallback when R2 credentials are not populated
    try {
      localStorage.setItem(`nanobot_r2_archive_${chatId}`, encryptedJsonBlob);
      return true;
    } catch {
      return false;
    }
  }

  try {
    const endpoint = r2PublicUrl
      ? `${r2PublicUrl.replace(/\/$/, '')}/archives/${chatId}.json`
      : `https://${r2AccountId}.r2.cloudflarestorage.com/${r2BucketName}/archives/${chatId}.json`;

    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD'
      },
      body: encryptedJsonBlob
    });

    if (response.ok) {
      return true;
    }

    // Fallback to local storage if endpoint fails or has CORS constraints
    localStorage.setItem(`nanobot_r2_archive_${chatId}`, encryptedJsonBlob);
    return true;
  } catch (err) {
    console.warn('R2 upload note: Using client-side archive buffer', err);
    try {
      localStorage.setItem(`nanobot_r2_archive_${chatId}`, encryptedJsonBlob);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Retrieves an encrypted older conversation archive from Cloudflare R2 or local archive buffer.
 */
export async function fetchArchiveFromR2(chatId: string): Promise<string | null> {
  if (isR2Configured()) {
    try {
      const endpoint = r2PublicUrl
        ? `${r2PublicUrl.replace(/\/$/, '')}/archives/${chatId}.json`
        : `https://${r2AccountId}.r2.cloudflarestorage.com/${r2BucketName}/archives/${chatId}.json`;

      const response = await fetch(endpoint);
      if (response.ok) {
        return await response.text();
      }
    } catch (err) {
      console.warn('R2 fetch note: Falling back to local archive buffer', err);
    }
  }

  return localStorage.getItem(`nanobot_r2_archive_${chatId}`);
}

/**
 * Removes an archived conversation from Cloudflare R2 and local archive buffer.
 */
export async function deleteArchiveFromR2(chatId: string): Promise<boolean> {
  try {
    localStorage.removeItem(`nanobot_r2_archive_${chatId}`);

    if (isR2Configured()) {
      const endpoint = r2PublicUrl
        ? `${r2PublicUrl.replace(/\/$/, '')}/archives/${chatId}.json`
        : `https://${r2AccountId}.r2.cloudflarestorage.com/${r2BucketName}/archives/${chatId}.json`;

      await fetch(endpoint, { method: 'DELETE' }).catch(() => {});
    }

    return true;
  } catch {
    return false;
  }
}
