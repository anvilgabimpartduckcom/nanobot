// Cloudflare Worker REST API client for shared noodles, MCP add-ons, account deletion, admin actions, and preferences with Supabase Bearer authentication [Commented by: Google AI Studio on 28/11/2026 07:30]

import { supabase } from './supabase';

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

// Cloud-persisted AI-generated file outputs for cross-device chat context [Commented by: Google AI Studio on 15/10/2026 09:22 PM]
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

// Model Context Protocol (MCP) tool and connection models [Commented by: Google AI Studio on 31/10/2026 10:31 PM]
export interface McpTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpConnection {
  providerId: string;
  authType: string;
  endpointUrl: string;
  tools: McpTool[];
  status: 'connected' | 'error' | 'disconnected';
  errorMessage?: string | null;
  updatedAt: string;
}

export interface McpToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

// Minimal privacy-preserving user record returned exclusively to verified administrators [Commented by: Google AI Studio at 27/11/2026 21:10]
export type AdminUserStatus = 'active' | 'disabled' | 'deleted' | 'pending' | 'unknown';

export interface AdminUserRecord {
  id: string;
  username: string;
  created_at: string | null;
  status: AdminUserStatus;
  isCurrentAdmin?: boolean;
}

export interface AdminDeleteResult {
  deletedUserId: string;
  deletedUsername?: string | null;
  stages?: {
    d1_purged: boolean;
    supabase_data_purged: boolean;
    auth_identity_deleted: boolean;
  };
  message: string;
}

// Cloud-synced user appearance and Fish Audio voice preferences [Commented by: Google AI Studio on 28/11/2026 06:47]
export interface WorkerUserPreferences {
  theme: 'Neon Black' | 'Minimalist Light';
  accent_family: string;
  accent_color: string;
  voice_id: string;
  updated_at?: string;
}


// Safely resolve Worker base URL across both Vite browser runtime and Node tsx verification scripts [Commented by: Google AI Studio on 28/11/2026 07:36]
const workerMetaEnv =
  typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, unknown> }).env
    ? (import.meta as unknown as { env: Record<string, unknown> }).env
    : {};

export const WORKER_BASE_URL = (
  (workerMetaEnv.VITE_CLOUDFLARE_WORKER_URL as string) ||
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
      let parsedError = errText;
      if (errText) {
        try {
          const parsed = JSON.parse(errText) as { error?: unknown };
          if (typeof parsed?.error === 'string' && parsed.error.trim()) {
            parsedError = parsed.error.trim();
          }
        } catch {}
      }
      return {
        success: false,
        error: `Authentication failed (${response.status}): ${parsedError}`,
        isAuthError: true,
      };
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Worker error');
      let parsedError = errText;
      if (errText) {
        try {
          const parsed = JSON.parse(errText) as { error?: unknown };
          if (typeof parsed?.error === 'string' && parsed.error.trim()) {
            parsedError = parsed.error.trim();
          }
        } catch {}
      }
      return {
        success: false,
        error: `Cloudflare Worker error (${response.status}): ${parsedError}`,
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

  // Removed regular-chat D1 conversation, message, and file-output endpoints under H-5 Decision 2; regular chats remain strictly browser-local [Commented by: Google AI Studio on 28/11/2026 07:30]

  // Create or update a public 30-day shareable snapshot in Cloudflare D1 (separate from encrypted local history) [Commented by: Google AI Studio at 24/11/2026 17:13]
  async createShare(
    title: string,
    messages: WorkerMessage[],
    shareId?: string
  ): Promise<WorkerApiResponse<{ shareId: string; title: string; updated?: boolean; created_at?: string; expires_at: string }>> {
    return workerFetch<{ shareId: string; title: string; updated?: boolean; created_at?: string; expires_at: string }>('/api/shares', {
      method: 'POST',
      body: JSON.stringify({ title, messages, shareId }),
    });
  },

  // Immediately revoke an owner's public share link in Cloudflare D1 [Commented by: Google AI Studio at 24/11/2026 22:57]
  async revokeShare(
    shareId: string
  ): Promise<WorkerApiResponse<{ shareId: string; revoked: boolean; message: string }>> {
    const trimmedId = (shareId || '').trim();
    if (!trimmedId) {
      return { success: false, error: 'Invalid share identifier provided.' };
    }
    return workerFetch<{ shareId: string; revoked: boolean; message: string }>(
      `/api/shares/${encodeURIComponent(trimmedId)}`,
      { method: 'DELETE' }
    );
  },

  // Retrieve a public shared chat snapshot without authentication, parsing Worker JSON errors cleanly [Commented by: Google AI Studio at 24/11/2026 17:13]
  async getPublicShare(
    shareId: string
  ): Promise<{ success: boolean; share?: { id: string; title: string; messages: WorkerMessage[]; created_at: string; expires_at: string }; error?: string }> {
    const trimmedId = (shareId || '').trim();
    if (!trimmedId) {
      return { success: false, error: 'Invalid share identifier provided.' };
    }

    try {
      const endpoint = `${WORKER_BASE_URL}/api/public/shares/${encodeURIComponent(trimmedId)}`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        let parsedError = errText;
        if (errText) {
          try {
            const parsed = JSON.parse(errText) as { error?: unknown };
            if (typeof parsed?.error === 'string' && parsed.error.trim()) {
              parsedError = parsed.error.trim();
            }
          } catch {}
        }
        return { success: false, error: parsedError || `Failed to load shared noodle (${res.status})` };
      }
      const data = await res.json();
      return data;
    } catch (e: unknown) {
      const err = e as Error;
      return { success: false, error: err.message || 'Network error loading shared noodle.' };
    }
  },

  // Retrieve all connected MCP providers and their dynamically discovered tools [Commented by: Google AI Studio on 31/10/2026 10:31 PM]
  async getMcpTools(): Promise<WorkerApiResponse<{ connections: McpConnection[] }>> {
    return workerFetch<{ connections: McpConnection[] }>('/api/mcp/tools', {
      method: 'GET',
    });
  },

  // Initiate backend-managed MCP 2026-07-28 OAuth 2.1 + PKCE plugin authorization [Commented by: Google AI Studio at 22/11/2026 11:51]
  async startMcpOAuth(
    providerId: string,
    returnOrigin: string
  ): Promise<WorkerApiResponse<{
    success?: boolean;
    providerId?: string;
    authorizationUrl?: string;
    state?: string;
    fallbackRequired?: boolean;
    error?: string;
  }>> {
    return workerFetch('/api/mcp/oauth/start', {
      method: 'POST',
      body: JSON.stringify({ providerId, returnOrigin }),
    });
  },

  // Authorize and verify an MCP provider with dynamic tool discovery and backend credential encryption [Commented by: Google AI Studio on 31/10/2026 10:31 PM]
  async connectMcpProvider(
    providerId: string,
    credentials: Record<string, string>,
    authType: string = 'api_key',
    endpointUrl?: string
  ): Promise<WorkerApiResponse<{ providerId: string; status: string; endpointUrl: string; tools: McpTool[]; updatedAt: string }>> {
    return workerFetch<{ providerId: string; status: string; endpointUrl: string; tools: McpTool[]; updatedAt: string }>('/api/mcp/connect', {
      method: 'POST',
      body: JSON.stringify({ providerId, credentials, authType, endpointUrl }),
    });
  },

  // Perform genuine live backend connection and discovery verification for an MCP provider [Commented by: Google AI Studio on 31/10/2026 11:05 PM]
  async testMcpConnection(
    providerId: string
  ): Promise<WorkerApiResponse<{
    providerId: string;
    status: 'Connection successful' | 'Authentication failed' | 'Tool discovery failed' | 'Provider unavailable' | 'Configuration required';
    toolsCount?: number;
    tools?: McpTool[];
    error?: string;
  }>> {
    return workerFetch<{
      providerId: string;
      status: 'Connection successful' | 'Authentication failed' | 'Tool discovery failed' | 'Provider unavailable' | 'Configuration required';
      toolsCount?: number;
      tools?: McpTool[];
      error?: string;
    }>('/api/mcp/test', {
      method: 'POST',
      body: JSON.stringify({ providerId }),
    });
  },

  // Execute an authentic tool call on a connected MCP server via the Cloudflare Worker backend [Commented by: Google AI Studio on 31/10/2026 10:31 PM]
  async callMcpTool(
    providerId: string,
    toolName: string,
    toolArguments: Record<string, unknown>
  ): Promise<WorkerApiResponse<{ result: McpToolCallResult }>> {
    return workerFetch<{ result: McpToolCallResult }>('/api/mcp/call', {
      method: 'POST',
      body: JSON.stringify({
        providerId,
        toolName,
        arguments: toolArguments,
      }),
    });
  },

  // Disconnect a provider and securely purge credentials and discovered tools [Commented by: Google AI Studio on 31/10/2026 10:31 PM]
  async disconnectMcpProvider(providerId: string): Promise<WorkerApiResponse<{ message: string }>> {
    return workerFetch<{ message: string }>('/api/mcp/disconnect', {
      method: 'POST',
      body: JSON.stringify({ providerId }),
    });
  },

  // Verify administrator status strictly on the Cloudflare Worker using the active Supabase JWT [Commented by: Google AI Studio at 27/11/2026 21:10]
  async checkAdminStatus(): Promise<WorkerApiResponse<{ isAdmin: boolean }>> {
    return workerFetch<{ isAdmin: boolean }>('/api/admin/status', {
      method: 'GET',
    });
  },

  // Fetch registered users with minimal non-sensitive fields for verified administrators only [Commented by: Google AI Studio at 27/11/2026 21:10]
  async listAdminUsers(
    search?: string
  ): Promise<WorkerApiResponse<{ users: AdminUserRecord[]; total: number }>> {
    const trimmed = (search || '').trim();
    const querySuffix = trimmed ? `?q=${encodeURIComponent(trimmed)}` : '';
    return workerFetch<{ users: AdminUserRecord[]; total: number }>(`/api/admin/users${querySuffix}`, {
      method: 'GET',
    });
  },

  // Permanently delete a target user's Supabase Auth identity and associated data via protected admin endpoint [Commented by: Google AI Studio at 27/11/2026 21:10]
  async deleteAdminUser(userId: string): Promise<WorkerApiResponse<AdminDeleteResult>> {
    const trimmed = (userId || '').trim();
    if (!trimmed) {
      return { success: false, error: 'Valid target user ID is required.' };
    }
    return workerFetch<AdminDeleteResult>(`/api/admin/users/${encodeURIComponent(trimmed)}`, {
      method: 'DELETE',
    });
  },

  // Fetch cloud-synced theme, accent color, and voice preferences [Commented by: Google AI Studio on 28/11/2026 06:47]
  async getPreferences(): Promise<WorkerApiResponse<{ preferences: WorkerUserPreferences | null }>> {
    return workerFetch<{ preferences: WorkerUserPreferences | null }>('/api/preferences', {
      method: 'GET',
    });
  },

  // Persist user theme, accent color, and voice selection to Cloudflare D1 [Commented by: Google AI Studio on 28/11/2026 06:47]
  async updatePreferences(
    updates: Partial<Pick<WorkerUserPreferences, 'theme' | 'accent_family' | 'accent_color' | 'voice_id'>>
  ): Promise<WorkerApiResponse<{ preferences: WorkerUserPreferences }>> {
    return workerFetch<{ preferences: WorkerUserPreferences }>('/api/preferences', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
};


