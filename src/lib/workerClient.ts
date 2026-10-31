// Cloudflare Worker REST API client for nanobot chat persistence with Supabase Bearer authentication [Commented by: Google AI Studio on 30/10/2026 10:48 AM]

import { supabase } from './supabase';

export interface WorkerConversation {
  id: string;
  title: string;
  pinned: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WorkerMessage {
  id?: string;
  role: 'user' | 'ai';
  content: string;
  sources?: Array<{ title: string; url: string }>;
  reasoning?: string;
  displayAttachments?: Array<{ type: string; name: string; fileId?: string; isLocalMissing?: boolean }>;
  created_at?: string;
}

export interface WorkerApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  isAuthError?: boolean;
  isNetworkError?: boolean;
}

// Cloud-persisted AI-generated file outputs for cross-device chat context [Commented by: Google AI Studio on 15/10/2026 09:22 AM]
export interface WorkerFileOutput {
  id?: string;
  conversation_id?: string;
  source_file_id: string;
  file_name: string;
  file_type: string;
  output_type: string; // 'text_extraction' | 'reader_script' | 'structured_summary'
  output_content: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

// Configured Cloudflare Worker base URL with fallback to production deployment [Commented by: Google AI Studio on 14/10/2026 10:55 AM]
const WORKER_BASE_URL = (
  (import.meta.env.VITE_CLOUDFLARE_WORKER_URL as string) ||
  'https://nanobot-api.mud-amiable-tweed.workers.dev'
).replace(/\/$/, '');

// Retrieve active Supabase session access token for Bearer authentication
async function getSupabaseAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;
    return session.access_token || null;
  } catch (err) {
    console.warn('Failed to retrieve Supabase session access token:', err);
    return null;
  }
}

// Universal fetch wrapper handling Bearer token injection, CORS, and network error classification
async function workerFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<WorkerApiResponse<T>> {
  try {
    const token = await getSupabaseAccessToken();
    if (!token) {
      return {
        success: false,
        error: 'No active Supabase authentication session found. Please sign in.',
        isAuthError: true,
      };
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }

    const endpoint = `${WORKER_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      const errText = await response.text().catch(() => 'Unauthorized');
      return {
        success: false,
        error: `Authentication failed (${response.status}): ${errText}`,
        isAuthError: true,
      };
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Worker error');
      return {
        success: false,
        error: `Cloudflare Worker error (${response.status}): ${errText}`,
      };
    }

    const result = await response.json().catch(() => null);
    return {
      success: true,
      data: result as T,
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.warn('Cloudflare Worker network request notice:', error);
    return {
      success: false,
      error: `Network connection to Cloudflare Worker failed: ${error.message}`,
      isNetworkError: true,
    };
  }
}

// API methods
export const workerClient = {
  // Check health and reachability of the Cloudflare Worker endpoint
  async checkHealth(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch(`${WORKER_BASE_URL}/health`);
      if (res.ok) {
        return { ok: true, message: 'Cloudflare Worker is online and reachable' };
      }
      return { ok: false, message: `Worker responded with HTTP ${res.status}` };
    } catch (e: unknown) {
      const err = e as Error;
      return { ok: false, message: `Worker offline or unreachable: ${err.message}` };
    }
  },

  // List all conversations for the authenticated user
  async listConversations(): Promise<WorkerApiResponse<{ conversations: WorkerConversation[] }>> {
    return workerFetch<{ conversations: WorkerConversation[] }>('/api/conversations', {
      method: 'GET',
    });
  },

  // Create or upsert a conversation record
  async createOrUpdateConversation(
    conversation: WorkerConversation
  ): Promise<WorkerApiResponse<{ conversation: WorkerConversation }>> {
    return workerFetch<{ conversation: WorkerConversation }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify(conversation),
    });
  },

  // Update conversation title or pin state
  async updateConversation(
    id: string,
    updates: { title?: string; pinned?: boolean }
  ): Promise<WorkerApiResponse<{ updated_at: string }>> {
    return workerFetch<{ updated_at: string }>(`/api/conversations/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Delete a specific conversation and all associated messages
  async deleteConversation(id: string): Promise<WorkerApiResponse<{ message: string }>> {
    return workerFetch<{ message: string }>(`/api/conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Clear all conversations and messages for the user
  async clearAllConversations(): Promise<WorkerApiResponse<{ message: string }>> {
    return workerFetch<{ message: string }>('/api/conversations', {
      method: 'DELETE',
    });
  },

  // Get messages for a specific conversation
  async getMessages(
    conversationId: string
  ): Promise<WorkerApiResponse<{ messages: WorkerMessage[] }>> {
    return workerFetch<{ messages: WorkerMessage[] }>(
      `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
      { method: 'GET' }
    );
  },

  // Save a single message to a conversation
  async saveMessage(
    conversationId: string,
    message: WorkerMessage,
    conversationTitle?: string
  ): Promise<WorkerApiResponse<{ message: WorkerMessage }>> {
    return workerFetch<{ message: WorkerMessage }>(
      `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...message,
          title: conversationTitle,
        }),
      }
    );
  },

  // Save multiple messages in batch to a conversation
  async saveMessagesBatch(
    conversationId: string,
    messages: WorkerMessage[],
    conversationTitle?: string
  ): Promise<WorkerApiResponse<{ count: number }>> {
    return workerFetch<{ count: number }>(
      `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          messages,
          title: conversationTitle,
        }),
      }
    );
  },

  // Retrieve persisted AI-extracted outputs for a conversation [Commented by: Google AI Studio on 15/10/2026 09:22 AM]
  async getFileOutputs(
    conversationId: string
  ): Promise<WorkerApiResponse<{ outputs: WorkerFileOutput[] }>> {
    return workerFetch<{ outputs: WorkerFileOutput[] }>(
      `/api/conversations/${encodeURIComponent(conversationId)}/outputs`,
      { method: 'GET' }
    );
  },

  // Persist an AI-generated file extraction or reader script result to Cloudflare D1 [Commented by: Google AI Studio on 15/10/2026 09:22 AM]
  async saveFileOutput(
    conversationId: string,
    output: WorkerFileOutput
  ): Promise<WorkerApiResponse<{ output: WorkerFileOutput }>> {
    return workerFetch<{ output: WorkerFileOutput }>(
      `/api/conversations/${encodeURIComponent(conversationId)}/outputs`,
      {
        method: 'POST',
        body: JSON.stringify(output),
      }
    );
  },

  // Delete a persisted AI output for a file from Cloudflare D1 [Commented by: Google AI Studio on 15/10/2026 09:22 AM]
  async deleteFileOutput(
    conversationId: string,
    fileId: string
  ): Promise<WorkerApiResponse<{ message: string }>> {
    return workerFetch<{ message: string }>(
      `/api/conversations/${encodeURIComponent(conversationId)}/outputs/${encodeURIComponent(fileId)}`,
      { method: 'DELETE' }
    );
  },

  // Create or update a public shareable snapshot for a chat session with 30-day retention [Commented by: Google AI Studio on 28/10/2026 11:36 AM]
  async createShare(
    title: string,
    messages: WorkerMessage[],
    shareId?: string
  ): Promise<WorkerApiResponse<{ shareId: string; title: string; expires_at: string }>> {
    return workerFetch<{ shareId: string; title: string; expires_at: string }>('/api/shares', {
      method: 'POST',
      body: JSON.stringify({ title, messages, shareId }),
    });
  },

  // Retrieve a public shared chat snapshot without authentication, protected with anti-scraping headers [Commented by: Google AI Studio on 22/10/2026 04:50 AM]
  async getPublicShare(
    shareId: string
  ): Promise<{ success: boolean; share?: { id: string; title: string; messages: WorkerMessage[]; created_at: string; expires_at: string }; error?: string }> {
    try {
      const endpoint = `${WORKER_BASE_URL}/api/public/shares/${encodeURIComponent(shareId)}`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return { success: false, error: errText || `Failed to load shared chat (${res.status})` };
      }
      const data = await res.json();
      return data;
    } catch (e: unknown) {
      const err = e as Error;
      return { success: false, error: err.message };
    }
  },
};
