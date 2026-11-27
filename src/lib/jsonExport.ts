// Implemented client-side JSON chat backup export replacing legacy PDF export [Commented by: Google AI Studio at 22/11/2026 14:32]

export const NANOBOT_BACKUP_FILENAME = 'DO_NOT_EDIT_BACKUP_FOR_nanobot.json';

export type ExportMessageContent =
  | string
  | Array<{ type: string; text?: string; image_url?: { url: string } }>;

export interface ExportChatMessage {
  id?: string;
  role: 'user' | 'ai';
  content: ExportMessageContent;
  createdAt?: string;
  sources?: Array<{ title: string; url: string }>;
  reasoning?: string;
  displayAttachments?: Array<{
    type: string;
    name: string;
    fileId?: string;
    isLocalMissing?: boolean;
  }>;
  metadata?: Record<string, unknown>;
}

export interface ExportChatSession {
  id: string;
  title: string;
  messages: ExportChatMessage[];
  pinned?: boolean;
  updated?: number;
  shareId?: string;
}

export interface ExportFileOutput {
  id: string;
  source_file_id: string;
  file_name: string;
  file_type: string;
  output_type: string;
  output_content: string;
  created_at: string;
}

export interface NanobotChatBackup {
  format: 'nanobot-chat-backup';
  schemaVersion: 1;
  exportedAt: string;
  conversation: {
    id: string;
    title: string;
    pinned: boolean;
    updatedAt: string;
    updatedTimestamp: number;
    shareId: string | null;
    messageCount: number;
  };
  messages: Array<{
    index: number;
    id: string | null;
    role: 'user' | 'ai';
    content: ExportMessageContent;
    text: string;
    createdAt: string | null;
    reasoning: string | null;
    sources: Array<{ title: string; url: string }>;
    displayAttachments: Array<{
      type: string;
      name: string;
      fileId?: string;
      isLocalMissing?: boolean;
    }>;
    metadata: Record<string, unknown> | null;
  }>;
  fileOutputs: ExportFileOutput[];
}

function extractMessageText(content: ExportMessageContent): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
      .filter((t) => t.length > 0)
      .join('\n');
  }
  return '';
}

export function buildChatBackupPayload(
  chat: ExportChatSession,
  fileOutputs: ExportFileOutput[] = [],
  exportedAtIso?: string
): NanobotChatBackup {
  if (!chat || !chat.id) {
    throw new Error('Cannot export: missing conversation data.');
  }
  if (!Array.isArray(chat.messages) || chat.messages.length === 0) {
    throw new Error('Cannot export: conversation has no messages.');
  }

  const updatedMs = typeof chat.updated === 'number' && Number.isFinite(chat.updated) ? chat.updated : Date.now();

  return {
    format: 'nanobot-chat-backup',
    schemaVersion: 1,
    exportedAt: exportedAtIso || new Date().toISOString(),
    conversation: {
      id: chat.id,
      title: chat.title || 'Untitled Noodle',
      pinned: Boolean(chat.pinned),
      updatedAt: new Date(updatedMs).toISOString(),
      updatedTimestamp: updatedMs,
      shareId: chat.shareId || null,
      messageCount: chat.messages.length,
    },
    messages: chat.messages.map((msg, index) => ({
      index,
      id: msg.id || null,
      role: msg.role,
      content: msg.content,
      text: extractMessageText(msg.content),
      createdAt: msg.createdAt || null,
      reasoning: typeof msg.reasoning === 'string' && msg.reasoning.length > 0 ? msg.reasoning : null,
      sources: Array.isArray(msg.sources) ? msg.sources.map((s) => ({ title: s.title, url: s.url })) : [],
      displayAttachments: Array.isArray(msg.displayAttachments)
        ? msg.displayAttachments.map((att) => ({ ...att }))
        : [],
      metadata: msg.metadata && typeof msg.metadata === 'object' ? { ...msg.metadata } : null,
    })),
    fileOutputs: Array.isArray(fileOutputs)
      ? fileOutputs.map((out) => ({
          id: out.id,
          source_file_id: out.source_file_id,
          file_name: out.file_name,
          file_type: out.file_type,
          output_type: out.output_type,
          output_content: out.output_content,
          created_at: out.created_at,
        }))
      : [],
  };
}

export function serializeChatBackupJson(
  chat: ExportChatSession,
  fileOutputs: ExportFileOutput[] = [],
  exportedAtIso?: string
): string {
  const payload = buildChatBackupPayload(chat, fileOutputs, exportedAtIso);
  return JSON.stringify(payload, null, 2);
}

export function exportNoodleAsJson(
  chat: ExportChatSession,
  fileOutputs: ExportFileOutput[] = []
): void {
  const jsonText = serializeChatBackupJson(chat, fileOutputs);

  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    throw new Error('Browser file download APIs are unavailable in this environment.');
  }

  let objectUrl: string | null = null;
  let anchor: HTMLAnchorElement | null = null;

  try {
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    objectUrl = URL.createObjectURL(blob);
    anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = NANOBOT_BACKUP_FILENAME;
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    if (anchor && anchor.parentNode) {
      anchor.parentNode.removeChild(anchor);
    }
    if (objectUrl) {
      const urlToRevoke = objectUrl;
      setTimeout(() => {
        try {
          URL.revokeObjectURL(urlToRevoke);
        } catch {}
      }, 1000);
    }
  }
}
