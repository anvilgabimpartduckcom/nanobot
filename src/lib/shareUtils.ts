// Pure sharing helpers for snapshot sanitization, URL parsing, clipboard verification, and independent forking [Commented by: Google AI Studio at 24/11/2026 22:57]

export const SHARE_RETENTION_DAYS = 30;

// Updated privacy disclosure to reflect browser-local personal history vs Cloudflare shared snapshots [Commented by: Google AI Studio on 28/11/2026 07:30]
export const SHARED_NOODLE_PRIVACY_DISCLOSURE =
  'Anyone with this link can view this snapshot until it expires (30 days) or you revoke it. Only conversation messages, cited sources, and attachment names are stored in the Cloudflare sharing database (internal model reasoning, private metadata, credentials, and raw local files are excluded), separate from your browser-local personal history.';

export interface ShareableAttachment {
  type: string;
  name: string;
  fileId?: string;
  isLocalMissing?: boolean;
}

export interface ShareableSource {
  title: string;
  url: string;
}

export interface ShareableMessageInput {
  id?: string;
  role: 'user' | 'ai';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  sources?: ShareableSource[];
  reasoning?: string;
  displayAttachments?: ShareableAttachment[];
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface SharedSnapshotMessage {
  role: 'user' | 'ai';
  content: string;
  sources?: ShareableSource[];
  displayAttachments?: Array<{ type: string; name: string }>;
}

export interface ForkableChatSource {
  id: string;
  title: string;
  messages: ShareableMessageInput[];
}

export interface ForkedChatSession {
  id: string;
  title: string;
  messages: ShareableMessageInput[];
  pinned: boolean;
  updated: number;
}

export interface ClipboardAdapter {
  writeText?: (text: string) => Promise<void>;
}

export interface ClipboardCopyResult {
  copied: boolean;
  error?: string;
}

function sanitizeShareSourceUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

// Sanitize active noodle messages into a read-only JSON snapshot excluding internal reasoning, private metadata, credentials, and local file IDs/bytes [Commented by: Google AI Studio at 24/11/2026 22:57]
export function buildShareSnapshotMessages(messages: ShareableMessageInput[]): SharedSnapshotMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages.map((m) => {
    const content = Array.isArray(m.content)
      ? m.content
          .filter((c) => c && c.type === 'text' && typeof c.text === 'string')
          .map((c) => c.text || '')
          .join('\n') || '[Shared Content]'
      : typeof m.content === 'string'
        ? m.content
        : String(m.content ?? '');

    const cleanSources = Array.isArray(m.sources)
      ? m.sources
          .map((s) => {
            if (!s || typeof s !== 'object') return null;
            const safeHref = sanitizeShareSourceUrl(s.url);
            if (!safeHref) return null;
            return {
              title: String(s.title || ''),
              url: safeHref,
            };
          })
          .filter((s): s is ShareableSource => s !== null)
      : [];

    const cleanAttachments = Array.isArray(m.displayAttachments)
      ? m.displayAttachments
          .filter((a) => a && typeof a === 'object')
          .map((a) => ({
            type: String(a.type || 'file'),
            name: String(a.name || 'Attachment'),
          }))
      : [];

    const snapshotMsg: SharedSnapshotMessage = {
      role: m.role === 'user' ? 'user' : 'ai',
      content,
    };

    if (cleanSources.length > 0) {
      snapshotMsg.sources = cleanSources;
    }
    if (cleanAttachments.length > 0) {
      snapshotMsg.displayAttachments = cleanAttachments;
    }

    return snapshotMsg;
  });
}

// Parse share identifier from either a full shared URL or a raw share ID without throwing on malformed input
export function extractShareIdFromInput(input: string): { shareId: string | null; error?: string } {
  const raw = (input || '').trim();
  if (!raw) {
    return { shareId: null, error: 'Please paste a shared noodle link or share ID.' };
  }

  if (raw.includes('://') || raw.startsWith('/')) {
    try {
      const parsed = new URL(raw, 'https://nanobot.local');
      const queryShare = parsed.searchParams.get('share');
      if (queryShare !== null) {
        const trimmed = queryShare.trim();
        return trimmed
          ? { shareId: trimmed }
          : { shareId: null, error: 'The shared link is missing a valid share ID.' };
      }

      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const lastSegment = pathParts[pathParts.length - 1] || '';
      if (lastSegment && (pathParts.includes('shares') || pathParts.length === 1)) {
        return { shareId: decodeURIComponent(lastSegment).trim() };
      }
      return { shareId: null, error: 'Invalid shared noodle link format. Expected a ?share=... link.' };
    } catch {
      return { shareId: null, error: 'Invalid or malformed shared noodle URL.' };
    }
  }

  if (raw.includes('share=')) {
    const match = raw.match(/[?&]?share=([^&#]+)/);
    if (!match || !match[1]) {
      return { shareId: null, error: 'The shared link is missing a valid share ID.' };
    }
    try {
      const decoded = decodeURIComponent(match[1]).trim();
      return decoded ? { shareId: decoded } : { shareId: null, error: 'Invalid share ID.' };
    } catch {
      return { shareId: null, error: 'The shared link contains malformed encoding.' };
    }
  }

  return { shareId: raw };
}

// Attempt clipboard copy and report accurate boolean outcome instead of swallowing errors silently
export async function copyTextToClipboard(
  text: string,
  clipboardImpl?: ClipboardAdapter | null
): Promise<ClipboardCopyResult> {
  const targetClipboard =
    clipboardImpl !== undefined
      ? clipboardImpl
      : typeof navigator !== 'undefined'
        ? navigator.clipboard
        : null;

  if (!targetClipboard || typeof targetClipboard.writeText !== 'function') {
    return {
      copied: false,
      error: 'Automatic clipboard access is unavailable in this browser context.',
    };
  }

  try {
    await targetClipboard.writeText(text);
    return { copied: true };
  } catch (err: unknown) {
    return {
      copied: false,
      error: err instanceof Error ? err.message : 'Clipboard permission denied.',
    };
  }
}

// Fork a shared snapshot into an independent local chat session without retaining the original shareId or internal metadata [Commented by: Google AI Studio at 24/11/2026 22:57]
export function createForkedChatSession(
  sharedChat: ForkableChatSource,
  idGenerator: () => string = () => Date.now().toString()
): ForkedChatSession {
  const sanitizedMessages = buildShareSnapshotMessages(sharedChat.messages);
  const clonedMessages: ShareableMessageInput[] = JSON.parse(JSON.stringify(sanitizedMessages));

  return {
    id: idGenerator(),
    title: sharedChat.title || 'Imported Noodle',
    messages: clonedMessages,
    pinned: false,
    updated: Date.now(),
  };
}
