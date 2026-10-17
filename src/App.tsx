// {Created unified nanobot App with Supabase auth, settings, incognito mode, deep research, and smooth streaming} [Commented by: Google AI Studio on 10/12/2026 10:58 AM]

import React, { useState, useEffect, useRef } from 'react';
import { AuthModal } from './components/AuthModal';
import { SettingsModal } from './components/SettingsModal';
// {Imported R2 tiered archive storage and Tavily extract utility} [Commented by: Google AI Studio on 10/14/2026 10:35 AM]
import { UserProfile, isSupabaseConfigured, supabase, fetchUserEncryptedChats, persistEncryptedChatRecord, removeEncryptedChatRecord } from './lib/supabase';
import { deriveKeyFromPassword, encryptData, decryptData, encryptText, decryptText } from './lib/crypto';
import { analyzeFileWithScript, ProcessedFile } from './lib/fileReader';
import { performDynamicSearch, runDeepResearch, extractUrlsWithTavily } from './lib/tavily';
import { uploadArchiveToR2, fetchArchiveFromR2, deleteArchiveFromR2 } from './lib/r2';
import { markdownToHtml, escapeHtml, safeUrl } from './lib/markdown';
// {Imported MCP_PLUGINS to equip the AI model with real tools from connected servers} [Commented by: Google AI Studio on 10/13/2026 10:53 AM]
import { MCP_PLUGINS } from './lib/plugins';
// {Imported Cloudflare Worker API client for authenticated chat persistence} [Commented by: Google AI Studio on October 14, 2026 at 10:55 AM]
import { workerClient, WorkerMessage, WorkerFileOutput } from './lib/workerClient';
// {Imported IndexedDB storage manager for client-only original user files and orphaned cleanup} [Commented by: Google AI Studio on October 15, 2026 at 9:22 AM]
import {
  saveOriginalFile,
  getOriginalFile,
  getOriginalFilesForChat,
  deleteOriginalFilesForChat,
  clearAllOriginalFiles,
  cleanupOrphanedFiles
} from './lib/indexedDb';

interface ChatMessage {
  role: 'user' | 'ai';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  sources?: Array<{ title: string; url: string }>;
  reasoning?: string;
  displayAttachments?: Array<{ type: string; name: string; fileId?: string; isLocalMissing?: boolean }>;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  pinned: boolean;
  updated: number;
}

const STOP_FRAMES = ['|', '/', '-', '\\'];
const INPUT_MIN_HEIGHT = 52;

export default function App() {
  // Session & Auth State
  // {Removed email login state and added toast notification state for plain-text chat export} [Commented by: Google AI Studio on October 16, 2026 at 10:55 PM]
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [passwordSecret, setPasswordSecret] = useState<string>('');
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isIncognito, setIsIncognito] = useState(false);

  // Chat State
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<ProcessedFile[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [currentReasoning, setCurrentReasoning] = useState<string>('');
  const [reasoningExpanded, setReasoningExpanded] = useState<false | boolean>(false);
  const [activeSources, setActiveSources] = useState<Array<{ title: string; url: string }>>([]);
  const [showSourcesPopup, setShowSourcesPopup] = useState<number | null>(null);
  // {Added Cloudflare Worker history sync and non-intrusive status notice state} [Commented by: Google AI Studio on October 14, 2026 at 10:55 AM]
  const [isHistorySyncing, setIsHistorySyncing] = useState<boolean>(false);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  // {Added state for cloud-persisted AI file outputs and local storage quota warnings} [Commented by: Google AI Studio on October 15, 2026 at 9:22 AM]
  const [chatFileOutputs, setChatFileOutputs] = useState<Record<string, WorkerFileOutput[]>>({});
  const [quotaErrorNotice, setQuotaErrorNotice] = useState<string | null>(null);

  // Stream Smoothing Buffer
  const [streamDisplayContent, setStreamDisplayContent] = useState('');
  const targetContentRef = useRef('');
  const streamTickerRef = useRef<number | null>(null);

  // UI & Network State
  const [stopFrameIndex, setStopFrameIndex] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current Date/Time helper
  const getCurrentDateTime = () =>
    new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'full',
      timeStyle: 'medium',
      timeZone: 'Asia/Kolkata'
    }).format(new Date());

  // Listen to Online/Offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Stop button animation interval
  useEffect(() => {
    if (!isGenerating) {
      setStopFrameIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setStopFrameIndex((prev) => (prev + 1) % STOP_FRAMES.length);
    }, 120);
    return () => clearInterval(timer);
  }, [isGenerating]);

  // Derive CryptoKey and load Cloudflare Worker history when user logs in with password
  useEffect(() => {
    // {Fetch remote chat history from Cloudflare Worker D1 backend upon user login} [Commented by: Google AI Studio on October 14, 2026 at 10:55 AM]
    if (currentUser && passwordSecret) {
      deriveKeyFromPassword(passwordSecret, currentUser.salt || 'default_nanobot_salt')
        .then((key) => {
          setCryptoKey(key);
          loadEncryptedChats(currentUser.id, key);
          loadWorkerConversations(key);
        })
        .catch((err) => {
          console.error('Error deriving encryption key:', err);
          loadWorkerConversations();
        });
    } else if (currentUser) {
      loadWorkerConversations();
    } else {
      setCryptoKey(null);
      // Load unencrypted fallback chats if guest
      try {
        const stored = JSON.parse(localStorage.getItem('nanobot_chats') || '[]');
        // Filter out chats older than 30 days
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const validChats = stored.filter((c: ChatSession) => Date.now() - (c.updated || 0) < thirtyDaysMs);
        setChats(validChats);
      } catch {
        setChats([]);
      }
    }
  }, [currentUser, passwordSecret]);

  // {Export currently active chat history as a clean plain text file for local backup and sharing} [Commented by: Google AI Studio on October 16, 2026 at 10:55 PM]
  const handleExportActiveChat = () => {
    const targetChat = chats.find((c) => c.id === activeChatId) || (activeChatId ? null : chats[0]);
    if (!targetChat || targetChat.messages.length === 0) {
      setToastNotice('No active chat messages to export.');
      setTimeout(() => setToastNotice(null), 3000);
      return;
    }

    const divider = '='.repeat(80);
    const subDivider = '-'.repeat(80);
    const dateStr = new Date(targetChat.updated || Date.now()).toLocaleString();
    const exportTime = new Date().toLocaleString();

    let output = `${divider}\n`;
    output += `NANOBOT CHAT BACKUP\n`;
    output += `Title: ${targetChat.title}\n`;
    output += `Updated: ${dateStr}\n`;
    output += `Exported: ${exportTime}\n`;
    output += `Total Messages: ${targetChat.messages.length}\n`;
    output += `${divider}\n\n`;

    targetChat.messages.forEach((msg) => {
      const isUser = msg.role === 'user';
      const sender = isUser ? '[USER]' : '[NANOBOT AI]';
      const textContent =
        typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
          ? msg.content.map((c) => (c.type === 'text' ? c.text : '')).filter(Boolean).join('\n')
          : String(msg.content || '');

      output += `${sender}:\n${textContent}\n`;

      if (msg.displayAttachments && msg.displayAttachments.length > 0) {
        output += `\n[Attachments]: ${msg.displayAttachments.map((a) => a.name).join(', ')}\n`;
      }

      if (msg.reasoning) {
        output += `\n[Reasoning / Thinking]:\n${msg.reasoning}\n`;
      }

      if (msg.sources && msg.sources.length > 0) {
        output += `\n[Sources / Citations]:\n`;
        msg.sources.forEach((s) => {
          output += `- ${s.title}: ${s.url}\n`;
        });
      }

      output += `\n${subDivider}\n\n`;
    });

    output += `${divider}\n`;
    output += `End of chat history. Exported from nanobot (https://nanobot-chatbot.netlify.app)\n`;
    output += `${divider}\n`;

    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = (targetChat.title || 'chat')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 40);
    const fileDate = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `nanobot-${safeTitle}-${fileDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setToastNotice('Chat history exported as plain text file!');
    setTimeout(() => setToastNotice(null), 3000);
  };

  // {Global keyboard listener for Ctrl+S or Cmd+S to export active chat history} [Commented by: Google AI Studio on October 16, 2026 at 10:55 PM]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleExportActiveChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chats, activeChatId]);

  // {Persist and synchronize conversation history with Cloudflare Worker D1 backend using Supabase Bearer token, with zero-knowledge title decryption} [Commented by: Google AI Studio on October 16, 2026 at 10:55 PM]
  const loadWorkerConversations = async (providedKey?: CryptoKey | null) => {
    if (!currentUser) return;
    setIsHistorySyncing(true);
    const activeKey = providedKey !== undefined ? providedKey : cryptoKey;
    try {
      const res = await workerClient.listConversations();
      if (res.success && res.data?.conversations) {
        const workerConvs = res.data.conversations;
        if (workerConvs.length > 0) {
          const decryptedConvs = await Promise.all(
            workerConvs.map(async (wc) => {
              let displayTitle = wc.title;
              if (activeKey && displayTitle && displayTitle.startsWith('enc:')) {
                displayTitle = await decryptText(displayTitle, activeKey);
              }
              return { ...wc, title: displayTitle };
            })
          );

          setChats((prev) => {
            const map = new Map<string, ChatSession>();
            prev.forEach((c) => map.set(c.id, c));
            decryptedConvs.forEach((wc) => {
              const existing = map.get(wc.id);
              map.set(wc.id, {
                id: wc.id,
                title: wc.title,
                pinned: Boolean(wc.pinned),
                messages: existing?.messages || [],
                updated: wc.updated_at ? new Date(wc.updated_at).getTime() : Date.now(),
              });
            });
            const merged = Array.from(map.values()).sort(
              (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated
            );
            // Clean up any local IndexedDB files for conversations deleted remotely
            cleanupOrphanedFiles(merged.map((m) => m.id)).catch(() => {});
            return merged;
          });
        }
        setHistoryNotice(null);
      } else if (res.isNetworkError) {
        console.warn('Cloudflare Worker history temporarily unavailable; falling back to local chat cache:', res.error);
        setHistoryNotice('Cloud history worker syncing locally. Your chat is fully functional.');
      } else if (res.isAuthError) {
        console.warn('Cloudflare Worker auth notice:', res.error);
      }
    } catch (workerErr) {
      console.warn('Worker conversations query notice:', workerErr);
      setHistoryNotice('Cloud history worker syncing locally. Your chat is fully functional.');
    } finally {
      setIsHistorySyncing(false);
    }
  };

  // {Load message history and AI file outputs from Cloudflare Worker with zero-knowledge decryption, verifying local file presence in IndexedDB} [Commented by: Google AI Studio on October 16, 2026 at 10:55 PM]
  const handleSelectChat = async (id: string) => {
    setActiveChatId(id);
    setSidebarOpen(false);

    // Check local file availability in IndexedDB for this conversation
    const localFiles = await getOriginalFilesForChat(id);
    const localFileIds = new Set(localFiles.map((f) => f.fileId));

    if (currentUser) {
      // Fetch persisted AI file outputs from Cloudflare D1
      try {
        const outRes = await workerClient.getFileOutputs(id);
        if (outRes.success && outRes.data?.outputs) {
          const decryptedOutputs = await Promise.all(
            outRes.data.outputs.map(async (o) => {
              let content = o.output_content;
              if (cryptoKey && content && content.startsWith('enc:')) {
                content = await decryptText(content, cryptoKey);
              }
              return { ...o, output_content: content };
            })
          );
          setChatFileOutputs((prev) => ({ ...prev, [id]: decryptedOutputs }));
        }
      } catch (err) {
        console.warn('Worker getFileOutputs notice:', err);
      }
    }

    const targetChat = chats.find((c) => c.id === id);
    if (currentUser && targetChat && targetChat.messages.length === 0) {
      setIsHistorySyncing(true);
      try {
        const res = await workerClient.getMessages(id);
        if (res.success && res.data?.messages) {
          const loadedMessages: ChatMessage[] = await Promise.all(
            res.data.messages.map(async (m) => {
              let plainContent = m.content;
              let plainReasoning = m.reasoning;
              if (cryptoKey) {
                if (plainContent && plainContent.startsWith('enc:')) {
                  plainContent = await decryptText(plainContent, cryptoKey);
                }
                if (plainReasoning && plainReasoning.startsWith('enc:')) {
                  plainReasoning = await decryptText(plainReasoning, cryptoKey);
                }
              }
              return {
                role: m.role,
                content: plainContent,
                sources: m.sources,
                reasoning: plainReasoning,
                displayAttachments: m.displayAttachments?.map((att) => ({
                  ...att,
                  isLocalMissing: att.fileId ? !localFileIds.has(att.fileId) : false,
                })),
              };
            })
          );
          setChats((prev) =>
            prev.map((c) => (c.id === id ? { ...c, messages: loadedMessages } : c))
          );
        }
      } catch (err) {
        console.warn('Worker getMessages notice:', err);
      } finally {
        setIsHistorySyncing(false);
      }
    } else if (targetChat) {
      // Update local presence flags for already loaded messages
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === id) {
            return {
              ...c,
              messages: c.messages.map((m) => ({
                ...m,
                displayAttachments: m.displayAttachments?.map((att) => ({
                  ...att,
                  isLocalMissing: att.fileId ? !localFileIds.has(att.fileId) : false,
                })),
              })),
            };
          }
          return c;
        })
      );
    }
  };

  // {Integrated remote Supabase encrypted chat syncing with Cloudflare R2 tiered archives} [Commented by: Google AI Studio on 10/14/2026 10:35 AM]
  const loadEncryptedChats = async (userId: string, key: CryptoKey) => {
    try {
      const records = await fetchUserEncryptedChats(userId);
      const decryptedChats: ChatSession[] = [];

      for (const rec of records) {
        try {
          const decryptedTitle = await decryptData(rec.title_ciphertext, rec.iv, key);
          const decryptedPayload = await decryptData(rec.data_ciphertext, rec.iv, key);
          const parsed = JSON.parse(decryptedPayload);

          let allMessages: ChatMessage[] = parsed.messages || [];

          // Tiered check: Retrieve older archived messages from Cloudflare R2 if available
          const r2Archive = await fetchArchiveFromR2(rec.id);
          if (r2Archive) {
            try {
              const decryptedR2 = await decryptData(r2Archive, rec.iv, key);
              const parsedR2 = JSON.parse(decryptedR2);
              if (Array.isArray(parsedR2.messages) && parsedR2.messages.length > 0) {
                allMessages = [...parsedR2.messages, ...allMessages];
              }
            } catch (r2Err) {
              console.warn('R2 archive decrypt note:', r2Err);
            }
          }

          decryptedChats.push({
            id: rec.id,
            title: decryptedTitle,
            messages: allMessages,
            pinned: rec.pinned,
            updated: new Date(rec.updated_at).getTime()
          });
        } catch (decryptErr) {
          console.warn('Failed to decrypt chat record:', rec.id, decryptErr);
        }
      }

      setChats((prev) => {
        const map = new Map<string, ChatSession>();
        prev.forEach((c) => map.set(c.id, c));
        decryptedChats.forEach((dc) => map.set(dc.id, dc));
        return Array.from(map.values()).sort(
          (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated
        );
      });
    } catch (e) {
      console.error('Error loading encrypted chats:', e);
    }
  };

  // Save active chat (Encrypted to Supabase + R2 if signed in, skipped if Incognito)
  // {Enforced file storage isolation: raw files/images stay local, cloud backups store code output only} [Commented by: Google AI Studio on 10/14/2026 10:35 AM]
  // {Persist chat session and messages to Cloudflare Worker D1 backend with Supabase token verification} [Commented by: Google AI Studio on October 14, 2026 at 10:55 AM]
  const persistChat = async (chat: ChatSession) => {
    if (isIncognito) return; // Do not save incognito chats

    // Strip bulky raw image data URLs before cloud persistence; retain text and script analyzer code output
    const cleanMessagesForCloud = chat.messages.map((m) => {
      if (Array.isArray(m.content)) {
        const textParts = m.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text || '')
          .join('\n');
        return {
          ...m,
          content: textParts || '[Multimodal Message]'
        };
      }
      return m;
    });

    // {Zero-knowledge client-side encryption: encrypt title and message contents before sending to Cloudflare Worker D1 so developer cannot read them} [Commented by: Google AI Studio on October 16, 2026 at 10:55 PM]
    if (currentUser) {
      (async () => {
        let titleToSync = chat.title;
        let workerMessagesToSync: WorkerMessage[] = cleanMessagesForCloud.map((m) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          sources: m.sources,
          reasoning: m.reasoning,
          displayAttachments: m.displayAttachments,
        }));

        if (cryptoKey) {
          try {
            titleToSync = await encryptText(chat.title, cryptoKey, currentUser.salt || 'salt');
            workerMessagesToSync = await Promise.all(
              cleanMessagesForCloud.map(async (m) => {
                const rawContent = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
                const encContent = await encryptText(rawContent, cryptoKey, currentUser.salt || 'salt');
                const encReasoning = m.reasoning
                  ? await encryptText(m.reasoning, cryptoKey, currentUser.salt || 'salt')
                  : undefined;
                return {
                  role: m.role,
                  content: encContent,
                  sources: m.sources,
                  reasoning: encReasoning,
                  displayAttachments: m.displayAttachments,
                };
              })
            );
          } catch (encErr) {
            console.warn('Worker encryption notice:', encErr);
          }
        }

        // 1. Sync conversation metadata to Cloudflare Worker D1 backend asynchronously
        workerClient
          .createOrUpdateConversation({
            id: chat.id,
            title: titleToSync,
            pinned: chat.pinned,
            updated_at: new Date(chat.updated).toISOString(),
          })
          .then((res) => {
            if (!res.success && res.error) {
              console.warn('Worker sync notice (conversation):', res.error);
              if (res.isNetworkError) {
                setHistoryNotice('Cloud history worker syncing locally. Your chat is fully functional.');
              }
            } else {
              setHistoryNotice(null);
            }
          })
          .catch(() => {});

        // 2. Batch save clean messages to Cloudflare Worker D1 backend asynchronously
        workerClient
          .saveMessagesBatch(chat.id, workerMessagesToSync, titleToSync)
          .then((res) => {
            if (!res.success && res.error) {
              console.warn('Worker sync notice (messages):', res.error);
            }
          })
          .catch(() => {});
      })();
    }

    if (currentUser && cryptoKey) {
      try {
        let recentMessages = cleanMessagesForCloud;
        let olderMessages: ChatMessage[] = [];

        // Tiered archiving: If more than 10 messages, archive older conversation to Cloudflare R2
        if (cleanMessagesForCloud.length > 10) {
          olderMessages = cleanMessagesForCloud.slice(0, cleanMessagesForCloud.length - 10);
          recentMessages = cleanMessagesForCloud.slice(cleanMessagesForCloud.length - 10);

          const olderPayload = JSON.stringify({ messages: olderMessages });
          const encryptedOlder = await encryptData(olderPayload, cryptoKey, currentUser.salt || 'salt');
          await uploadArchiveToR2(chat.id, encryptedOlder.ciphertext);
        }

        const payloadStr = JSON.stringify({ messages: recentMessages });
        const encrypted = await encryptData(payloadStr, cryptoKey, currentUser.salt || 'salt');
        const titleEncrypted = await encryptData(chat.title, cryptoKey, currentUser.salt || 'salt');

        const record = {
          id: chat.id,
          user_id: currentUser.id,
          title_ciphertext: titleEncrypted.ciphertext,
          data_ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          salt: currentUser.salt,
          pinned: chat.pinned,
          updated_at: new Date(chat.updated).toISOString()
        };

        await persistEncryptedChatRecord(record);
      } catch (err) {
        console.error('Failed to encrypt chat:', err);
      }
    } else {
      // Local storage fallback for guests
      try {
        const updatedChats = chats.map((c) => (c.id === chat.id ? chat : c));
        if (!updatedChats.some((c) => c.id === chat.id)) updatedChats.push(chat);
        localStorage.setItem('nanobot_chats', JSON.stringify(updatedChats));
      } catch (e) {
        console.error('Failed to save chat locally:', e);
      }
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats, currentStatus, streamDisplayContent]);

  // Smooth Token Streaming Ticker
  const startStreamSmoothing = () => {
    targetContentRef.current = '';
    setStreamDisplayContent('');

    const tick = () => {
      const target = targetContentRef.current;
      setStreamDisplayContent((current) => {
        if (current.length < target.length) {
          const step = Math.max(1, Math.ceil((target.length - current.length) / 4));
          const next = target.slice(0, current.length + step);
          return next;
        }
        return current;
      });
      streamTickerRef.current = requestAnimationFrame(tick);
    };

    streamTickerRef.current = requestAnimationFrame(tick);
  };

  const stopStreamSmoothing = () => {
    if (streamTickerRef.current) {
      cancelAnimationFrame(streamTickerRef.current);
      streamTickerRef.current = null;
    }
    setStreamDisplayContent(targetContentRef.current);
  };

  // Start new chat
  const handleStartNewChat = () => {
    setActiveChatId(null);
    setInputText('');
    setAttachments([]);
    setCurrentStatus(null);
    setCurrentReasoning('');
    setReasoningExpanded(false);
    setActiveSources([]);
    if (textareaRef.current) textareaRef.current.style.height = `${INPUT_MIN_HEIGHT}px`;
  };

  // Active chat session
  const activeChat = chats.find((c) => c.id === activeChatId);

  // File Upload Handler (Non-images get Python reader analysis with "Reading Files" status)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        if (!file.type.startsWith('image/')) {
          setCurrentStatus('Reading Files');
        }
        const processed = await analyzeFileWithScript(file);
        setAttachments((prev) => [...prev, processed]);
      } catch (err) {
        console.error('Error analyzing file:', err);
      } finally {
        setCurrentStatus(null);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove attachment
  const handleRemoveAttachment = (id: number) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Send message
  const handleSend = async () => {
    if (isGenerating) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setIsGenerating(false);
      stopStreamSmoothing();
      return;
    }

    const trimmedPrompt = inputText.trim();
    if (!trimmedPrompt && attachments.length === 0) return;

    if (!isOnline) {
      alert('No Internet connection available.');
      return;
    }

    // Determine API Keys
    const orKey = currentUser?.openrouter_key || import.meta.env.VITE_OPENROUTER_API_KEY || '';
    const tvKey = currentUser?.tavily_key || import.meta.env.VITE_TAVILY_API_KEY || '';

    if (!orKey && !trimmedPrompt.startsWith('#')) {
      alert('Please Sign In or configure your OpenRouter API Key in Account Settings.');
      return;
    }

    // Prepare User Message Content
    let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    const displayAttachments: Array<{ type: string; name: string; fileId?: string; isLocalMissing?: boolean }> = [];

    // Check if there are non-image files with extracted text
    let attachedFileContext = '';
    attachments.forEach((att) => {
      displayAttachments.push({
        type: att.isImage ? 'image' : 'file',
        name: att.name,
        fileId: att.fileId,
        isLocalMissing: false
      });
      if (!att.isImage && att.contentSnippet) {
        attachedFileContext += `\n\n--- Uploaded File: ${att.name} ---\n${att.contentSnippet}\n`;
      }
    });

    const promptSummary = trimmedPrompt || (attachments.length > 0 ? attachments[0].name : 'New Chat');

    // Create or locate chat session
    let chat = activeChat;
    if (!chat) {
      chat = {
        id: Date.now().toString(),
        title: promptSummary.slice(0, 30),
        messages: [],
        pinned: false,
        updated: Date.now()
      };
      setChats((prev) => [chat!, ...prev]);
      setActiveChatId(chat.id);
    }

    // {Save raw files strictly to browser IndexedDB and persist AI outputs to Cloudflare D1} [Commented by: Google AI Studio on October 15, 2026 at 9:22 AM]
    attachments.forEach((att) => {
      if (att.originalFile) {
        saveOriginalFile(chat!.id, att.fileId, att.originalFile, att.name, att.type, att.size)
          .then((res) => {
            if (!res.success && res.error) {
              setQuotaErrorNotice(res.error);
            }
          })
          .catch((err) => {
            console.warn('IndexedDB saveOriginalFile error:', err);
          });
      }

      // {Zero-knowledge client-side encryption for AI file outputs sent to Cloudflare Worker D1} [Commented by: Google AI Studio on October 16, 2026 at 10:55 PM]
      if (currentUser) {
        const outputPayload = att.contentSnippet + (att.generatedReaderCode ? `\n\n[Python Reader Script]:\n${att.generatedReaderCode}` : '');
        (async () => {
          let payloadToSave = outputPayload;
          if (cryptoKey) {
            try {
              payloadToSave = await encryptText(outputPayload, cryptoKey, currentUser.salt || 'salt');
            } catch (encErr) {
              console.warn('File output encryption notice:', encErr);
            }
          }
          workerClient.saveFileOutput(chat!.id, {
            source_file_id: att.fileId,
            file_name: att.name,
            file_type: att.type,
            output_type: att.outputType,
            output_content: payloadToSave,
            metadata: { size: att.size, isImage: att.isImage }
          }).then((res) => {
            if (res.success && res.data?.output) {
              setChatFileOutputs((prev) => ({
                ...prev,
                [chat!.id]: [...(prev[chat!.id] || []).filter((o) => o.source_file_id !== att.fileId), { ...res.data!.output, output_content: outputPayload }]
              }));
            }
          }).catch((err) => {
            console.warn('workerClient.saveFileOutput error:', err);
          });
        })();
      }
    });

    // {Inject preserved AI outputs when continuing conversation on a device where raw file is missing} [Commented by: Google AI Studio on October 15, 2026 at 9:22 AM]
    const existingCloudOutputs = chatFileOutputs[chat.id] || [];
    let cloudOutputsContext = '';
    if (attachments.length === 0 && existingCloudOutputs.length > 0) {
      existingCloudOutputs.forEach((out) => {
        cloudOutputsContext += `\n\n[Preserved AI Output for file: "${out.file_name}"]:\n(Note: Original file bytes reside locally in the original user browser and are unavailable on this device. The model is using the cloud-preserved extraction output.)\n${out.output_content}\n`;
      });
    }

    const fullTextPrompt = trimmedPrompt + attachedFileContext + cloudOutputsContext;

    // {Typed userContent multimodal parts array explicitly for TypeScript safety} [Commented by: Google AI Studio on 10/12/2026 11:00 AM]
    const imageAttachments = attachments.filter((a) => a.isImage && a.dataUrl);
    if (imageAttachments.length > 0) {
      const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      if (fullTextPrompt) {
        parts.push({ type: 'text', text: fullTextPrompt });
      }
      imageAttachments.forEach((img) => {
        parts.push({ type: 'image_url', image_url: { url: img.dataUrl! } });
      });
      userContent = parts;
    } else {
      userContent = fullTextPrompt;
    }

    // Append user message
    const updatedMessages: ChatMessage[] = [
      ...chat.messages,
      {
        role: 'user',
        content: userContent,
        displayAttachments
      }
    ];

    chat.messages = updatedMessages;
    chat.updated = Date.now();
    persistChat(chat);

    // Reset composer input
    setInputText('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = `${INPUT_MIN_HEIGHT}px`;

    // Initialize Generation
    setIsGenerating(true);
    setCurrentReasoning('');
    setReasoningExpanded(false);
    setActiveSources([]);
    startStreamSmoothing();

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Check for Deep Research triggers: # (mini) and ## (pro)
    if (trimmedPrompt.startsWith('#')) {
      const isPro = trimmedPrompt.startsWith('##');
      const researchQuery = trimmedPrompt.replace(/^##?/, '').trim();

      setCurrentStatus(`Deep Research (${isPro ? 'Pro' : 'Mini'})...`);

      try {
        const researchResult = await runDeepResearch(
          researchQuery,
          isPro ? 'pro' : 'mini',
          tvKey,
          (status) => setCurrentStatus(status),
          signal
        );

        targetContentRef.current = researchResult.content;
        stopStreamSmoothing();

        const aiMsg: ChatMessage = {
          role: 'ai',
          content: researchResult.content,
          sources: researchResult.sources
        };

        chat.messages.push(aiMsg);
        persistChat(chat);
        setCurrentStatus(null);
      } catch (err: unknown) {
        const e = err as Error;
        const errMsg = e.name === 'AbortError' ? 'Research Stopped.' : e.message;
        chat.messages.push({ role: 'ai', content: errMsg });
        persistChat(chat);
        setCurrentStatus(null);
      } finally {
        setIsGenerating(false);
        stopStreamSmoothing();
      }
      return;
    }

    // {Configured system prompt with real MCP server tool definitions, persona rules, and URL scraping capability} [Commented by: Google AI Studio on 10/14/2026 10:35 AM]
    const customInstructions = currentUser?.ai_instructions || '';
    const connectedPlugins = currentUser?.plugins_connected || {};
    const activePlugins = MCP_PLUGINS.filter((p) => connectedPlugins[p.id as keyof typeof connectedPlugins]);
    const toolsContext = activePlugins
      .map(
        (p) =>
          `[Server: ${p.mcpServerName} (${p.name})]:\n` +
          p.tools.map((t) => `  * ${t.name}: ${t.description}`).join('\n')
      )
      .join('\n\n');

    const systemPrompt = `You are 'nanobot', an advanced, autonomous AI assistant. You can process text, images, and files seamlessly. Current Date/Time: ${getCurrentDateTime()}.
Follow these guidelines strictly:
1. Always use emojis for visual cues to make the conversation engaging.
2. If a user asks for up-to-date facts, news, or information you lack, you MUST search the web. To do this, output EXACTLY the tag <search>your search query</search>. You may output multiple tags for parallel searches.
3. If you need to scrape or read the full content of one or more URLs, output the tags <Scrap1>URL1</Scrap1> <Scrap2>URL2</Scrap2> (you can scrape multiple URLs). You can do this on your first response or after receiving search results.
4. Keep search queries concise and optimized for a search engine.
5. When you receive search results or scraped webpage contents, analyze them carefully and provide a comprehensive final answer.
6. Always cite your sources using inline citations in the format [1], [2], corresponding to the provided search results. Do not list the sources at the end of your response.
7. If the user ever wants some help on personal stuff, you must reply as if you are an objective outsider on that matter.
${toolsContext ? `8. Connected MCP Server Tools: You have direct access to the following connected server tools:\n${toolsContext}\nWhen the user explicitly asks you to use a plugin, execute the tool action and synthesize the results for them.` : ''}
${customInstructions ? `Custom User Instructions: ${customInstructions}` : ''}`;

    const apiMessages: Array<{ role: string; content: unknown }> = [
      { role: 'system', content: systemPrompt }
    ];

    chat.messages.slice(-4).forEach((m) => {
      apiMessages.push({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content });
    });

    let currentOutput = '';
    let reasoningText = '';
    const accumulatedSources: Array<{ title: string; url: string }> = [];

    async function runGeneration(messagesArr: typeof apiMessages, depth = 0) {
      if (depth > 2) return;
      setCurrentStatus('Generating Answer...');

      // Determine model training opt-out parameter (incognito or user toggle OFF)
      const optOutTraining = isIncognito || currentUser?.model_training === false;

      const bodyPayload: Record<string, unknown> = {
        model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
        temperature: 0.0,
        stream: true,
        reasoning: { enabled: true, effort: 'medium' },
        messages: messagesArr
      };

      if (optOutTraining) {
        bodyPayload.data_collection = 'deny';
      }

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orKey}`
        },
        body: JSON.stringify(bodyPayload),
        signal
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`OpenRouter Error (${res.status}): ${errText || res.statusText}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Response stream unavailable.');

      let searchTriggered = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n');

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned.startsWith('data: ')) continue;
          const dataStr = cleaned.replace('data: ', '').trim();
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta || {};

            const reasoningDelta = Array.isArray(delta.reasoning_details)
              ? delta.reasoning_details
              : Array.isArray(delta.reasoning_content)
              ? delta.reasoning_content
              : typeof delta.reasoning === 'string'
              ? [delta.reasoning]
              : [];

            for (const item of reasoningDelta) {
              const chunk =
                typeof item === 'string'
                  ? item
                  : item?.type === 'reasoning.text'
                  ? item.text
                  : item?.text || '';
              if (chunk) {
                reasoningText += chunk;
                setCurrentReasoning(reasoningText);
              }
            }

            const token = delta.content || '';
            if (token) {
              currentOutput += token;
              targetContentRef.current = currentOutput;
            }
          } catch {
            // Ignore partial stream parse errors
          }
        }
      }

      // {Added regex detector and handler for Tavily URL scraping tags <Scrap1>URL1</Scrap1>} [Commented by: Google AI Studio on 10/14/2026 10:35 AM]
      const scrapMatches = [...currentOutput.matchAll(/<Scrap\d*>(.*?)<\/Scrap\d*>/gi)]
        .map((m) => m[1].trim())
        .filter(Boolean);

      if (scrapMatches.length > 0) {
        setCurrentStatus('Scraping Web Pages...');
        try {
          const extracted = await extractUrlsWithTavily(scrapMatches, tvKey, signal);
          const combinedScraps = extracted
            .map((item, idx) => {
              return `[Scraped Page ${idx + 1}] URL: ${item.url}\n${item.rawContent || item.error || 'Empty content'}`;
            })
            .join('\n\n---\n\n');

          const nextMessages = [
            ...messagesArr,
            { role: 'assistant', content: currentOutput },
            { role: 'user', content: `Scraped Web Pages Content:\n${combinedScraps}` }
          ];

          currentOutput = '';
          targetContentRef.current = '';
          await runGeneration(nextMessages, depth + 1);
          return;
        } catch (scrapErr) {
          console.warn('Scraping execution error:', scrapErr);
        }
      }

      // Check for <search> queries
      const queries = [...currentOutput.matchAll(/<search>(.*?)<\/search>/g)]
        .map((m) => m[1].trim())
        .filter(Boolean);

      if (queries.length > 0) {
        searchTriggered = true;
      }

      if (searchTriggered) {
        setCurrentStatus(`Searching Online for ${queries.length} queries...`);

        const searchPromises = queries.map((q) => performDynamicSearch(q, tvKey, signal));
        const results = await Promise.all(searchPromises);

        const formattedSections: string[] = [];
        results.forEach((res, qIdx) => {
          const items = res.rawResults || [];
          const lines = [`Query: ${queries[qIdx]}`];
          if (items.length === 0) {
            lines.push('Results: No results found.');
          } else {
            lines.push('Results:');
            items.forEach((item: { title?: string; url: string; content?: string }) => {
              const url = safeUrl(item.url);
              let existingIdx = accumulatedSources.findIndex((s) => s.url === url);
              if (existingIdx === -1) {
                accumulatedSources.push({ title: item.title || item.url || 'Source', url });
                existingIdx = accumulatedSources.length - 1;
              }
              lines.push(`[Source ${existingIdx + 1}] Title: ${item.title || 'Untitled'}\nURL: ${url}\nContent: ${item.content || ''}`);
            });
          }
          formattedSections.push(lines.join('\n'));
        });

        setActiveSources([...accumulatedSources]);

        const combinedText = formattedSections.join('\n\n---\n\n');
        const nextMessages = [
          ...messagesArr,
          { role: 'assistant', content: currentOutput },
          { role: 'user', content: `Search Results:\n${combinedText}` }
        ];

        currentOutput = '';
        targetContentRef.current = '';
        await runGeneration(nextMessages, depth + 1);
      }
    }

    try {
      await runGeneration(apiMessages);

      stopStreamSmoothing();

      if (!currentOutput.trim()) {
        currentOutput = reasoningText.trim()
          ? 'Completed thinking, but did not generate a final answer.'
          : 'No response received.';
      }

      const aiMessage: ChatMessage = {
        role: 'ai',
        content: currentOutput,
        sources: accumulatedSources,
        reasoning: reasoningText
      };

      chat.messages.push(aiMessage);
      persistChat(chat);
    } catch (err: unknown) {
      stopStreamSmoothing();
      const e = err as Error;
      if (e.name === 'AbortError') {
        const stoppedMsg: ChatMessage = {
          role: 'ai',
          content: currentOutput || 'Stopped',
          sources: accumulatedSources,
          reasoning: reasoningText
        };
        chat.messages.push(stoppedMsg);
        persistChat(chat);
      } else {
        const errorMsg = e.message.startsWith('OpenRouter Error:') ? e.message : `OpenRouter Error: ${e.message}`;
        chat.messages.push({ role: 'ai', content: errorMsg });
        persistChat(chat);
      }
    } finally {
      setIsGenerating(false);
      setCurrentStatus(null);
    }
  };

  // Clear chat history
  // {Synchronized batch chat deletion with Cloudflare Worker D1 backend and local IndexedDB file cleanup} [Commented by: Google AI Studio on October 15, 2026 at 9:22 AM]
  const handleClearChatHistory = () => {
    if (!window.confirm('Clear unpinned chats from history?')) return;
    const remaining = chats.filter((c) => c.pinned);
    setChats(remaining);

    // {Synchronized chat deletions to remote Supabase, Cloudflare Worker, and local IndexedDB file storage} [Commented by: Google AI Studio on October 15, 2026 at 9:22 AM]
    chats.forEach((c) => {
      if (!c.pinned) {
        removeEncryptedChatRecord(c.id);
        deleteArchiveFromR2(c.id);
        localStorage.removeItem('nanobot_files_' + c.id);
        deleteOriginalFilesForChat(c.id).catch(() => {});
        if (currentUser) {
          workerClient.deleteConversation(c.id).catch(() => {});
        }
      }
    });

    try {
      localStorage.setItem('nanobot_chats', JSON.stringify(remaining));
    } catch {}

    handleStartNewChat();
  };

  // Toggle chat pin
  // {Synchronized conversation pin state with Cloudflare Worker D1 backend} [Commented by: Google AI Studio on October 14, 2026 at 10:55 AM]
  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const next = { ...c, pinned: !c.pinned };
          persistChat(next);
          if (currentUser) {
            workerClient.updateConversation(id, { pinned: next.pinned }).catch(() => {});
          }
          return next;
        }
        return c;
      })
    );
  };

  // Delete chat
  // {Synchronized conversation deletion with Cloudflare Worker D1 backend and local IndexedDB file cleanup} [Commented by: Google AI Studio on October 15, 2026 at 9:22 AM]
  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteOriginalFilesForChat(id).catch(() => {});
    removeEncryptedChatRecord(id);
    deleteArchiveFromR2(id);
    localStorage.removeItem('nanobot_files_' + id);
    if (currentUser) {
      workerClient.deleteConversation(id).catch(() => {});
    }
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) handleStartNewChat();
  };

  // Rename chat
  // {Synchronized conversation rename with Cloudflare Worker D1 backend} [Commented by: Google AI Studio on October 14, 2026 at 10:55 AM]
  const handleRenameChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const chat = chats.find((c) => c.id === id);
    const nextTitle = prompt('Rename chat:', chat?.title)?.trim();
    if (nextTitle) {
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === id) {
            const next = { ...c, title: nextTitle.slice(0, 50) };
            persistChat(next);
            if (currentUser) {
              workerClient.updateConversation(id, { title: next.title }).catch(() => {});
            }
            return next;
          }
          return c;
        })
      );
    }
  };

  // Auto-resize composer textarea
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = `${INPUT_MIN_HEIGHT}px`;
    e.target.style.height = `${Math.max(e.target.scrollHeight, INPUT_MIN_HEIGHT)}px`;
  };

  return (
    <div className="flex h-screen w-screen relative bg-black text-white overflow-hidden">
      {/* SIDEBAR */}
      {/* {Restored UI scale matching nanobot.html and Old UI specifications} [Commented by: Google AI Studio on 10/14/2026 10:35 AM] */}
      <aside
        className={`${
          sidebarOpen ? 'flex' : 'hidden'
        } w-[300px] h-full bg-[#0a0a0a] border-r border-[#262626] flex-col p-[15px] z-40 shrink-0`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#262626] mb-3">
          <h3 className="font-semibold text-sm tracking-wide text-neutral-300">
            History ◴
          </h3>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-neutral-400 hover:text-white p-1 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* {Cloudflare Worker history sync indicator and non-intrusive offline fallback status} [Commented by: Google AI Studio on October 14, 2026 at 10:55 AM] */}
        {isHistorySyncing && (
          <div className="text-[10px] text-neutral-400 mb-2 flex items-center gap-1.5 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Syncing history...</span>
          </div>
        )}
        {historyNotice && (
          <div className="bg-[#1f1604] border border-[#a16207] text-[#fef08a] px-2 py-1.5 rounded text-[10px] mb-2 flex items-center justify-between">
            <span className="leading-tight">{historyNotice}</span>
            <button
              onClick={() => setHistoryNotice(null)}
              className="ml-1 text-neutral-400 hover:text-white cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>
        )}
        {/* {Non-intrusive IndexedDB storage quota warning} [Commented by: Google AI Studio on October 15, 2026 at 9:22 AM] */}
        {quotaErrorNotice && (
          <div className="bg-[#2a0e0e] border border-[#dc2626] text-rose-200 px-2 py-1.5 rounded text-[10px] mb-2 flex items-center justify-between">
            <span className="leading-tight">{quotaErrorNotice}</span>
            <button
              onClick={() => setQuotaErrorNotice(null)}
              className="ml-1 text-neutral-400 hover:text-white cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* History List */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {chats.length === 0 ? (
            <div className="text-xs text-neutral-600 p-2 italic">No chat history yet</div>
          ) : (
            chats.map((c) => (
              <div
                key={c.id}
                onClick={() => handleSelectChat(c.id)}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                  activeChatId === c.id ? 'bg-[#222] text-white' : 'text-neutral-400 hover:bg-[#151515] hover:text-white'
                }`}
              >
                <span className="truncate max-w-[170px]">{c.title || 'Untitled Chat'}</span>
                <div className="flex items-center gap-1.5 opacity-60 hover:opacity-100">
                  <span onClick={(e) => handleRenameChat(c.id, e)} title="Rename">
                    ✏️
                  </span>
                  <span onClick={(e) => handleTogglePin(c.id, e)} title={c.pinned ? 'Unpin' : 'Pin'}>
                    {c.pinned ? '📍' : '📌'}
                  </span>
                  <span onClick={(e) => handleDeleteChat(c.id, e)} title="Delete">
                    🗑️
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Bottom Controls */}
        <div className="border-t border-[#262626] pt-4 mt-auto flex flex-col gap-2.5">
          <button
            onClick={handleClearChatHistory}
            className="w-full bg-[#dc2626] hover:bg-red-700 text-white font-bold py-[10px] px-3 rounded-[6px] text-xs transition-colors cursor-pointer"
          >
            Clear Chat History
          </button>

          {currentUser && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-full bg-black border border-[#333] hover:border-neutral-500 text-white font-bold py-[10px] px-3 rounded-[6px] text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>⚙️</span>
              <span>Settings</span>
            </button>
          )}
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 relative flex flex-col items-center h-full overflow-hidden">
        {/* Top Controls (Left: Sidebar & New Chat) */}
        <div className="absolute top-4 left-4 flex gap-2 z-30">
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="w-10 h-10 bg-transparent text-white border border-[#333] rounded-[8px] flex items-center justify-center text-[20px] hover:border-neutral-500 cursor-pointer"
            title="Toggle History"
          >
            {sidebarOpen ? '✕' : '◴'}
          </button>
          <button
            onClick={handleStartNewChat}
            className="w-10 h-10 bg-transparent text-white border border-[#333] rounded-[8px] flex items-center justify-center text-[20px] hover:border-neutral-500 cursor-pointer"
            title="New Chat"
          >
            💬
          </button>
        </div>

        {/* Toast Notification */}
        {toastNotice && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 bg-[#161616] border border-emerald-500/80 text-emerald-400 px-4 py-2 rounded-xl text-xs font-mono shadow-2xl flex items-center gap-2">
            <span>✓</span> {toastNotice}
          </div>
        )}

        {/* Top-Right Controls */}
        {/* {Added Export active chat history button triggering plain text backup} [Commented by: Google AI Studio on October 16, 2026 at 10:55 PM] */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-30">
          {activeChat && (
            <button
              onClick={handleExportActiveChat}
              className="h-10 px-3 bg-[#111] border border-[#333] hover:border-[#39ff14] text-neutral-300 hover:text-white rounded-[8px] flex items-center gap-1.5 text-xs font-mono cursor-pointer transition-colors"
              title="Export active chat history as plain text (Ctrl+S)"
              aria-label="Export active chat history as plain text"
            >
              <span className="text-emerald-400 font-bold">↓</span>
              <span className="hidden sm:inline">Export (Ctrl+S)</span>
            </button>
          )}

          {!currentUser ? (
            <>
              <button
                onClick={() => setAuthModalMode('signin')}
                className="bg-black border border-[#333] hover:border-neutral-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthModalMode('signup')}
                className="bg-black border border-[#333] hover:border-neutral-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
              >
                Sign Up
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsIncognito((prev) => !prev)}
              className="w-10 h-10 bg-[#111] border border-[#333] hover:border-[#39ff14] rounded-[8px] flex items-center justify-center text-[20px] cursor-pointer transition-colors"
              title={isIncognito ? 'Incognito Mode Active (Click to switch to Normal)' : 'Normal Chat (Click for Incognito Mode)'}
            >
              {isIncognito ? '☀️' : '🕶️'}
            </button>
          )}
        </div>

        {/* Offline Warning */}
        {!isOnline && (
          <div className="absolute top-14 text-red-500 font-bold text-sm z-20">
            Offline 🛜
          </div>
        )}

        {/* Main Heading (Visible in zero state matching 19vh and 3.5rem) */}
        {!activeChat && (
          <h1 className="absolute top-[19vh] text-[3.5rem] font-bold font-serif text-white tracking-tight pointer-events-none select-none">
            nanobot
          </h1>
        )}

        {/* Chat Messages Area */}
        <div
          ref={chatAreaRef}
          className={`w-full flex-1 overflow-y-auto px-4 md:px-12 pt-20 pb-44 flex flex-col gap-6 ${
            !activeChat ? 'hidden' : 'flex'
          }`}
        >
          {activeChat?.messages.map((m, idx) => {
            const isUser = m.role === 'user';
            const textContent =
              typeof m.content === 'string'
                ? m.content
                : Array.isArray(m.content)
                ? m.content.find((c) => c.type === 'text')?.text || ''
                : '';

            return (
              <div
                key={idx}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start w-full'}`}
              >
                {isUser ? (
                  <div className="bg-[#181818] border border-[#2a2a2a] px-4 py-3 rounded-2xl max-w-[85%] md:max-w-[75%] text-sm leading-relaxed break-words">
                    <div>{escapeHtml(textContent)}</div>
                    {m.displayAttachments && m.displayAttachments.length > 0 && (
                      <div className="mt-2 text-xs text-neutral-400 space-y-1.5 border-t border-neutral-700/60 pt-1.5">
                        {m.displayAttachments.map((att, aIdx) => (
                          <div key={aIdx} className="flex items-center gap-2 flex-wrap">
                            <span>{att.type === 'image' ? '🖼️ Image' : `📄 ${att.name}`}</span>
                            {/* {Clear UI distinction when raw file bytes reside only in original browser while preserved cloud output is loaded} [Commented by: Google AI Studio on October 15, 2026 at 9:22 AM] */}
                            {att.isLocalMissing ? (
                              <span
                                className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded font-mono"
                                title="Original file bytes stored in local browser only. Preserved AI output loaded from cloud."
                              >
                                (Local file unavailable on this device • Cloud output active)
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full text-neutral-200 text-sm leading-relaxed">
                    {/* Reasoning Accordion if present */}
                    {m.reasoning && (
                      <div className="mb-3 border-l-2 border-[#333] pl-3 py-1">
                        <button
                          type="button"
                          onClick={() => setReasoningExpanded((prev) => !prev)}
                          className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1.5 cursor-pointer font-mono"
                        >
                          <span>Thinking...</span>
                          <span>{reasoningExpanded ? '▲' : '▼'}</span>
                        </button>
                        {reasoningExpanded && (
                          <div className="mt-2 p-3 bg-[#0d0d0d] rounded-lg text-xs font-mono text-neutral-400 whitespace-pre-wrap leading-relaxed">
                            {m.reasoning}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Markdown Body */}
                    <div
                      className="prose prose-invert max-w-none break-words"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(textContent) }}
                    />

                    {/* Action buttons (Copy, Sources) */}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(textContent);
                          alert('Copied to clipboard!');
                        }}
                        className="bg-[#1e1e1e] hover:bg-[#2e2e2e] text-neutral-300 px-3 py-1 rounded text-xs transition-colors cursor-pointer"
                      >
                        Copy
                      </button>

                      {m.sources && m.sources.length > 0 && (
                        <button
                          onClick={() =>
                            setShowSourcesPopup((prev) => (prev === idx ? null : idx))
                          }
                          className="bg-[#1e1e1e] hover:bg-[#2e2e2e] text-neutral-300 px-3 py-1 rounded text-xs transition-colors cursor-pointer"
                        >
                          Sources ({m.sources.length})
                        </button>
                      )}
                    </div>

                    {/* Sources Popup */}
                    {showSourcesPopup === idx && m.sources && m.sources.length > 0 && (
                      <div className="mt-3 p-4 bg-[#0d0d0d] border border-[#2b2b2b] rounded-xl text-xs space-y-1.5 max-w-xl">
                        <div className="font-semibold text-neutral-300 mb-2">Sources:</div>
                        {m.sources.map((s, sIdx) => (
                          <div key={sIdx} className="truncate">
                            <span className="text-neutral-500">[{sIdx + 1}] </span>
                            <a
                              href={safeUrl(s.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              {s.title || s.url}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Active Generation Stream / Status Bubble */}
          {isGenerating && (
            <div className="w-full text-neutral-200 text-sm leading-relaxed">
              {currentStatus && (
                <div className="text-xs text-neutral-400 italic mb-2 status-pulse">
                  {currentStatus}
                </div>
              )}

              {currentReasoning && (
                <div className="mb-3 border-l-2 border-[#333] pl-3 py-1">
                  <button
                    type="button"
                    onClick={() => setReasoningExpanded((prev) => !prev)}
                    className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1.5 cursor-pointer font-mono"
                  >
                    <span>Thinking...</span>
                    <span>{reasoningExpanded ? '▲' : '▼'}</span>
                  </button>
                  {reasoningExpanded && (
                    <div className="mt-2 p-3 bg-[#0d0d0d] rounded-lg text-xs font-mono text-neutral-400 whitespace-pre-wrap leading-relaxed">
                      {currentReasoning}
                    </div>
                  )}
                </div>
              )}

              {streamDisplayContent && (
                <div
                  className="prose prose-invert max-w-none break-words"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(streamDisplayContent) }}
                />
              )}
            </div>
          )}
        </div>

        {/* Composer Wrap */}
        {/* {Restored UI scale: composer container 750px at top 30vh / bottom 45px, 20px radius, 15px padding, 36px send button} [Commented by: Google AI Studio on 10/14/2026 10:35 AM] */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-full max-w-[750px] px-4 transition-all duration-300 z-20 ${
            activeChat ? 'bottom-[45px]' : 'top-[30vh]'
          }`}
        >
          {/* {Storage quota and sync status notices} [Commented by: Google AI Studio on October 15, 2026 at 09:57 AM] */}
          {quotaErrorNotice && (
            <div className="mb-2 px-3 py-1.5 rounded-lg bg-amber-950/80 border border-amber-600/60 text-amber-200 text-xs flex items-center justify-between shadow-lg">
              <span>⚠️ {quotaErrorNotice}</span>
              <button
                type="button"
                onClick={() => setQuotaErrorNotice(null)}
                className="text-amber-400 hover:text-white ml-2 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          )}
          {historyNotice && (
            <div className="mb-2 px-3 py-1.5 rounded-lg bg-blue-950/70 border border-blue-700/60 text-blue-200 text-xs flex items-center justify-between shadow-lg">
              <span>ℹ️ {historyNotice}</span>
              <button
                type="button"
                onClick={() => setHistoryNotice(null)}
                className="text-blue-400 hover:text-white ml-2 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          )}
          <div className="w-full bg-[#111] border border-[#333] rounded-[20px] p-[15px] flex flex-col gap-2.5 neon-glow">
            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto py-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="relative group shrink-0 bg-[#1c1c1c] border border-[#333] rounded-xl px-3 py-2 flex items-center gap-2 text-xs"
                  >
                    {att.isImage ? (
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="w-8 h-8 rounded object-cover"
                      />
                    ) : (
                      <span>📄</span>
                    )}
                    <span className="truncate max-w-[120px] text-neutral-300">
                      {att.name}
                    </span>
                    <button
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="text-red-400 hover:text-red-300 font-bold ml-1 text-sm cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input Box */}
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleTextareaInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Anything..."
              rows={1}
              className="w-full bg-transparent border-none text-white resize-none outline-none text-[16px] leading-[1.5] placeholder-neutral-500 min-h-[52px] max-h-[160px]"
            />

            {/* Bottom Controls */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-neutral-400 hover:text-white p-1 text-[1.2rem] cursor-pointer transition-colors"
                  title="Upload Image, PDF, Code, or any Data File"
                >
                  ➕
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSend}
                  className={`w-[36px] h-[36px] rounded-full flex items-center justify-center font-bold text-[18px] transition-colors cursor-pointer ${
                    isGenerating
                      ? 'bg-red-600 hover:bg-red-700 text-white font-mono text-sm'
                      : 'bg-[#000080] hover:bg-[#000066] text-white'
                  }`}
                  title={isGenerating ? 'Stop Generation' : 'Send'}
                >
                  {isGenerating ? (
                    <span>{STOP_FRAMES[stopFrameIndex]}</span>
                  ) : (
                    <span>?</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* AUTH MODAL */}
      {/* {Removed email login concept completely: Sign Up directly opens for username, password, and API keys} [Commented by: Google AI Studio on October 16, 2026 at 10:55 PM] */}
      {authModalMode && (
        <AuthModal
          mode={authModalMode}
          isOpen={true}
          onClose={() => setAuthModalMode(null)}
          onSwitchMode={(mode) => setAuthModalMode(mode)}
          onSuccess={(user, secret) => {
            setCurrentUser(user);
            setPasswordSecret(secret);
          }}
        />
      )}

      {/* SETTINGS MODAL */}
      {currentUser && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          user={currentUser}
          currentPasswordSecret={passwordSecret}
          onUpdateUser={(updated, newSecret) => {
            setCurrentUser(updated);
            if (newSecret) setPasswordSecret(newSecret);
          }}
          onDeleteAccount={() => {
            setCurrentUser(null);
            setPasswordSecret('');
            handleStartNewChat();
          }}
        />
      )}
    </div>
  );
}
