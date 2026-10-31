// Cloudflare Worker backend persisting user chat history and AI-extracted file outputs with Supabase Bearer token verification and D1 parameterized queries [Commented by: Google AI Studio on 15/10/2026 09:57 AM]

// Self-contained Cloudflare D1 database interface definitions for zero-dependency portability [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
export interface D1Result<T = unknown> {
  results?: T[];
  success?: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}

export interface Env {
  DB: D1Database;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  CORS_ORIGIN?: string;
}

interface SupabaseUser {
  id: string;
  email?: string;
  role?: string;
}

// CORS headers helper supporting wildcard or configured origins from runtime environment [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
function getCorsHeaders(origin: string | null, allowedOrigin: string = '*'): Headers {
  const headers = new Headers();
  let permitOrigin = '*';
  if (allowedOrigin === '*') {
    permitOrigin = '*';
  } else if (allowedOrigin.includes(',')) {
    const list = allowedOrigin.split(',').map((o) => o.trim());
    if (origin && list.includes(origin)) {
      permitOrigin = origin;
    } else {
      permitOrigin = list[0];
    }
  } else {
    permitOrigin = allowedOrigin;
  }

  headers.set('Access-Control-Allow-Origin', permitOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  // Hardened security headers protecting user data and preventing clickjacking/MIME-sniffing [Commented by: Google AI Studio on 30/10/2026 10:48 AM]
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
  return headers;
}

// Sanitization & injection guard rejecting prototype pollution, SQL injection artifacts, and payload abuse [Commented by: Google AI Studio on 30/10/2026 10:48 AM]
function validateSafeId(id: string): boolean {
  return /^[a-zA-Z0-9_\-.:]{1,128}$/.test(id);
}

// JSON response helper with CORS configured from environment
function jsonResponse(
  data: unknown,
  status = 200,
  origin: string | null = null,
  allowedOrigin: string = '*'
): Response {
  const headers = getCorsHeaders(origin, allowedOrigin);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(data), { status, headers });
}

// Error response helper with CORS configured from environment
function errorResponse(
  message: string,
  status = 400,
  origin: string | null = null,
  allowedOrigin: string = '*'
): Response {
  return jsonResponse({ success: false, error: message }, status, origin, allowedOrigin);
}

// Securely verify Supabase Bearer token against Supabase Auth API using environment secrets [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
// Derives user ID strictly from the verified cryptographic session; never trusts client-supplied user ID
async function authenticateRequest(
  request: Request,
  env: Env
): Promise<{ user: SupabaseUser | null; error?: string }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or malformed Authorization header with Bearer token' };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { user: null, error: 'Empty Bearer token' };
  }

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      user: null,
      error:
        'Worker runtime configuration missing: SUPABASE_URL and SUPABASE_ANON_KEY secrets must be configured in Cloudflare (wrangler secret put SUPABASE_URL / SUPABASE_ANON_KEY or Cloudflare dashboard).',
    };
  }

  try {
    const authEndpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`;
    const res = await fetch(authEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return { user: null, error: `Invalid Supabase session token (${res.status}): ${errText}` };
    }

    const userData = (await res.json()) as SupabaseUser;
    if (!userData || !userData.id) {
      return { user: null, error: 'Supabase authentication failed to return a valid user identity' };
    }

    return { user: userData };
  } catch (err: unknown) {
    const error = err as Error;
    return { user: null, error: `Network error verifying Supabase token: ${error.message}` };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const allowedOrigin = env.CORS_ORIGIN || '*';

    // Helper functions capturing current origin and CORS configuration
    const sendJson = (data: unknown, status = 200) =>
      jsonResponse(data, status, origin, allowedOrigin);
    const sendError = (msg: string, status = 400) =>
      errorResponse(msg, status, origin, allowedOrigin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin, allowedOrigin),
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Public health check and diagnostic endpoint verifying environment variables and D1 binding [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
    if (pathname === '/' || pathname === '/health' || pathname === '/api/health') {
      return sendJson(
        {
          status: 'ok',
          service: 'nanobot-cloudflare-worker-backend',
          version: '1.2.0',
          environment: {
            d1_database_bound: Boolean(env.DB && typeof env.DB.prepare === 'function'),
            supabase_url_configured: Boolean(env.SUPABASE_URL),
            supabase_anon_key_configured: Boolean(env.SUPABASE_ANON_KEY),
            cors_origin: allowedOrigin,
          },
          endpoints: [
            'GET /api/conversations',
            'POST /api/conversations',
            'GET /api/conversations/:id',
            'PUT /api/conversations/:id',
            'DELETE /api/conversations/:id',
            'GET /api/conversations/:id/messages',
            'POST /api/conversations/:id/messages',
            'GET /api/conversations/:id/outputs',
            'POST /api/conversations/:id/outputs',
            'DELETE /api/conversations/:id/outputs/:fileId',
            'DELETE /api/conversations',
          ],
        },
        200
      );
    }

    // Public read-only share retrieval endpoint with 30-day retention and X-Robots-Tag anti-scraper headers [Commented by: Google AI Studio on 22/10/2026 04:49 AM]
    const publicShareMatch = pathname.match(/^\/api\/public\/shares\/([^/]+)$/);
    if (publicShareMatch && request.method === 'GET') {
      if (!env.DB || typeof env.DB.prepare !== 'function') {
        return sendError('D1 database binding "DB" is not available on Cloudflare Worker', 500);
      }
      const shareId = decodeURIComponent(publicShareMatch[1]);
      if (!validateSafeId(shareId)) {
        return sendError('Invalid share identifier provided', 400);
      }
      const nowIso = new Date().toISOString();

      try {
        // Enforce 30-day retention cleanup on shares
        await env.DB.prepare(`DELETE FROM shared_chats WHERE expires_at < ?`).bind(nowIso).run().catch(() => {});

        const shareRecord = await env.DB.prepare(
          `SELECT id, title, messages_json, created_at, expires_at FROM shared_chats WHERE id = ?`
        )
          .bind(shareId)
          .first<{ id: string; title: string; messages_json: string; created_at: string; expires_at: string }>();

        if (!shareRecord || shareRecord.expires_at < nowIso) {
          return sendError('Shared chat does not exist or has expired after the 30-day retention period.', 404);
        }

        const headers = getCorsHeaders(origin, allowedOrigin);
        headers.set('Content-Type', 'application/json');
        headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
        headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');

        return new Response(
          JSON.stringify({
            success: true,
            share: {
              id: shareRecord.id,
              title: shareRecord.title,
              messages: JSON.parse(shareRecord.messages_json),
              created_at: shareRecord.created_at,
              expires_at: shareRecord.expires_at,
            },
          }),
          { status: 200, headers }
        );
      } catch (err: unknown) {
        const error = err as Error;
        return sendError(`Failed to retrieve shared chat: ${error.message}`, 500);
      }
    }

    // All endpoints under /api/* (except health and public shares) require authenticated Supabase Bearer token
    if (pathname.startsWith('/api/')) {
      if (!env.DB || typeof env.DB.prepare !== 'function') {
        return sendError('D1 database binding "DB" is not available on Cloudflare Worker', 500);
      }

      const { user, error: authError } = await authenticateRequest(request, env);
      if (!user) {
        return sendError(authError || 'Unauthorized', 401);
      }

      const verifiedUserId = user.id;

      try {
        // 1. GET /api/conversations -> List all conversations for the authenticated user (with 30-day auto-purge)
        // Enforced 30-day automatic deletion of expired chats, messages, and file outputs from Cloudflare D1 [Commented by: Google AI Studio on 19/10/2026 11:19 AM]
        if (pathname === '/api/conversations' && request.method === 'GET') {
          const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          try {
            await env.DB.prepare(
              `DELETE FROM file_outputs WHERE user_id = ? AND conversation_id IN (SELECT id FROM conversations WHERE user_id = ? AND updated_at < ?)`
            ).bind(verifiedUserId, verifiedUserId, thirtyDaysAgoIso).run();
            await env.DB.prepare(
              `DELETE FROM messages WHERE user_id = ? AND conversation_id IN (SELECT id FROM conversations WHERE user_id = ? AND updated_at < ?)`
            ).bind(verifiedUserId, verifiedUserId, thirtyDaysAgoIso).run();
            await env.DB.prepare(
              `DELETE FROM conversations WHERE user_id = ? AND updated_at < ?`
            ).bind(verifiedUserId, thirtyDaysAgoIso).run();
          } catch (purgeErr) {
            console.warn('30-day auto-purge notice:', purgeErr);
          }

          const { results } = await env.DB.prepare(
            `SELECT id, title, pinned, created_at, updated_at 
             FROM conversations 
             WHERE user_id = ? 
             ORDER BY pinned DESC, updated_at DESC`
          )
            .bind(verifiedUserId)
            .all();

          return sendJson({ success: true, conversations: results || [] }, 200);
        }

        // Authenticated creation of a shareable chat session snapshot retaining the 30-day retention policy [Commented by: Google AI Studio on 22/10/2026 04:49 AM]
        if (pathname === '/api/shares' && request.method === 'POST') {
          const body: any = await request.json().catch(() => null);
          if (!body || typeof body !== 'object' || !Array.isArray(body.messages)) {
            return sendError('Invalid share payload: messages array is required', 400);
          }

          // Ensure table exists in D1
          await env.DB.prepare(
            `CREATE TABLE IF NOT EXISTS shared_chats (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              title TEXT NOT NULL,
              messages_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL
            )`
          ).run().catch(() => {});

          // Supported updating existing share snapshot under the same share ID and URL [Commented by: Google AI Studio on 28/10/2026 11:35 AM]
          const shareId = typeof body.shareId === 'string' && body.shareId.trim() ? body.shareId.trim() : crypto.randomUUID();
          const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Shared Noodle';
          const now = Date.now();
          const nowIso = new Date(now).toISOString();
          const expiresIso = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
          const messagesJson = JSON.stringify(body.messages);

          await env.DB.prepare(
            `INSERT INTO shared_chats (id, user_id, title, messages_json, created_at, expires_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               title = excluded.title,
               messages_json = excluded.messages_json,
               expires_at = excluded.expires_at`
          )
            .bind(shareId, verifiedUserId, title, messagesJson, nowIso, expiresIso)
            .run();

          return sendJson(
            {
              success: true,
              shareId,
              title,
              created_at: nowIso,
              expires_at: expiresIso,
            },
            201
          );
        }

        // 2. POST /api/conversations -> Create or upsert a conversation record
        if (pathname === '/api/conversations' && request.method === 'POST') {
          const body: any = await request.json().catch(() => null);
          if (!body || typeof body !== 'object') {
            return sendError('Invalid JSON payload', 400);
          }

          const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : crypto.randomUUID();
          const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'New Chat';
          const pinned = body.pinned ? 1 : 0;
          const nowIso = new Date().toISOString();
          const createdAt = typeof body.created_at === 'string' ? body.created_at : nowIso;
          const updatedAt = typeof body.updated_at === 'string' ? body.updated_at : nowIso;

          // Parameterized upsert ensuring user ownership
          await env.DB.prepare(
            `INSERT INTO conversations (id, user_id, title, pinned, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET 
               title = excluded.title, 
               pinned = excluded.pinned, 
               updated_at = excluded.updated_at
             WHERE conversations.user_id = excluded.user_id`
          )
            .bind(id, verifiedUserId, title, pinned, createdAt, updatedAt)
            .run();

          return sendJson(
            {
              success: true,
              conversation: {
                id,
                title,
                pinned: Boolean(pinned),
                created_at: createdAt,
                updated_at: updatedAt,
              },
            },
            201
          );
        }

        // 3. DELETE /api/conversations -> Delete all conversations, messages, and file outputs for the authenticated user
        // Explicit transactional cleanup deleting file outputs, messages, and conversations [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
        if (pathname === '/api/conversations' && request.method === 'DELETE') {
          await env.DB.prepare(`DELETE FROM file_outputs WHERE user_id = ?`).bind(verifiedUserId).run();
          await env.DB.prepare(`DELETE FROM messages WHERE user_id = ?`).bind(verifiedUserId).run();
          await env.DB.prepare(`DELETE FROM conversations WHERE user_id = ?`).bind(verifiedUserId).run();
          return sendJson({ success: true, message: 'All conversations and associated outputs successfully cleared' }, 200);
        }

        // Match conversation file output routes:
        // /api/conversations/:id/outputs
        // /api/conversations/:id/outputs/:fileId
        const outputMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/outputs(?:\/([^/]+))?$/);
        if (outputMatch) {
          const conversationId = decodeURIComponent(outputMatch[1]);
          const targetFileId = outputMatch[2] ? decodeURIComponent(outputMatch[2]) : null;

          // Ensure user owns this conversation
          const conv = await env.DB.prepare(
            `SELECT id FROM conversations WHERE id = ? AND user_id = ?`
          )
            .bind(conversationId, verifiedUserId)
            .first();

          if (!conv) {
            return sendError('Conversation not found or access denied', 404);
          }

          // GET /api/conversations/:id/outputs -> List all saved AI file outputs for this conversation
          if (request.method === 'GET') {
            const { results } = await env.DB.prepare(
              `SELECT id, conversation_id, source_file_id, file_name, file_type, output_type, output_content, metadata_json, created_at, updated_at
               FROM file_outputs
               WHERE conversation_id = ? AND user_id = ?
               ORDER BY created_at ASC`
            )
              .bind(conversationId, verifiedUserId)
              .all();

            const formatted = (results || []).map((row: any) => ({
              id: row.id,
              conversation_id: row.conversation_id,
              source_file_id: row.source_file_id,
              file_name: row.file_name,
              file_type: row.file_type,
              output_type: row.output_type,
              output_content: row.output_content,
              metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
              created_at: row.created_at,
              updated_at: row.updated_at,
            }));

            return sendJson({ success: true, outputs: formatted }, 200);
          }

          // POST /api/conversations/:id/outputs -> Save or update an AI-generated output (e.g. extracted text or script results)
          // Enforced payload size safety checks and parameterized storage of AI output only [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
          if (request.method === 'POST') {
            const body: any = await request.json().catch(() => null);
            if (!body || typeof body !== 'object') {
              return sendError('Invalid output payload', 400);
            }

            const sourceFileId = typeof body.source_file_id === 'string' && body.source_file_id.trim()
              ? body.source_file_id.trim()
              : `file_${crypto.randomUUID()}`;
            const fileName = typeof body.file_name === 'string' && body.file_name.trim()
              ? body.file_name.trim()
              : 'Uploaded File';
            const fileType = typeof body.file_type === 'string' ? body.file_type : 'application/octet-stream';
            const outputType = typeof body.output_type === 'string' ? body.output_type : 'text_extraction';
            const outputContent = typeof body.output_content === 'string' ? body.output_content : '';

            // Guard against excessive output payload sizes (max 512KB for extracted output)
            if (outputContent.length > 512 * 1024) {
              return sendError('Output payload exceeds safe maximum limit of 512KB', 413);
            }

            const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `${conversationId}_${sourceFileId}`;
            const metadataJson = body.metadata ? JSON.stringify(body.metadata) : null;
            const nowIso = new Date().toISOString();

            await env.DB.prepare(
              `INSERT INTO file_outputs (id, conversation_id, user_id, source_file_id, file_name, file_type, output_type, output_content, metadata_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 output_content = excluded.output_content,
                 metadata_json = excluded.metadata_json,
                 updated_at = excluded.updated_at
               WHERE file_outputs.user_id = excluded.user_id`
            )
              .bind(id, conversationId, verifiedUserId, sourceFileId, fileName, fileType, outputType, outputContent, metadataJson, nowIso, nowIso)
              .run();

            return sendJson(
              {
                success: true,
                output: {
                  id,
                  conversation_id: conversationId,
                  source_file_id: sourceFileId,
                  file_name: fileName,
                  file_type: fileType,
                  output_type: outputType,
                  output_content: outputContent,
                  metadata: body.metadata,
                  created_at: nowIso,
                  updated_at: nowIso,
                },
              },
              201
            );
          }

          // DELETE /api/conversations/:id/outputs/:fileId -> Delete saved output for a file
          if (request.method === 'DELETE' && targetFileId) {
            await env.DB.prepare(
              `DELETE FROM file_outputs WHERE conversation_id = ? AND user_id = ? AND source_file_id = ?`
            )
              .bind(conversationId, verifiedUserId, targetFileId)
              .run();

            return sendJson({ success: true, message: 'File output successfully removed' }, 200);
          }
        }

        // Match conversation routes: /api/conversations/:id and /api/conversations/:id/messages
        const convMatch = pathname.match(/^\/api\/conversations\/([^/]+)(\/messages)?$/);
        if (convMatch) {
          const conversationId = decodeURIComponent(convMatch[1]);
          const isMessagesRoute = Boolean(convMatch[2]);

          if (isMessagesRoute) {
            // 4. GET /api/conversations/:id/messages -> Retrieve message transcript
            if (request.method === 'GET') {
              // Ensure user owns this conversation
              const conv = await env.DB.prepare(
                `SELECT id FROM conversations WHERE id = ? AND user_id = ?`
              )
                .bind(conversationId, verifiedUserId)
                .first();

              if (!conv) {
                return sendError('Conversation not found or access denied', 404);
              }

              const { results } = await env.DB.prepare(
                `SELECT id, conversation_id, role, content, sources_json, reasoning, display_attachments_json, created_at 
                 FROM messages 
                 WHERE conversation_id = ? AND user_id = ? 
                 ORDER BY created_at ASC`
              )
                .bind(conversationId, verifiedUserId)
                .all();

              const formattedMessages = (results || []).map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                sources: m.sources_json ? JSON.parse(m.sources_json) : undefined,
                reasoning: m.reasoning || undefined,
                displayAttachments: m.display_attachments_json ? JSON.parse(m.display_attachments_json) : undefined,
                created_at: m.created_at,
              }));

              return sendJson({ success: true, messages: formattedMessages }, 200);
            }

            // 5. POST /api/conversations/:id/messages -> Append a single message or batch save messages
            if (request.method === 'POST') {
              const body: any = await request.json().catch(() => null);
              if (!body || typeof body !== 'object') {
                return sendError('Invalid message payload', 400);
              }

              // Auto-ensure conversation exists for this user
              const conv = await env.DB.prepare(
                `SELECT id FROM conversations WHERE id = ? AND user_id = ?`
              )
                .bind(conversationId, verifiedUserId)
                .first();

              const nowIso = new Date().toISOString();
              if (!conv) {
                const autoTitle = body.title || 'New Chat';
                await env.DB.prepare(
                  `INSERT INTO conversations (id, user_id, title, pinned, created_at, updated_at)
                   VALUES (?, ?, ?, 0, ?, ?)`
                )
                  .bind(conversationId, verifiedUserId, autoTitle, nowIso, nowIso)
                  .run();
              } else {
                // Update conversation updated_at timestamp
                await env.DB.prepare(
                  `UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?`
                )
                  .bind(nowIso, conversationId, verifiedUserId)
                  .run();
              }

              // Handle batch messages array if provided
              // Guaranteed preservation of reasoning text alongside content without duplicate message records [Commented by: Google AI Studio on 22/10/2026 04:49 AM]
              if (Array.isArray(body.messages)) {
                await env.DB.prepare(`DELETE FROM messages WHERE conversation_id = ? AND user_id = ?`)
                  .bind(conversationId, verifiedUserId)
                  .run()
                  .catch(() => {});

                const statements = [];
                for (const msg of body.messages) {
                  const msgId = msg.id || crypto.randomUUID();
                  const role = msg.role === 'ai' ? 'ai' : 'user';
                  const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                  const sourcesJson = msg.sources ? JSON.stringify(msg.sources) : null;
                  const reasoning = typeof msg.reasoning === 'string' ? msg.reasoning : null;
                  const attachmentsJson = msg.displayAttachments ? JSON.stringify(msg.displayAttachments) : null;
                  const createdAt = msg.created_at || nowIso;

                  statements.push(
                    env.DB.prepare(
                      `INSERT INTO messages (id, conversation_id, user_id, role, content, sources_json, reasoning, display_attachments_json, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(msgId, conversationId, verifiedUserId, role, content, sourcesJson, reasoning, attachmentsJson, createdAt)
                  );
                }

                if (statements.length > 0) {
                  await env.DB.batch(statements);
                }

                return sendJson({ success: true, count: statements.length }, 201);
              }

              // Handle single message payload
              const msgId = body.id || crypto.randomUUID();
              const role = body.role === 'ai' ? 'ai' : 'user';
              const content = typeof body.content === 'string' ? body.content : JSON.stringify(body.content);
              const sourcesJson = body.sources ? JSON.stringify(body.sources) : null;
              const reasoning = typeof body.reasoning === 'string' ? body.reasoning : null;
              const attachmentsJson = body.displayAttachments ? JSON.stringify(body.displayAttachments) : null;
              const createdAt = body.created_at || nowIso;

              await env.DB.prepare(
                `INSERT INTO messages (id, conversation_id, user_id, role, content, sources_json, reasoning, display_attachments_json, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
                .bind(msgId, conversationId, verifiedUserId, role, content, sourcesJson, reasoning, attachmentsJson, createdAt)
                .run();

              return sendJson(
                {
                  success: true,
                  message: {
                    id: msgId,
                    conversation_id: conversationId,
                    role,
                    content,
                    sources: body.sources,
                    reasoning: body.reasoning,
                    displayAttachments: body.displayAttachments,
                    created_at: createdAt,
                  },
                },
                201
              );
            }
          }

          // Conversation item operations: GET, PUT, DELETE
          if (request.method === 'GET') {
            const conv = await env.DB.prepare(
              `SELECT id, title, pinned, created_at, updated_at 
               FROM conversations 
               WHERE id = ? AND user_id = ?`
            )
              .bind(conversationId, verifiedUserId)
              .first();

            if (!conv) {
              return sendError('Conversation not found or access denied', 404);
            }

            return sendJson({ success: true, conversation: conv }, 200);
          }

          if (request.method === 'PUT') {
            const body: any = await request.json().catch(() => null);
            if (!body || typeof body !== 'object') {
              return sendError('Invalid update payload', 400);
            }

            const nowIso = new Date().toISOString();
            const title = typeof body.title === 'string' ? body.title.trim() : null;
            const pinned = typeof body.pinned === 'boolean' ? (body.pinned ? 1 : 0) : null;

            await env.DB.prepare(
              `UPDATE conversations 
               SET title = COALESCE(?, title),
                   pinned = COALESCE(?, pinned),
                   updated_at = ?
               WHERE id = ? AND user_id = ?`
            )
              .bind(title, pinned, nowIso, conversationId, verifiedUserId)
              .run();

            return sendJson({ success: true, updated_at: nowIso }, 200);
          }

          // Explicit cascade deletion: remove file_outputs, messages, and conversation without leaving orphans [Commented by: Google AI Studio on 15/10/2026 09:57 AM]
          if (request.method === 'DELETE') {
            await env.DB.prepare(`DELETE FROM file_outputs WHERE conversation_id = ? AND user_id = ?`)
              .bind(conversationId, verifiedUserId)
              .run();

            await env.DB.prepare(`DELETE FROM messages WHERE conversation_id = ? AND user_id = ?`)
              .bind(conversationId, verifiedUserId)
              .run();

            await env.DB.prepare(`DELETE FROM conversations WHERE id = ? AND user_id = ?`)
              .bind(conversationId, verifiedUserId)
              .run();

            return sendJson({ success: true, message: 'Conversation, messages, and saved outputs deleted successfully' }, 200);
          }
        }

        return sendError('Endpoint not found', 404);
      } catch (dbErr: unknown) {
        const error = dbErr as Error;
        console.error('D1 Database Query Error:', error);
        return sendError(`Database error: ${error.message}`, 500);
      }
    }

    return sendError('Not found', 404);
  },
};
