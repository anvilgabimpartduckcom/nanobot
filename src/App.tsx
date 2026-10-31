// Created unified nanobot App with Supabase auth, settings, incognito mode, deep research, and smooth streaming [Commented by: Google AI Studio on 12/10/2026 10:58 AM]

import React, { useState, useEffect, useRef } from 'react';
import { AuthModal } from './components/AuthModal';
// Imported SettingsModal and AppTheme type for Neon Black and Minimalist Light themes [Commented by: Google AI Studio on 20/10/2026 11:30 AM]
import { SettingsModal, AppTheme } from './components/SettingsModal';
import { AboutModal } from './components/AboutModal';
// Imported Supabase persistence: profiles and AI file code outputs saved to Supabase; user chats saved exclusively to Cloudflare; cascading 30-day purge support [Commented by: Google AI Studio on 19/10/2026 11:19 AM]
import {
  UserProfile,
  isSupabaseConfigured,
  supabase,
  FileCodeOutput,
  saveFileCodeOutputToSupabase,
  fetchFileCodeOutputsFromSupabase,
  deleteFileCodeOutputsFromSupabase,
  purgeExpiredFileCodeOutputs,
  removeEncryptedChatRecord
} from './lib/supabase';
import { deriveKeyFromPassword, encryptData, decryptData, encryptText, decryptText } from './lib/crypto';
import { analyzeFileWithScript, ProcessedFile } from './lib/fileReader';
import { performDynamicSearch, runDeepResearch, extractUrlsWithTavily } from './lib/tavily';
import { uploadArchiveToR2, fetchArchiveFromR2, deleteArchiveFromR2 } from './lib/r2';
import { markdownToHtml, escapeHtml, safeUrl } from './lib/markdown';
// Imported MCP_PLUGINS to equip the AI model with real tools from connected servers [Commented by: Google AI Studio on 13/10/2026 10:53 AM]
import { MCP_PLUGINS } from './lib/plugins';
// Imported Cloudflare Worker API client for authenticated chat persistence [Commented by: Google AI Studio on 14/10/2026 10:55 AM]
import { workerClient, WorkerMessage, WorkerFileOutput } from './lib/workerClient';
// Imported IndexedDB storage manager for client-only original user files and orphaned cleanup [Commented by: Google AI Studio on 15/10/2026 09:22 AM]
import {
  saveOriginalFile,
  getOriginalFile,
  getOriginalFilesForChat,
  deleteOriginalFilesForChat,
  clearAllOriginalFiles,
  cleanupOrphanedFiles
} from './lib/indexedDb';

// Imported PDF export utility replacing legacy text exports [Commented by: Google AI Studio on 30/10/2026 11:00 AM]
import { exportNoodleAsPdf } from './lib/pdfExport';

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
  shareId?: string; // Stored Cloudflare D1 share snapshot ID to update snapshot under identical URL [Commented by: Google AI Studio on 28/10/2026 11:38 AM]
}

const STOP_FRAMES = ['|', '/', '-', '\\'];
const INPUT_MIN_HEIGHT = 52;
// Removed max_tokens output parameter and set input context window ceiling to 1,000,000 tokens [Commented by: Google AI Studio on 29/10/2026 09:20 AM]
const MAX_INPUT_TOKENS = 1_000_000;

// Interprets OpenRouter HTTP errors and response payloads into friendly, plain-English messages [Commented by: Google AI Studio on 30/10/2026 11:00 AM]
function interpretOpenRouterError(status: number, rawBodyText: string): string {
  try {
    const parsed = JSON.parse(rawBodyText);
    const msg = parsed?.error?.message || parsed?.message || '';
    if (status === 400) {
      if (msg.toLowerCase().includes('data_collection') || msg.toLowerCase().includes('provider')) {
        return 'OpenRouter Request Notice: The model training preference was adjusted because the provider endpoint requires standard routing.';
      }
      if (msg.toLowerCase().includes('reasoning')) {
        return 'OpenRouter Request Notice: The reasoning parameter format is being normalized for this provider.';
      }
      if (msg) return `Request Error (400): ${msg}`;
      return 'Request Error (400): OpenRouter received an unsupported parameter. Please check your configuration.';
    }
    if (status === 401 || status === 403) {
      return 'Authentication Error: Your OpenRouter API key is missing, invalid, or expired. Please check your key in Settings > Account.';
    }
    if (status === 402) {
      return 'Credits Exhausted: Your OpenRouter account has insufficient credits.';
    }
    if (status === 429) {
      return 'Rate Limit: OpenRouter is receiving too many requests right now. Please wait a moment and try again.';
    }
    if (status >= 500) {
      return 'OpenRouter Server Error: The upstream AI service is temporarily unavailable. Please try again shortly.';
    }
    if (msg) return msg;
  } catch {}
  if (status === 400) {
    return 'Request Error (400): OpenRouter could not process this request. Please verify your prompt and model parameters.';
  }
  return `OpenRouter returned an error (HTTP ${status}). Please check your connection and API key.`;
}

// Visual search query highlighter for sidebar noodle titles [Commented by: Google AI Studio on 29/10/2026 04:00 PM]
function highlightSearchMatch(title: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return title;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = title.split(regex);
  if (parts.length <= 1) return title;
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-emerald-500/40 text-emerald-300 font-bold rounded-xs px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export default function App() {
  // Session & Auth State
  // Removed top notification toastNotice state entirely per user request [Commented by: Google AI Studio on 30/10/2026 11:00 AM]
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [passwordSecret, setPasswordSecret] = useState<string>('');
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isIncognito, setIsIncognito] = useState(false);

  // States for top-right three-dot menus and URL modal [Commented by: Google AI Studio on 28/10/2026 11:38 AM]
  const [isNewNoodleMenuOpen, setIsNewNoodleMenuOpen] = useState(false);
  const [isRunningNoodleMenuOpen, setIsRunningNoodleMenuOpen] = useState(false);
  const [isProvideUrlModalOpen, setIsProvideUrlModalOpen] = useState(false);
  const [provideUrlInput, setProvideUrlInput] = useState('');
  const [isImportingUrl, setIsImportingUrl] = useState(false);

  // User message hover & inline editing state [Commented by: Google AI Studio on 28/10/2026 11:38 AM]
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [hoveredUserMessageIndex, setHoveredUserMessageIndex] = useState<number | null>(null);

  // Initialized Theme state with persistent storage and DOM synchronization for Neon Black and Minimalist Light [Commented by: Google AI Studio on 20/10/2026 11:30 AM]
  const [theme, setTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem('nanobot_theme') as AppTheme) || 'Neon Black';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'Minimalist Light' ? 'light' : 'dark');
    if (theme === 'Minimalist Light') {
      document.documentElement.classList.add('theme-light');
      document.documentElement.classList.remove('theme-dark');
    } else {
      document.documentElement.classList.add('theme-dark');
      document.documentElement.classList.remove('theme-light');
    }
    localStorage.setItem('nanobot_theme', theme);
  }, [theme]);

  // Chat State
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Added history search query state for filtering chat sessions by title [Commented by: Google AI Studio on 17/10/2026 02:45 AM]
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<ProcessedFile[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [currentReasoning, setCurrentReasoning] = useState<string>('');
  // Inline reasoning accordion lifecycle: Thinking ▼ while thinking, auto-closes to Thinking ▲ when answer streams [Commented by: Google AI Studio on 30/10/2026 11:00 AM]
  const [, setIsThinking] = useState<boolean>(false);
  const [reasoningAccordionOpen, setReasoningAccordionOpen] = useState<boolean>(false);
  const [expandedReasoningIndices, setExpandedReasoningIndices] = useState<Record<number, boolean>>({});
  const [activeSources, setActiveSources] = useState<Array<{ title: string; url: string }>>([]);
  const [showSourcesPopup, setShowSourcesPopup] = useState<number | null>(null);
  // Added Cloudflare Worker history sync and non-intrusive status notice state [Commented by: Google AI Studio on 14/10/2026 10:55 AM]
  const [isHistorySyncing, setIsHistorySyncing] = useState<boolean>(false);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  // Added state for cloud-persisted AI file outputs and local storage quota warnings [Commented by: Google AI Studio on 15/10/2026 09:22 AM]
  const [chatFileOutputs, setChatFileOutputs] = useState<Record<string, WorkerFileOutput[]>>({});
  const [quotaErrorNotice, setQuotaErrorNotice] = useState<string | null>(null);

  // Auto-scroll state: track whether user scrolled up during stream and whether down-arrow snapping is active [Commented by: Google AI Studio on 22/10/2026 04:51 AM]
  const [isUserScrolledUp, setIsUserScrolledUp] = useState<boolean>(false);
  const [isAutoScrollActive, setIsAutoScrollActive] = useState<boolean>(false);

  // Shared chat state for public URL loading, read-only viewing, and seamless forking into user history [Commented by: Google AI Studio on 22/10/2026 04:51 AM]
  const [sharedChatView, setSharedChatView] = useState<{
    id: string;
    title: string;
    messages: ChatMessage[];
    created_at: string;
    expires_at: string;
  } | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  // Quick preview state for sidebar chat item hover preview without selection [Commented by: Google AI Studio on 23/10/2026 12:38 AM]
  const [quickPreview, setQuickPreview] = useState<{
    chatId: string;
    title: string;
    x: number;
    y: number;
    messages: ChatMessage[];
    isLoading: boolean;
  } | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const previewCacheRef = useRef<Record<string, ChatMessage[]>>({});

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

  // Saved chats and reasoning locally with encryption; no 30-day auto-purge for local storage [Commented by: Google AI Studio on 28/10/2026 11:42 AM]
  const saveLocalEncryptedChats = async (allChats: ChatSession[], key?: CryptoKey | null, user?: UserProfile | null) => {
    if (isIncognito) return; // Incognito chats are strictly never persisted to history or storage
    const targetUser = user !== undefined ? user : currentUser;
    const targetKey = key !== undefined ? key : cryptoKey;
    if (targetUser && targetKey) {
      try {
        const payload = JSON.stringify(allChats);
        const encrypted = await encryptText(payload, targetKey, targetUser.salt || 'salt');
        localStorage.setItem(`nanobot_encrypted_chats_${targetUser.id}`, encrypted);
      } catch (err) {
        console.warn('Encrypted local storage write notice:', err);
      }
    } else {
      try {
        localStorage.setItem('nanobot_chats', JSON.stringify(allChats));
      } catch (e) {
        console.error('Local storage write error:', e);
      }
    }
  };

  const loadLocalEncryptedChats = async (key: CryptoKey, user: UserProfile) => {
    try {
      const rawEncrypted = localStorage.getItem(`nanobot_encrypted_chats_${user.id}`);
      if (rawEncrypted) {
        const decrypted = await decryptText(rawEncrypted, key);
        const parsed = JSON.parse(decrypted);
        if (Array.isArray(parsed)) {
          setChats(parsed);
          return;
        }
      }
      // Migration from unencrypted local cache if available
      const legacy = localStorage.getItem('nanobot_chats');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChats(parsed);
          // Encrypt into user's private encrypted store
          saveLocalEncryptedChats(parsed, key, user);
          return;
        }
      }
      setChats([]);
    } catch (err) {
      console.warn('Failed to decrypt local encrypted chats:', err);
      setChats([]);
    }
  };

  // Derive CryptoKey and load encrypted local storage when user logs in with password
  useEffect(() => {
    // Loaded encrypted local chats; Cloudflare D1 is reserved strictly for shared chats [Commented by: Google AI Studio on 28/10/2026 11:42 AM]
    if (currentUser && passwordSecret) {
      deriveKeyFromPassword(passwordSecret, currentUser.salt || 'default_nanobot_salt')
        .then((key) => {
          setCryptoKey(key);
          loadLocalEncryptedChats(key, currentUser);
        })
        .catch((err) => {
          console.error('Error deriving encryption key:', err);
          try {
            const stored = JSON.parse(localStorage.getItem('nanobot_chats') || '[]');
            setChats(Array.isArray(stored) ? stored : []);
          } catch {
            setChats([]);
          }
        });
    } else if (currentUser) {
      try {
        const stored = JSON.parse(localStorage.getItem('nanobot_chats') || '[]');
        setChats(Array.isArray(stored) ? stored : []);
      } catch {
        setChats([]);
      }
    } else {
      setCryptoKey(null);
      // Locally stored chats retain permanently without 30-day auto-purge
      try {
        const stored = JSON.parse(localStorage.getItem('nanobot_chats') || '[]');
        setChats(Array.isArray(stored) ? stored : []);
      } catch {
        setChats([]);
      }
    }
  }, [currentUser, passwordSecret]);

  // Export currently active noodle history as a beautifully formatted PDF document using jsPDF [Commented by: Google AI Studio on 30/10/2026 11:00 AM]
  const handleExportActiveChat = () => {
    const targetChat = chats.find((c) => c.id === activeChatId) || (activeChatId ? null : chats[0]);
    if (!targetChat || targetChat.messages.length === 0) return;
    exportNoodleAsPdf(targetChat);
  };

  // Create a public share URL for the active noodle with 30-day retention, updating snapshot under same URL [Commented by: Google AI Studio on 28/10/2026 11:45 AM]
  const handleShareActiveChat = async () => {
    if (isIncognito || !currentUser) return;

    const targetChat = chats.find((c) => c.id === activeChatId) || (activeChatId ? null : chats[0]);
    if (!targetChat || targetChat.messages.length === 0) return;

    setIsSharing(true);
    try {
      // Strip any bulky local file bytes; keep extracted text, scripts, sources, and reasoning
      const cleanMessages = targetChat.messages.map((m) => {
        if (Array.isArray(m.content)) {
          const textParts = m.content
            .filter((c) => c.type === 'text')
            .map((c) => c.text || '')
            .join('\n');
          return {
            role: m.role,
            content: textParts || '[Shared Content]',
            sources: m.sources,
            reasoning: m.reasoning,
            displayAttachments: m.displayAttachments?.map((a) => ({ type: a.type, name: a.name })),
          };
        }
        return {
          role: m.role,
          content: m.content,
          sources: m.sources,
          reasoning: m.reasoning,
          displayAttachments: m.displayAttachments?.map((a) => ({ type: a.type, name: a.name })),
        };
      });

      // Pass existing targetChat.shareId so re-sharing by the same user updates the snapshot under identical URL [Commented by: Google AI Studio on 28/10/2026 11:45 AM]
      const res = await workerClient.createShare(targetChat.title, cleanMessages as WorkerMessage[], targetChat.shareId);
      if (res.success && res.data?.shareId) {
        targetChat.shareId = res.data.shareId;
        persistChat(targetChat);
        const shareUrl = `${window.location.origin}/?share=${res.data.shareId}`;
        await navigator.clipboard.writeText(shareUrl).catch(() => {});
      } else {
        throw new Error(res.error || 'Failed to generate share URL');
      }
    } catch (err: unknown) {
      console.warn('Share noodle notice:', err);
    } finally {
      setIsSharing(false);
    }
  };

  // Import shared noodle via URL for signed-in and signed-out users [Commented by: Google AI Studio on 28/10/2026 11:45 AM]
  const handleImportFromUrl = async (urlStr: string) => {
    const raw = urlStr.trim();
    if (!raw) return;
    setIsImportingUrl(true);
    try {
      let shareId = raw;
      if (raw.includes('share=')) {
        const match = raw.match(/[?&]share=([^&#]+)/);
        if (match) shareId = decodeURIComponent(match[1]);
      } else if (raw.includes('/')) {
        const parts = raw.split('/');
        shareId = parts[parts.length - 1];
      }
      const res = await workerClient.getPublicShare(shareId);
      if (res.success && res.share) {
        if (currentUser) {
          // Import into current account and save to encrypted local storage
          const importedNoodle: ChatSession = {
            id: Date.now().toString(),
            title: res.share.title || 'Imported Noodle',
            messages: (res.share.messages || []) as ChatMessage[],
            pinned: false,
            updated: Date.now(),
            shareId: res.share.id,
          };
          const nextChats = [importedNoodle, ...chats];
          setChats(nextChats);
          setActiveChatId(importedNoodle.id);
          saveLocalEncryptedChats(nextChats, cryptoKey, currentUser);
          setSharedChatView(null);
          setIsProvideUrlModalOpen(false);
          setProvideUrlInput('');
        } else {
          // Signed out: load view-only shared chat
          setSharedChatView({
            id: res.share.id,
            title: res.share.title,
            messages: res.share.messages as ChatMessage[],
            created_at: res.share.created_at,
            expires_at: res.share.expires_at,
          });
          setIsProvideUrlModalOpen(false);
          setProvideUrlInput('');
        }
      } else {
        alert(res.error || 'Failed to load shared noodle. URL may be invalid or expired.');
      }
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Error loading shared noodle: ${e.message}`);
    } finally {
      setIsImportingUrl(false);
    }
  };

  // Detect public share parameter in URL on page load, load view-only snapshot, and set anti-scraping robots headers [Commented by: Google AI Studio on 22/10/2026 04:51 AM]
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    if (shareId) {
      // Anti-scraping meta tag: prevents web scrapers from discovering or indexing shared chats
      let robotsMeta = document.querySelector('meta[name="robots"]');
      if (robotsMeta) {
        robotsMeta.setAttribute('content', 'noindex, nofollow, noarchive');
      }

      workerClient.getPublicShare(shareId).then((res) => {
        if (res.success && res.share) {
          setSharedChatView({
            id: res.share.id,
            title: res.share.title,
            messages: res.share.messages as ChatMessage[],
            created_at: res.share.created_at,
            expires_at: res.share.expires_at,
          });
        }
      }).catch((err) => {
        console.warn('Failed to load shared chat:', err);
      });
    }
  }, []);

  // Fork shared chat into user's personal chat history as an independent separate chat session [Commented by: Google AI Studio on 22/10/2026 04:51 AM]
  const handleContinueSharedChat = () => {
    if (!sharedChatView) return;

    if (!currentUser) {
      setAuthModalMode('signin');
      return;
    }

    const forkedChat: ChatSession = {
      id: Date.now().toString(),
      title: sharedChatView.title,
      messages: JSON.parse(JSON.stringify(sharedChatView.messages)),
      pinned: false,
      updated: Date.now(),
    };

    setChats((prev) => [forkedChat, ...prev]);
    setActiveChatId(forkedChat.id);
    persistChat(forkedChat);

    // Clear shared view and remove share URL parameter without reloading
    setSharedChatView(null);
    const newUrl = window.location.pathname;
    window.history.replaceState({}, '', newUrl);

    // Restore standard indexing meta tag
    const robotsMeta = document.querySelector('meta[name="robots"]');
    if (robotsMeta) {
      robotsMeta.setAttribute('content', 'index, follow');
    }
  };

  // Global keyboard listener for Ctrl+S or Cmd+S to export active chat history [Commented by: Google AI Studio on 16/10/2026 10:55 PM]
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

  // Persist and synchronize conversation history with Cloudflare Worker D1 backend using Supabase Bearer token, with zero-knowledge title decryption [Commented by: Google AI Studio on 16/10/2026 10:55 PM]
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

          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
          const now = Date.now();
          // Auto-purge conversations, files, code outputs, and text messages older than 30 days [Commented by: Google AI Studio on 19/10/2026 11:19 AM]
          purgeExpiredFileCodeOutputs(currentUser.id).catch(() => {});

          setChats((prev) => {
            const map = new Map<string, ChatSession>();
            prev.forEach((c) => {
              if (now - (c.updated || 0) < thirtyDaysMs) {
                map.set(c.id, c);
              } else {
                deleteOriginalFilesForChat(c.id).catch(() => {});
                deleteArchiveFromR2(c.id);
                localStorage.removeItem('nanobot_files_' + c.id);
                workerClient.deleteConversation(c.id).catch(() => {});
                deleteFileCodeOutputsFromSupabase(currentUser.id, c.id).catch(() => {});
                removeEncryptedChatRecord(c.id);
              }
            });
            decryptedConvs.forEach((wc) => {
              const updatedTime = wc.updated_at ? new Date(wc.updated_at).getTime() : now;
              if (now - updatedTime < thirtyDaysMs) {
                const existing = map.get(wc.id);
                map.set(wc.id, {
                  id: wc.id,
                  title: wc.title,
                  pinned: Boolean(wc.pinned),
                  messages: existing?.messages || [],
                  updated: updatedTime,
                });
              } else {
                deleteOriginalFilesForChat(wc.id).catch(() => {});
                deleteArchiveFromR2(wc.id);
                localStorage.removeItem('nanobot_files_' + wc.id);
                workerClient.deleteConversation(wc.id).catch(() => {});
                deleteFileCodeOutputsFromSupabase(currentUser.id, wc.id).catch(() => {});
                removeEncryptedChatRecord(wc.id);
              }
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

  // Load message history and AI file outputs from Cloudflare Worker with zero-knowledge decryption, verifying local file presence in IndexedDB [Commented by: Google AI Studio on 16/10/2026 10:55 PM]
  const handleSelectChat = async (id: string) => {
    setActiveChatId(id);
    setSidebarOpen(false);

    // Check local file availability in IndexedDB for this conversation
    const localFiles = await getOriginalFilesForChat(id);
    const localFileIds = new Set(localFiles.map((f) => f.fileId));

    if (currentUser) {
      // Fetch persisted AI file code outputs strictly from Supabase public.file_code_outputs table [Commented by: Google AI Studio on 19/10/2026 11:02 AM]
      try {
        const supabaseOutputs = await fetchFileCodeOutputsFromSupabase(currentUser.id, id);
        if (supabaseOutputs && supabaseOutputs.length > 0) {
          const decryptedOutputs = await Promise.all(
            supabaseOutputs.map(async (o) => {
              let content = o.extracted_output;
              if (cryptoKey && content && content.startsWith('enc:')) {
                content = await decryptText(content, cryptoKey);
              }
              return {
                id: o.id || o.source_file_id,
                conversation_id: o.conversation_id,
                user_id: o.user_id,
                source_file_id: o.source_file_id,
                file_name: o.file_name,
                file_type: o.file_type,
                output_type: o.output_type,
                output_content: content + (o.reader_code ? `\n\n[Python Reader Script]:\n${o.reader_code}` : ''),
                created_at: o.created_at || new Date().toISOString()
              };
            })
          );
          setChatFileOutputs((prev) => ({ ...prev, [id]: decryptedOutputs }));
        } else {
          // Fallback check to Cloudflare Worker D1 if previously saved
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
        }
      } catch (err) {
        console.warn('File code outputs fetch notice:', err);
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

  // Persist noodle strictly to browser encrypted local storage; Cloudflare D1 is used only for shared noodles [Commented by: Google AI Studio on 28/10/2026 11:47 AM]
  const persistChat = async (chat: ChatSession) => {
    if (isIncognito) return; // Do not save incognito noodles

    setChats((prev) => {
      const exists = prev.some((c) => c.id === chat.id);
      const updatedList = exists ? prev.map((c) => (c.id === chat.id ? chat : c)) : [chat, ...prev];
      saveLocalEncryptedChats(updatedList, cryptoKey, currentUser);
      return updatedList;
    });
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  };

  // Detects manual upward scroll during active AI response stream [Commented by: Google AI Studio on 22/10/2026 04:51 AM]
  const handleChatScroll = () => {
    if (!chatAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatAreaRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    if (distanceFromBottom > 50) {
      setIsUserScrolledUp(true);
      if (isGenerating) {
        setIsAutoScrollActive(false);
      }
    } else if (distanceFromBottom <= 20) {
      setIsUserScrolledUp(false);
    }
  };

  // Down arrow button click snaps chat to bottom and re-engages continuous auto-scroll [Commented by: Google AI Studio on 22/10/2026 04:51 AM]
  const handleScrollToBottomClick = () => {
    setIsAutoScrollActive(true);
    setIsUserScrolledUp(false);
    scrollToBottom();
  };

  // Auto-scroll snaps view to bottom when activated or on initial renders [Commented by: Google AI Studio on 22/10/2026 04:51 AM]
  useEffect(() => {
    if (isGenerating) {
      if (isAutoScrollActive) {
        scrollToBottom();
      }
    } else {
      scrollToBottom();
    }
  }, [chats, currentStatus, streamDisplayContent, isAutoScrollActive, isGenerating]);

  // Automated descriptive title generator parsing initial user message and AI response instead of slicing 30 chars [Commented by: Google AI Studio on 22/10/2026 04:51 AM]
  const generateChatSessionTitle = (userMessage: string, aiResponse: string): string => {
    try {
      let cleanPrompt = userMessage
        .replace(/\[Uploaded File:[\s\S]*?\]/gi, '')
        .replace(/\[Preserved AI Output[\s\S]*?\]/gi, '')
        .replace(/```[\s\S]*?```/g, '')
        .trim();

      cleanPrompt = cleanPrompt.replace(/^(can you (please )?|could you |help me (to )?|i want to |i need to |how (do|to|can) (i|we)|what is |tell me about |please |write (a|me)? )/i, '').trim();

      const firstLine = cleanPrompt.split(/[\n?.!]/)[0]?.trim() || '';
      const promptWords = firstLine.split(/\s+/).filter(Boolean);
      let candidate = '';
      if (promptWords.length >= 2 && promptWords.length <= 7) {
        candidate = promptWords.join(' ');
      } else if (promptWords.length > 7) {
        candidate = promptWords.slice(0, 6).join(' ');
      }

      if (!candidate || candidate.length < 5 || /^(hello|hi|hey|test|question|help)$/i.test(candidate)) {
        const cleanAi = aiResponse.replace(/```[\s\S]*?```/g, '').replace(/\[Sources[\s\S]*?\]/g, '').trim();
        const aiWords = cleanAi.split(/[\n.!?]/)[0]?.trim().split(/\s+/).filter(Boolean) || [];
        if (aiWords.length >= 2) {
          candidate = aiWords.slice(0, 5).join(' ');
        }
      }

      if (!candidate) candidate = 'New Discussion';

      const titleCased = candidate
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
        .slice(0, 45)
        .trim();

      return titleCased || 'New Chat';
    } catch {
      return userMessage.slice(0, 30) || 'New Chat';
    }
  };

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
    setIsThinking(false);
    setReasoningAccordionOpen(false);
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

  // Send message (supports normal composer send as well as resending an edited user message) [Commented by: Google AI Studio on 28/10/2026 11:55 AM]
  const handleSend = async (editedPromptText?: string, editedMsgIndex?: number) => {
    if (isGenerating) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setIsGenerating(false);
      setIsThinking(false);
      setReasoningAccordionOpen(false);
      stopStreamSmoothing();
      return;
    }

    const isEditMode = editedMsgIndex !== undefined && typeof editedPromptText === 'string';
    const trimmedPrompt = (isEditMode ? editedPromptText : inputText).trim();
    if (!trimmedPrompt && attachments.length === 0) return;

    if (!isOnline) {
      alert('No Internet connection available.');
      return;
    }

    // Determined API keys strictly from authenticated user profile, removing obsolete global env fallbacks [Commented by: Google AI Studio on 18/10/2026 12:50 PM]
    const orKey = currentUser?.openrouter_key || '';
    const tvKey = currentUser?.tavily_key || '';

    if (!orKey && !trimmedPrompt.startsWith('#')) {
      alert('Please Sign In or configure your OpenRouter API Key in Account Settings.');
      return;
    }

    // Prepare User Message Content
    let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    const displayAttachments: Array<{ type: string; name: string; fileId?: string; isLocalMissing?: boolean }> = [];

    // Inject synthesized reader script template and extracted data preview into file context [Commented by: Google AI Studio on 19/10/2026 11:02 AM]
    let attachedFileContext = '';
    if (!isEditMode) {
      attachments.forEach((att) => {
        displayAttachments.push({
          type: att.isImage ? 'image' : 'file',
          name: att.name,
          fileId: att.fileId,
          isLocalMissing: false
        });
        if (!att.isImage) {
          attachedFileContext += `\n\n--- Uploaded File: ${att.name} (${att.type || 'document'}, ${att.size} bytes) ---\n`;
          if (att.generatedReaderCode) {
            attachedFileContext += `[Reader Script for ${att.name}]:\n\`\`\`python\n${att.generatedReaderCode}\n\`\`\`\n`;
          }
          if (att.contentSnippet) {
            attachedFileContext += `[Extracted File Contents / Data Preview]:\n${att.contentSnippet}\n`;
          }
        }
      });
    }

    const promptSummary = trimmedPrompt || (attachments.length > 0 ? attachments[0].name : 'New Noodle');

    // Create or locate noodle session
    let chat = activeChat;
    if (isEditMode && chat) {
      // Preserve history prior to edited message
      chat = {
        ...chat,
        messages: chat.messages.slice(0, editedMsgIndex)
      };
    } else if (!chat && sharedChatView) {
      chat = {
        id: Date.now().toString(),
        title: sharedChatView.title,
        messages: JSON.parse(JSON.stringify(sharedChatView.messages)),
        pinned: false,
        updated: Date.now()
      };
      setChats((prev) => [chat!, ...prev]);
      setActiveChatId(chat.id);
      setSharedChatView(null);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    } else if (!chat) {
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

    // Save raw files strictly to browser IndexedDB; persist code outputs strictly to Supabase [Commented by: Google AI Studio on 19/10/2026 11:02 AM]
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

      // Persist AI file code outputs strictly to Supabase public.file_code_outputs [Commented by: Google AI Studio on 19/10/2026 11:02 AM]
      if (currentUser && !att.isImage) {
        const outputPayload = att.contentSnippet;
        (async () => {
          let payloadToSave = outputPayload;
          if (cryptoKey) {
            try {
              payloadToSave = await encryptText(outputPayload, cryptoKey, currentUser.salt || 'salt');
            } catch (encErr) {
              console.warn('File output encryption notice:', encErr);
            }
          }
          saveFileCodeOutputToSupabase({
            user_id: currentUser.id,
            conversation_id: chat!.id,
            source_file_id: att.fileId,
            file_name: att.name,
            file_type: att.type,
            output_type: att.outputType,
            reader_code: att.generatedReaderCode || '',
            extracted_output: payloadToSave,
            metadata: { size: att.size, isImage: att.isImage }
          }).then((ok) => {
            if (ok) {
              setChatFileOutputs((prev) => ({
                ...prev,
                [chat!.id]: [
                  ...(prev[chat!.id] || []).filter((o) => o.source_file_id !== att.fileId),
                  {
                    id: `out_${att.fileId}`,
                    conversation_id: chat!.id,
                    user_id: currentUser.id,
                    source_file_id: att.fileId,
                    file_name: att.name,
                    file_type: att.type,
                    output_type: att.outputType,
                    output_content: outputPayload + (att.generatedReaderCode ? `\n\n[Python Reader Script]:\n${att.generatedReaderCode}` : ''),
                    created_at: new Date().toISOString()
                  }
                ]
              }));
            }
          }).catch((err) => {
            console.warn('saveFileCodeOutputToSupabase notice:', err);
          });
        })();
      }
    });

    // Inject preserved AI outputs when continuing conversation on a device where raw file is missing [Commented by: Google AI Studio on 15/10/2026 09:22 AM]
    const existingCloudOutputs = chatFileOutputs[chat.id] || [];
    let cloudOutputsContext = '';
    if (attachments.length === 0 && existingCloudOutputs.length > 0) {
      existingCloudOutputs.forEach((out) => {
        cloudOutputsContext += `\n\n[Preserved AI Output for file: "${out.file_name}"]:\n(Note: Original file bytes reside locally in the original user browser and are unavailable on this device. The model is using the cloud-preserved extraction output.)\n${out.output_content}\n`;
      });
    }

    const fullTextPrompt = trimmedPrompt + attachedFileContext + cloudOutputsContext;

    // Typed userContent multimodal parts array explicitly for TypeScript safety [Commented by: Google AI Studio on 12/10/2026 11:00 AM]
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

    // Reset composer input if not in inline edit mode
    if (!isEditMode) {
      setInputText('');
      setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = `${INPUT_MIN_HEIGHT}px`;
    }

    // Initialize Generation
    setIsGenerating(true);
    // Reset auto-scroll flags: auto-scroll activates when user clicks down arrow after scrolling up [Commented by: Google AI Studio on 22/10/2026 04:51 AM]
    setIsUserScrolledUp(false);
    setIsAutoScrollActive(false);
    setCurrentReasoning('');
    setIsThinking(false);
    setReasoningAccordionOpen(false);
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
        // Generate concise descriptive title for new chat session parsing first user message and AI response [Commented by: Google AI Studio on 22/10/2026 04:51 AM]
        if (chat.messages.length === 2) {
          const firstUserContent = typeof chat.messages[0].content === 'string'
            ? chat.messages[0].content
            : '';
          const descriptiveTitle = generateChatSessionTitle(firstUserContent, researchResult.content);
          chat.title = descriptiveTitle;
          setChats((prev) => prev.map((c) => (c.id === chat!.id ? { ...c, title: descriptiveTitle } : c)));
        }
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

    // Configured system prompt with real MCP server tool definitions, persona rules, and URL scraping capability [Commented by: Google AI Studio on 14/10/2026 10:35 AM]
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

    // Updated system identity to source available AI chat bot [Commented by: Google AI Studio on 29/10/2026 09:00 AM]
    const systemPrompt = `You are 'nanobot', a privacy first, source available AI chat bot. You can process text, images, and files seamlessly. Current Date/Time: ${getCurrentDateTime()}.
Follow these guidelines strictly:
1. Always use emojis for visual cues to make the conversation engaging.
2. Web Search Tool: Whenever you need latest info or facts you lack, output a search query exactly in this format: <Search> (Search Query) </Search>. The code will then use tavily to perform web search for that search query. If you need info from more than one search, or have multiple search queries, output all of them at once in this format: <Search1> (Search Query 1) </Search1> <Search2> (Search Query 2) </Search2> ... and so on. The code will then use tavily to perform web searches for those search queries. Keep queries concise.
CRITICAL: After all the search results return, you will no longer be provided with the search tool. You cannot perform anymore web searches.
3. Web Scraping Tool: After the search results return, if you need deeper info from any one URL, you must output a scrap query exactly in this format: <Scrap> (URL) </Scrap>. The code will then use tavily to scrap that URL. If you need info from more than one URL, output all of them at once in this format: <Scrap1> (URL 1) </Scrap1> <Scrap2> (URL 2) </Scrap2> ... and so on. The code will then use tavily to scrap those URLs.
CRITICAL: After all the scraped results return, you will no longer be provided with the scrap tool. You cannot perform anymore scraping.
4. When you receive search results or scraped webpage contents, analyze them carefully and provide a comprehensive final answer.
5. Always cite your sources using inline citations in the format [1], [2], corresponding to the provided search results. Do not list the sources at the end of your response.
6. If the user ever wants some help on personal stuff, you must reply as if you are an objective outsider on that matter.
7. File Reading Protocol: When a user provides, uploads, or refers to any file (documents, PDFs, spreadsheets, datasets, code, or arbitrary files except images), you must write and display the exact code (e.g. Python code using pandas, pypdf, openpyxl, docx, json, csv, or standard libraries) to read, inspect, and parse that file. Present this reader script in a dedicated code block starting with \`\`\`python. Then, explain the output of executing that code, present the extracted contents and data findings, and thoroughly answer the user's questions based on the file.
${toolsContext ? `8. Connected MCP Server Tools: You have direct access to ALL the tools provided by the following connected MCP servers:\n${toolsContext}\nWhen the user explicitly asks you to use a service or tool, execute the tool action and synthesize the results for them.` : ''}
${customInstructions ? `Custom User Instructions: ${customInstructions}` : ''}`;

    // Configured 1,000,000 input token context window for nvidia/nemotron-3.5-super-vl:free, strictly omitting model reasoning and raw code outputs [Commented by: Google AI Studio on 29/10/2026 09:20 AM]
    const apiMessages: Array<{ role: string; content: unknown }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Include full conversation history within the 1,000,000 token input context budget (~4,000,000 characters)
    const MAX_INPUT_CHARS = MAX_INPUT_TOKENS * 4;
    let accumulatedChars = systemPrompt.length;
    const historyToInclude: ChatMessage[] = [];

    for (let i = chat.messages.length - 1; i >= 0; i--) {
      const msg = chat.messages[i];
      const charLength = typeof msg.content === 'string'
        ? msg.content.length
        : JSON.stringify(msg.content).length;
      if (accumulatedChars + charLength > MAX_INPUT_CHARS) break;
      accumulatedChars += charLength;
      historyToInclude.unshift(msg);
    }

    historyToInclude.forEach((m) => {
      let cleanContent = m.content;
      if (typeof cleanContent === 'string') {
        cleanContent = cleanContent
          .replace(/\[Python Reader Script\]:[\s\S]*?```/gi, '')
          .replace(/\[Reader Script for .*?\]:[\s\S]*?```/gi, '')
          .replace(/\[Extracted File Contents \/ Data Preview\]:[\s\S]*?(?=\n\n|\n\[|$)/gi, '')
          .trim();
      }
      // Explicitly omit m.reasoning and raw code from API context
      apiMessages.push({ role: m.role === 'ai' ? 'assistant' : 'user', content: cleanContent });
    });

    let currentOutput = '';
    let reasoningText = '';
    const accumulatedSources: Array<{ title: string; url: string }> = [];
    let searchPerformed = false;
    let scrapPerformed = false;

    async function runGeneration(messagesArr: typeof apiMessages, depth = 0) {
      if (depth > 2) return;
      setCurrentStatus('Generating Answer...');

      // Determine model training opt-out parameter (incognito or user toggle OFF)
      const optOutTraining = isIncognito || currentUser?.model_training === false;

      // Configured reasoning and optional data_collection routing with plain-English error interpretation [Commented by: Google AI Studio on 30/10/2026 11:00 AM]
      const bodyPayload: Record<string, unknown> = {
        model: 'nvidia/nemotron-3.5-super-vl:free',
        temperature: 0.0,
        stream: true,
        reasoning: { effort: 'medium' },
        messages: messagesArr
      };

      if (optOutTraining) {
        bodyPayload.provider = { data_collection: 'deny' };
      }

      let res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'nanobot'
        },
        body: JSON.stringify(bodyPayload),
        signal
      });

      // If the provider restriction caused an HTTP 400, retry once cleanly without the provider block
      if (!res.ok && res.status === 400 && bodyPayload.provider) {
        delete bodyPayload.provider;
        res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${orKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'nanobot'
          },
          body: JSON.stringify(bodyPayload),
          signal
        });
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(interpretOpenRouterError(res.status, errText));
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
                // When model is thinking, display Thinking ▼ with reasoning unfolded beneath [Commented by: Google AI Studio on 30/10/2026 11:00 AM]
                setIsThinking(true);
                setReasoningAccordionOpen(true);
              }
            }

            const token = delta.content || '';
            if (token) {
              // When reasoning is completed and answer tokens arrive, auto-close accordion and revert to Thinking ▲ [Commented by: Google AI Studio on 30/10/2026 11:00 AM]
              setIsThinking(false);
              setReasoningAccordionOpen(false);
              currentOutput += token;
              targetContentRef.current = currentOutput;
            }
          } catch {
            // Ignore partial stream parse errors
          }
        }
      }

      // Processed Scraping and Search tags with exact regex and single-use tool lifecycle [Commented by: Google AI Studio on 19/10/2026 02:25 AM]
      // 1. Check for Scraping queries (<Scrap>URL</Scrap>, <Scrap1>URL1</Scrap1>, <Scrap2>URL2</Scrap2>...) if scraping has NOT been performed yet
      if (!scrapPerformed) {
        const scrapRegex = /<Scrap(\d*)>(.*?)<\/Scrap\1>/gi;
        const scrapMatches = [...currentOutput.matchAll(scrapRegex)]
          .map((m) => m[2].trim())
          .filter(Boolean);

        if (scrapMatches.length > 0) {
          scrapPerformed = true;
          setCurrentStatus(`Scraping ${scrapMatches.length} Web Page${scrapMatches.length > 1 ? 's' : ''}...`);
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
              {
                role: 'user',
                content: `Scraped Web Pages Content:\n${combinedScraps}\n\n[System Notice: The scrap tool is now closed; no further scraping or web searches can be performed. Please analyze the information and provide your comprehensive final answer citing your sources].`
              }
            ];

            currentOutput = '';
            targetContentRef.current = '';
            await runGeneration(nextMessages, depth + 1);
            return;
          } catch (scrapErr) {
            console.warn('Scraping execution error:', scrapErr);
          }
        }
      }

      // 2. Check for Search queries (<Search>Query</Search>, <Search1>Query1</Search1>, <Search2>Query2</Search2>...) if search has NOT been performed yet
      if (!searchPerformed) {
        const searchRegex = /<Search(\d*)>(.*?)<\/Search\1>/gi;
        const queries = [...currentOutput.matchAll(searchRegex)]
          .map((m) => m[2].trim())
          .filter(Boolean);

        if (queries.length > 0) {
          searchPerformed = true;
          searchTriggered = true;
          setCurrentStatus(`Searching Online for ${queries.length} quer${queries.length > 1 ? 'ies' : 'y'}...`);

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
            {
              role: 'user',
              content: `Search Results:\n${combinedText}\n\n[System Notice: The search tool is now closed and no further web searches can be performed. If you need deeper info from any one URL, output exactly in this format: <Scrap> (URL) </Scrap>. If you need info from more than one URL, output all of them at once in this format: <Scrap1> (URL 1) </Scrap1> <Scrap2> (URL 2) </Scrap2> ... After scraped results return, scraping will also be closed. Otherwise, provide your comprehensive final answer citing sources as [1], [2]].`
            }
          ];

          currentOutput = '';
          targetContentRef.current = '';
          await runGeneration(nextMessages, depth + 1);
          return;
        }
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
      // Generate concise descriptive title for new chat session parsing first user message and AI response [Commented by: Google AI Studio on 22/10/2026 04:51 AM]
      if (chat.messages.length === 2) {
        const firstUserContent = typeof chat.messages[0].content === 'string'
          ? chat.messages[0].content
          : Array.isArray(chat.messages[0].content)
          ? chat.messages[0].content.find((c) => c.type === 'text')?.text || ''
          : '';
        const descriptiveTitle = generateChatSessionTitle(firstUserContent, currentOutput);
        chat.title = descriptiveTitle;
        setChats((prev) => prev.map((c) => (c.id === chat!.id ? { ...c, title: descriptiveTitle } : c)));
      }
      persistChat(chat);

      // Persist AI-generated file reading code outputs directly to Supabase public.file_code_outputs [Commented by: Google AI Studio on 19/10/2026 11:02 AM]
      if (currentUser && chat) {
        const codeBlockMatch = currentOutput.match(/```(?:python|py)?([\s\S]*?)```/i);
        if (codeBlockMatch) {
          saveFileCodeOutputToSupabase({
            user_id: currentUser.id,
            conversation_id: chat.id,
            source_file_id: `ai_gen_${Date.now()}`,
            file_name: 'AI Generated Reader Script',
            file_type: 'text/x-python',
            output_type: 'code_execution',
            reader_code: codeBlockMatch[1].trim(),
            extracted_output: currentOutput.slice(0, 8000),
            metadata: { hasCode: true }
          }).catch(() => {});
        }
      }
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
      setIsThinking(false);
      setReasoningAccordionOpen(false);
    }
  };

  // User message inline edit resend handler [Commented by: Google AI Studio on 28/10/2026 11:58 AM]
  const handleResendEditedMessage = async (msgIndex: number, newText: string) => {
    setEditingMessageIndex(null);
    setEditText('');
    await handleSend(newText, msgIndex);
  };

  // Clear noodle history directly without iframe-blocked window.confirm and persist to local encrypted storage [Commented by: Google AI Studio on 30/10/2026 11:00 AM]
  const handleClearChatHistory = () => {
    const remaining = chats.filter((c) => Boolean(c.pinned));
    setChats(remaining);
    saveLocalEncryptedChats(remaining, cryptoKey, currentUser);
    try {
      localStorage.setItem('nanobot_chats', JSON.stringify(remaining));
    } catch {}

    // Synchronized noodle deletions to remote Supabase, Cloudflare Worker, and local IndexedDB file storage [Commented by: Google AI Studio on 29/10/2026 04:00 PM]
    chats.forEach((c) => {
      if (!c.pinned) {
        removeEncryptedChatRecord(c.id);
        deleteArchiveFromR2(c.id);
        localStorage.removeItem('nanobot_files_' + c.id);
        deleteOriginalFilesForChat(c.id).catch(() => {});
        if (currentUser) {
          workerClient.deleteConversation(c.id).catch(() => {});
          deleteFileCodeOutputsFromSupabase(currentUser.id, c.id).catch(() => {});
        }
      }
    });

    const wasActiveCleared = chats.some((c) => !c.pinned && c.id === activeChatId);
    if (wasActiveCleared || !activeChatId) {
      handleStartNewChat();
    }
  };

  // Toggle noodle pin with stable synchronous state update, pin sorting, and local encrypted persistence [Commented by: Google AI Studio on 30/10/2026 11:00 AM]
  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setChats((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, pinned: !Boolean(c.pinned) } : c));
      const sorted = [...updated].sort(
        (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || 0) - (a.updated || 0)
      );
      saveLocalEncryptedChats(sorted, cryptoKey, currentUser);
      try {
        localStorage.setItem('nanobot_chats', JSON.stringify(sorted));
      } catch {}
      const target = sorted.find((c) => c.id === id);
      if (currentUser && target) {
        workerClient.updateConversation(id, { pinned: target.pinned }).catch(() => {});
      }
      return sorted;
    });
  };

  // Delete chat
  // Completely purge all chat files, code outputs, text messages, and conversation records upon chat deletion [Commented by: Google AI Studio on 19/10/2026 11:19 AM]
  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteOriginalFilesForChat(id).catch(() => {});
    removeEncryptedChatRecord(id);
    deleteArchiveFromR2(id);
    localStorage.removeItem('nanobot_files_' + id);
    if (currentUser) {
      workerClient.deleteConversation(id).catch(() => {});
      deleteFileCodeOutputsFromSupabase(currentUser.id, id).catch(() => {});
    }
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) handleStartNewChat();
  };

  // Rename noodle
  // Synchronized conversation rename with Cloudflare Worker D1 backend [Commented by: Google AI Studio on 29/10/2026 04:00 PM]
  const handleRenameChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const chat = chats.find((c) => c.id === id);
    const nextTitle = prompt('Rename noodle:', chat?.title)?.trim();
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

  // Filter chat history sessions by title match exclusively for signed-in users [Commented by: Google AI Studio on 17/10/2026 02:47 AM]
  const filteredChats = currentUser && historySearchQuery.trim()
    ? chats.filter((c) => {
        const query = historySearchQuery.trim().toLowerCase();
        const title = (c.title || 'Untitled Chat').toLowerCase();
        return title.includes(query);
      })
    : chats;

  // Helper to extract clean preview text from ChatMessage content [Commented by: Google AI Studio on 23/10/2026 12:38 AM]
  const getMessageSnippet = (content: ChatMessage['content'], maxLength = 130): string => {
    let text = '';
    if (typeof content === 'string') {
      text = content;
    } else if (Array.isArray(content)) {
      text = content
        .map((part) => part.text || (part.image_url ? '[Image]' : ''))
        .filter(Boolean)
        .join(' ');
    }
    text = text
      .replace(/```[\s\S]*?```/g, '[Code]')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[#*_~>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > maxLength) {
      return text.slice(0, maxLength) + '...';
    }
    return text || '(Empty message)';
  };

  // Quick preview hover handler: shows first 2 messages without selecting chat [Commented by: Google AI Studio on 23/10/2026 12:38 AM]
  const handleChatTitleMouseEnter = (chat: ChatSession, e: React.MouseEvent<HTMLElement>) => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
    const target = e.currentTarget;
    previewTimerRef.current = window.setTimeout(async () => {
      const rect = target.getBoundingClientRect();
      const popupWidth = 320;
      const popupHeight = 220;

      let x = rect.right + 10;
      if (x + popupWidth > window.innerWidth) {
        x = Math.max(10, rect.left - popupWidth - 10);
      }
      let y = Math.max(12, rect.top - 8);
      if (y + popupHeight > window.innerHeight) {
        y = Math.max(12, window.innerHeight - popupHeight - 12);
      }

      if (chat.messages && chat.messages.length > 0) {
        setQuickPreview({
          chatId: chat.id,
          title: chat.title || 'Untitled Chat',
          x,
          y,
          messages: chat.messages.slice(0, 2),
          isLoading: false
        });
        return;
      }

      if (previewCacheRef.current[chat.id]) {
        setQuickPreview({
          chatId: chat.id,
          title: chat.title || 'Untitled Chat',
          x,
          y,
          messages: previewCacheRef.current[chat.id].slice(0, 2),
          isLoading: false
        });
        return;
      }

      if (currentUser) {
        setQuickPreview({
          chatId: chat.id,
          title: chat.title || 'Untitled Chat',
          x,
          y,
          messages: [],
          isLoading: true
        });

        try {
          const res = await workerClient.getMessages(chat.id);
          if (res.success && res.data?.messages) {
            const loadedMessages: ChatMessage[] = await Promise.all(
              res.data.messages.slice(0, 2).map(async (m) => {
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
                  reasoning: plainReasoning
                };
              })
            );
            previewCacheRef.current[chat.id] = loadedMessages;
            setQuickPreview((prev) =>
              prev && prev.chatId === chat.id
                ? { ...prev, messages: loadedMessages, isLoading: false }
                : prev
            );
          } else {
            setQuickPreview((prev) =>
              prev && prev.chatId === chat.id ? { ...prev, isLoading: false } : prev
            );
          }
        } catch {
          setQuickPreview((prev) =>
            prev && prev.chatId === chat.id ? { ...prev, isLoading: false } : prev
          );
        }
      } else {
        setQuickPreview({
          chatId: chat.id,
          title: chat.title || 'Untitled Chat',
          x,
          y,
          messages: [],
          isLoading: false
        });
      }
    }, 140);
  };

  const handleChatTitleMouseLeave = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setQuickPreview(null);
  };

  // Rendered container with dynamic theme classes for Neon Black and Minimalist Light [Commented by: Google AI Studio on 20/10/2026 11:32 AM]
  return (
    <div className={`flex h-screen w-screen relative overflow-hidden transition-colors duration-200 ${
      theme === 'Minimalist Light' ? 'bg-[#f8f9fa] text-neutral-900' : 'bg-black text-white'
    }`}>
      {/* SIDEBAR */}
      {/* Slide-over drawer animation for mobile history sidebar with smooth 300ms ease-in-out transition  [Commented by: Google AI Studio on 22/10/2026 04:51 AM] */}
      <aside
        className={`${
          sidebarOpen ? 'max-sm:translate-x-0 sm:flex sm:w-[300px]' : 'max-sm:-translate-x-full sm:hidden'
        } max-sm:fixed max-sm:inset-0 max-sm:w-screen max-sm:h-screen max-sm:z-40 max-sm:flex w-[300px] h-full flex-col p-[15px] z-40 shrink-0 transform transition-transform duration-300 ease-in-out transition-colors ${
          theme === 'Minimalist Light'
            ? 'bg-white max-sm:bg-white border-r border-[#e5e7eb] text-neutral-900 shadow-2xl sm:shadow-none'
            : 'bg-[#0a0a0a] max-sm:bg-[#0a0a0a] border-r border-[#262626] text-white shadow-2xl sm:shadow-none'
        }`}
      >
        {/* Sidebar header with right-padding on mobile to provide clearance for the top-right close button  [Commented by: Google AI Studio on 21/10/2026 05:45 AM] */}
        <div className={`flex items-center pb-3 border-b mb-3 ${
          theme === 'Minimalist Light' ? 'border-[#e5e7eb]' : 'border-[#262626]'
        }`}>
          {/* Rebranded History to Noodle History [Commented by: Google AI Studio on 28/10/2026 12:12 PM] */}
          <h3 className={`font-semibold text-base tracking-wide ${sidebarOpen ? 'max-sm:pr-12' : ''} ${
            theme === 'Minimalist Light' ? 'text-neutral-800' : 'text-neutral-300'
          }`}>
            Noodle History ◴
          </h3>
        </div>

        {/* Noodle History Search Bar (Available exclusively to signed-in users) */}
        {/* Restricted noodle history search bar visibility and title filtering exclusively to signed-in users [Commented by: Google AI Studio on 28/10/2026 12:12 PM] */}
        {currentUser && (
          <div className="relative mb-3">
            <input
              type="text"
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              placeholder="Search noodles by title..."
              className={`w-full rounded-lg pl-8 pr-7 py-1.5 text-xs transition-colors focus:outline-none ${
                theme === 'Minimalist Light'
                  ? 'bg-neutral-100 border border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-emerald-600 focus:bg-white'
                  : 'bg-[#141414] border border-[#262626] text-white placeholder-neutral-500 focus:border-[#39ff14]'
              }`}
              aria-label="Search noodles by title"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 text-xs pointer-events-none">
              🔍
            </span>
            {historySearchQuery && (
              <button
                onClick={() => setHistorySearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs p-0.5 cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Cloudflare Worker history sync indicator and non-intrusive offline fallback status  [Commented by: Google AI Studio on 14/10/2026 10:55 AM] */}
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
        {/* Non-intrusive IndexedDB storage quota warning  [Commented by: Google AI Studio on 15/10/2026 09:22 AM] */}
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
        {/* Increased empty history text font size per focus-mode instruction  [Commented by: Google AI Studio on 18/10/2026 01:07 PM] */}
        <div className="flex-1 overflow-y-auto space-y-1" onScroll={handleChatTitleMouseLeave}>
          {chats.length === 0 ? (
            <div className="text-sm text-neutral-500 p-2 italic">No noodle history yet</div>
          ) : filteredChats.length === 0 ? (
            <div className="text-xs text-neutral-500 p-2 italic text-center space-y-1.5">
              <div>No noodles matching &quot;{historySearchQuery}&quot;</div>
              <button
                onClick={() => setHistorySearchQuery('')}
                className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
              >
                Clear search
              </button>
            </div>
          ) : (
            filteredChats.map((c) => (
              <div
                key={c.id}
                onClick={() => handleSelectChat(c.id)}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                  activeChatId === c.id
                    ? theme === 'Minimalist Light'
                      ? 'bg-neutral-100 text-neutral-900 font-semibold border-l-2 border-emerald-600 shadow-xs'
                      : 'bg-[#222] text-white'
                    : theme === 'Minimalist Light'
                    ? 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    : 'text-neutral-400 hover:bg-[#151515] hover:text-white'
                }`}
              >
                {/* Noodle title with search highlighting and quick preview on hover without selecting [Commented by: Google AI Studio on 29/10/2026 04:00 PM] */}
                <span
                  onMouseEnter={(e) => handleChatTitleMouseEnter(c, e)}
                  onMouseLeave={handleChatTitleMouseLeave}
                  className="truncate max-w-[170px] hover:text-emerald-400 transition-colors"
                  title="Hover for quick preview"
                >
                  {highlightSearchMatch(c.title || 'Untitled Noodle', historySearchQuery)}
                </span>
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
        <div className={`border-t pt-4 mt-auto flex flex-col gap-2.5 ${
          theme === 'Minimalist Light' ? 'border-neutral-200' : 'border-[#262626]'
        }`}>
          <button
            onClick={handleClearChatHistory}
            className="w-full bg-[#dc2626] hover:bg-red-700 text-white font-bold py-[10px] px-3 rounded-[6px] text-xs transition-colors cursor-pointer"
          >
            Clear Noodle History
          </button>

          {/* Render Settings button for signed-in users or 'About nanobot' button in exact same position for non-signed-in users  [Commented by: Google AI Studio on 20/10/2026 11:32 AM] */}
          {currentUser ? (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`w-full font-bold py-[10px] px-3 rounded-[6px] text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                theme === 'Minimalist Light'
                  ? 'bg-white border border-neutral-300 hover:border-neutral-500 text-neutral-800 hover:bg-neutral-50 shadow-xs'
                  : 'bg-black border border-[#333] hover:border-neutral-500 text-white'
              }`}
            >
              <span>⚙️</span>
              <span>Settings</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAboutModalOpen(true)}
              className={`w-full font-bold py-[10px] px-3 rounded-[6px] text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                theme === 'Minimalist Light'
                  ? 'bg-white border border-neutral-300 hover:border-neutral-500 text-neutral-800 hover:bg-neutral-50 shadow-xs'
                  : 'bg-black border border-[#333] hover:border-neutral-500 text-white'
              }`}
            >
              <span>About nanobot</span>
            </button>
          )}
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      {/* When mobile sidebar is opened, this sidebar button rides on top with z-50 in the top-right, while all other buttons, chat box, and text disappear  [Commented by: Google AI Studio on 21/10/2026 05:45 AM] */}
      <main className="flex-1 relative flex flex-col items-center h-full overflow-hidden">
        {/* Top Controls (Left: Sidebar Toggle & New Noodle; positioned in top-right aligned with History divider line on mobile when sidebar is open) */}
        {/* Moved button a bit upwards on mobile with max-sm:top-[11px] to perfectly align bottom edge with divider line under History text  [Commented by: Google AI Studio on 21/10/2026 06:08 AM] */}
        <div className={`absolute ${
          sidebarOpen ? 'max-sm:top-[11px] max-sm:right-[15px] max-sm:left-auto top-4 left-4' : 'top-4 left-4'
        } flex gap-2 z-50`}>
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className={`w-10 h-10 bg-transparent border rounded-[8px] flex items-center justify-center text-[20px] cursor-pointer transition-colors ${
              theme === 'Minimalist Light'
                ? 'border-neutral-300 text-neutral-800 hover:border-neutral-500 hover:bg-neutral-100'
                : 'border-[#333] text-white hover:border-neutral-500'
            }`}
            title={sidebarOpen ? 'Close History' : 'Toggle History'}
            aria-label={sidebarOpen ? 'Close History' : 'Toggle History'}
          >
            {sidebarOpen ? '✕' : '◴'}
          </button>
          <button
            onClick={handleStartNewChat}
            className={`w-10 h-10 bg-transparent border rounded-[8px] flex items-center justify-center text-[20px] cursor-pointer transition-colors ${
              sidebarOpen ? 'max-sm:hidden' : ''
            } ${
              theme === 'Minimalist Light'
                ? 'border-neutral-300 text-neutral-800 hover:border-neutral-500 hover:bg-neutral-100'
                : 'border-[#333] text-white hover:border-neutral-500'
            }`}
            title="New Noodle"
            aria-label="New Noodle"
          >
            💬
          </button>
        </div>

        {/* Top-Right Controls */}
        {/* Responsive layout placing 'Import Shared Noodle' below 'Sign In' and 'Sign Up' on mobile to prevent button overlap [Commented by: Google AI Studio on 30/10/2026 11:00 AM] */}
        <div className={`absolute top-3.5 right-3.5 sm:top-4 sm:right-4 flex items-center gap-2 z-30 ${
          sidebarOpen ? 'max-sm:hidden' : ''
        }`}>
          {/* Signed-Out View: 'Import Shared Noodle' placed cleanly below 'Sign In' and 'Sign Up' on mobile screens to prevent overlapping */}
          {!currentUser ? (
            <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 order-1 sm:order-2">
                <button
                  type="button"
                  onClick={() => setAuthModalMode('signin')}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    theme === 'Minimalist Light'
                      ? 'bg-white border border-neutral-300 hover:border-neutral-500 text-neutral-900 shadow-xs'
                      : 'bg-black border border-[#333] hover:border-neutral-500 text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModalMode('signup')}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    theme === 'Minimalist Light'
                      ? 'bg-neutral-900 border border-neutral-900 hover:bg-neutral-800 text-white shadow-xs'
                      : 'bg-black border border-[#333] hover:border-neutral-500 text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsProvideUrlModalOpen(true)}
                className={`order-2 sm:order-1 px-2.5 sm:px-3 py-1 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  theme === 'Minimalist Light'
                    ? 'bg-white border border-neutral-300 hover:border-neutral-500 text-neutral-900 shadow-xs'
                    : 'bg-black border border-[#333] hover:border-neutral-500 text-white'
                }`}
              >
                Import Shared Noodle
              </button>
            </div>
          ) : (!activeChat || activeChat.messages.length === 0) ? (
            /* Signed-In New Noodle (0 messages): borderless three-dot menu with Incognito Noodle and Import Noodle */
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNewNoodleMenuOpen((prev) => !prev)}
                className="p-1.5 text-neutral-400 hover:text-white border-none outline-none focus:outline-none cursor-pointer text-xl leading-none transition-colors select-none tracking-widest"
                title="Menu"
                aria-label="Menu"
              >
                ···
              </button>

              {isNewNoodleMenuOpen && (
                <div className={`absolute right-0 top-full mt-2 w-52 rounded-xl py-2 px-1 text-xs shadow-2xl z-50 border ${
                  theme === 'Minimalist Light'
                    ? 'bg-white border-neutral-200 text-neutral-800'
                    : 'bg-[#141414] border-[#2b2b2b] text-neutral-200'
                }`}>
                  {/* Incognito Noodle with green toggle button beside it */}
                  <div className="flex items-center justify-between px-3 py-2 hover:bg-neutral-800/40 rounded-lg">
                    <span className="font-medium">Incognito Noodle</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isIncognito}
                      onClick={() => setIsIncognito((prev) => !prev)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isIncognito ? 'bg-emerald-500' : 'bg-neutral-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                          isIncognito ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Direct Import Noodle URL trigger [Commented by: Google AI Studio on 30/10/2026 11:00 AM] */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewNoodleMenuOpen(false);
                      setIsProvideUrlModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-800/40 rounded-lg font-medium cursor-pointer transition-colors"
                  >
                    Import Noodle
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Signed-In Running Noodle (>0 messages): borderless three-dot menu with Share and Export as PDF */
            !isIncognito ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsRunningNoodleMenuOpen((prev) => !prev)}
                  className="p-1.5 text-neutral-400 hover:text-white border-none outline-none focus:outline-none cursor-pointer text-xl leading-none transition-colors select-none tracking-widest"
                  title="Menu"
                  aria-label="Menu"
                >
                  ···
                </button>

                {isRunningNoodleMenuOpen && (
                  <div className={`absolute right-0 top-full mt-2 w-44 rounded-xl py-2 px-1 text-xs shadow-2xl z-50 border ${
                    theme === 'Minimalist Light'
                      ? 'bg-white border-neutral-200 text-neutral-800'
                      : 'bg-[#141414] border-[#2b2b2b] text-neutral-200'
                  }`}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRunningNoodleMenuOpen(false);
                        handleShareActiveChat();
                      }}
                      disabled={isSharing}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-800/40 rounded-lg font-medium cursor-pointer transition-colors"
                    >
                      {isSharing ? 'Sharing...' : 'Share'}
                    </button>
                    {/* Formatted PDF export button [Commented by: Google AI Studio on 30/10/2026 11:00 AM] */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRunningNoodleMenuOpen(false);
                        handleExportActiveChat();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-800/40 rounded-lg font-medium cursor-pointer transition-colors"
                    >
                      Export as PDF
                    </button>
                  </div>
                )}
              </div>
            ) : null
          )}
        </div>

        {/* Offline Warning */}
        {!isOnline && (
          <div className={`absolute top-14 text-red-500 font-bold text-sm z-20 ${
            sidebarOpen ? 'max-sm:hidden' : ''
          }`}>
            Offline 🛜
          </div>
        )}

        {/* Main Heading (Visible in zero state matching 19vh and 3.5rem) */}
        {!activeChat && !sharedChatView && (
          <h1 className={`absolute top-[19vh] text-[3.5rem] font-bold font-serif tracking-tight pointer-events-none select-none transition-colors ${
            sidebarOpen ? 'max-sm:hidden' : ''
          } ${
            theme === 'Minimalist Light' ? 'text-neutral-900' : 'text-white'
          }`}>
            nanobot
          </h1>
        )}

        {/* Chat Messages Area */}
        {/* Attached onScroll listener for user scroll detection during active AI streaming  [Commented by: Google AI Studio on 22/10/2026 04:51 AM] */}
        <div
          ref={chatAreaRef}
          onScroll={handleChatScroll}
          className={`w-full flex-1 overflow-y-auto px-4 md:px-12 pt-20 pb-44 flex flex-col gap-6 ${
            sidebarOpen ? 'max-sm:hidden' : ''
          } ${
            !activeChat && !sharedChatView ? 'hidden' : 'flex'
          }`}
        >
          {/* Shared Chat Session Banner */}
          {/* View-only shared chat notification banner with 'Continue this chat' action button  [Commented by: Google AI Studio on 22/10/2026 04:51 AM] */}
          {sharedChatView && (
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2 animate-in fade-in duration-200 ${
              theme === 'Minimalist Light'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200'
            }`}>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  <span>🔗 Shared Chat:</span>
                  <span className="font-bold">{sharedChatView.title}</span>
                </div>
                <div className="text-[11px] opacity-80">
                  Shared view-only snapshot • Retained for 30 days per policy
                </div>
              </div>
              <button
                type="button"
                onClick={handleContinueSharedChat}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0 shadow-sm"
              >
                Continue this chat ➔
              </button>
            </div>
          )}

          {(sharedChatView ? sharedChatView.messages : (activeChat?.messages || [])).map((m, idx) => {
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
                  <div
                    className="relative flex flex-col items-end max-w-[85%] md:max-w-[75%]"
                    onMouseEnter={() => setHoveredUserMessageIndex(idx)}
                    onMouseLeave={() => setHoveredUserMessageIndex(null)}
                  >
                    {editingMessageIndex === idx ? (
                      /* Inline Focused Textarea for User Message Editing [Commented by: Google AI Studio on 28/10/2026 12:05 PM] */
                      <div className={`p-3 rounded-2xl w-full border shadow-lg ${
                        theme === 'Minimalist Light'
                          ? 'bg-white border-emerald-500'
                          : 'bg-[#181818] border-emerald-500'
                      }`}>
                        <textarea
                          autoFocus
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleResendEditedMessage(idx, editText);
                            }
                          }}
                          rows={Math.max(2, editText.split('\n').length)}
                          className={`w-full text-sm leading-relaxed p-2.5 rounded-lg resize-none focus:outline-none ${
                            theme === 'Minimalist Light'
                              ? 'bg-neutral-50 text-neutral-900 border border-neutral-200'
                              : 'bg-[#111] text-white border border-[#333]'
                          }`}
                        />
                        <div className="flex items-center justify-between mt-2 text-[11px] text-neutral-400">
                          <span>Press Enter to resend • Shift+Enter for new line</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMessageIndex(null);
                                setEditText('');
                              }}
                              className="px-2.5 py-1 rounded bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResendEditedMessage(idx, editText)}
                              className="px-3 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-500 cursor-pointer"
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`px-4 py-3 rounded-2xl w-full text-sm leading-relaxed break-words transition-colors ${
                          theme === 'Minimalist Light'
                            ? 'bg-white border border-neutral-200 text-neutral-900 shadow-xs'
                            : 'bg-[#181818] border border-[#2a2a2a] text-neutral-100'
                        }`}>
                          <div>{escapeHtml(textContent)}</div>
                          {m.displayAttachments && m.displayAttachments.length > 0 && (
                            <div className="mt-2 text-xs text-neutral-400 space-y-1.5 border-t border-neutral-700/60 pt-1.5">
                              {m.displayAttachments.map((att, aIdx) => (
                                <div key={aIdx} className="flex items-center gap-2 flex-wrap">
                                  <span>{att.type === 'image' ? '🖼️ Image' : `📄 ${att.name}`}</span>
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

                        {/* Hover Action Buttons below user message: Copy and Edit [Commented by: Google AI Studio on 28/10/2026 12:05 PM] */}
                        <div className={`flex items-center gap-1.5 mt-1 px-1 transition-opacity duration-150 ${
                          hoveredUserMessageIndex === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(textContent);
                            }}
                            className="text-[11px] px-2.5 py-0.5 rounded bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                          >
                            Copy
                          </button>
                          {!sharedChatView && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMessageIndex(idx);
                                setEditText(textContent);
                              }}
                              className="text-[11px] px-2.5 py-0.5 rounded bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className={`w-full text-sm leading-relaxed transition-colors ${
                    theme === 'Minimalist Light' ? 'text-neutral-800' : 'text-neutral-200'
                  }`}>
                    {/* Reasoning Accordion if present */}
                    {m.reasoning && (
                      <div className="mb-3 border-l-2 border-emerald-500/50 pl-3 py-1">
                        <button
                          type="button"
                          onClick={() => setExpandedReasoningIndices((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                          className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1.5 cursor-pointer font-mono select-none"
                        >
                          <span>Thinking</span>
                          <span>{expandedReasoningIndices[idx] ? '▼' : '▲'}</span>
                        </button>
                        {expandedReasoningIndices[idx] && (
                          <div className="mt-2 p-3 bg-[#0d0d0d] border border-[#222] rounded-lg text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
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

              {/* Inline reasoning accordion: Thinking ▼ while thinking; auto-closes and reverts to Thinking ▲ when answer streams [Commented by: Google AI Studio on 30/10/2026 11:00 AM] */}
              {currentReasoning && (
                <div className="mb-3 border-l-2 border-emerald-500/50 pl-3 py-1">
                  <button
                    type="button"
                    onClick={() => setReasoningAccordionOpen((prev) => !prev)}
                    className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1.5 cursor-pointer font-mono select-none"
                  >
                    <span>Thinking</span>
                    <span>{reasoningAccordionOpen ? '▼' : '▲'}</span>
                  </button>
                  {reasoningAccordionOpen && (
                    <div className="mt-2 p-3 bg-[#0d0d0d] border border-[#222] rounded-lg text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
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
        {/* Moved chat box slightly downwards to top-[34vh] so the neon aura does not touch the nanobot title text  [Commented by: Google AI Studio on 21/10/2026 06:17 AM] */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-full max-w-[750px] px-4 transition-all duration-300 z-20 ${
            sidebarOpen ? 'max-sm:hidden' : ''
          } ${
            activeChat || sharedChatView ? 'bottom-[45px]' : 'top-[34vh]'
          }`}
        >
          {/* Auto-scroll Snap Button: Appears when user scrolls up during active streaming; clicking snaps to bottom and activates auto-scroll */}
          {/* Down arrow floating button snapped to the bottom to resume auto-scroll streaming  [Commented by: Google AI Studio on 22/10/2026 04:51 AM] */}
          {isGenerating && isUserScrolledUp && (
            <div className="flex justify-center mb-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <button
                type="button"
                onClick={handleScrollToBottomClick}
                className={`w-9 h-9 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 cursor-pointer z-30 border ${
                  theme === 'Minimalist Light'
                    ? 'bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-100 shadow-md'
                    : 'bg-[#181818] border-[#3a3a3a] text-white hover:bg-[#252525] shadow-black/80'
                }`}
                title="Snap to bottom & auto-scroll"
                aria-label="Snap to bottom & auto-scroll"
              >
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            </div>
          )}

          {/* Storage quota and sync status notices  [Commented by: Google AI Studio on 15/10/2026 09:57 AM] */}
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
          <div className={`w-full rounded-[20px] p-[15px] flex flex-col gap-2.5 transition-all duration-200 ${
            theme === 'Minimalist Light'
              ? 'bg-white border border-neutral-300 shadow-xl'
              : 'bg-[#111] border border-[#333] neon-glow'
          }`}>
            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto py-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className={`relative group shrink-0 rounded-xl px-3 py-2 flex items-center gap-2 text-xs transition-colors ${
                      theme === 'Minimalist Light'
                        ? 'bg-neutral-100 border border-neutral-300 text-neutral-800'
                        : 'bg-[#1c1c1c] border border-[#333] text-neutral-300'
                    }`}
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
                    <span className="truncate max-w-[120px]">
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
              className={`w-full bg-transparent border-none resize-none outline-none text-[16px] leading-[1.5] min-h-[52px] max-h-[160px] transition-colors ${
                theme === 'Minimalist Light'
                  ? 'text-neutral-900 placeholder-neutral-400'
                  : 'text-white placeholder-neutral-500'
              }`}
            />

            {/* Bottom Controls */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-1 text-[1.2rem] cursor-pointer transition-colors ${
                    theme === 'Minimalist Light'
                      ? 'text-neutral-600 hover:text-neutral-900'
                      : 'text-neutral-400 hover:text-white'
                  }`}
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
                  onClick={() => handleSend()}
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
      {/* Removed email login concept completely: Sign Up directly opens for username, password, and API keys  [Commented by: Google AI Studio on 16/10/2026 10:55 PM] */}
      {authModalMode && (
        <AuthModal
          mode={authModalMode}
          isOpen={true}
          onClose={() => setAuthModalMode(null)}
          onSwitchMode={(mode) => setAuthModalMode(mode)}
          onSuccess={(user, secret) => {
            setCurrentUser(user);
            setPasswordSecret(secret);
            if (user.theme) setTheme(user.theme);
          }}
        />
      )}

      {/* SETTINGS MODAL */}
      {/* Passed theme and onThemeChange props to SettingsModal for switching between Neon Black and Minimalist Light  [Commented by: Google AI Studio on 20/10/2026 11:33 AM] */}
      {currentUser && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          user={currentUser}
          currentPasswordSecret={passwordSecret}
          onUpdateUser={(updated, newSecret) => {
            setCurrentUser(updated);
            if (newSecret) setPasswordSecret(newSecret);
            if (updated.theme) setTheme(updated.theme);
          }}
          onDeleteAccount={() => {
            // Thoroughly wipe all account sessions, encrypted noodles, and local files upon account deletion [Commented by: Google AI Studio on 30/10/2026 11:00 AM]
            const deletedUserId = currentUser?.id;
            setCurrentUser(null);
            setPasswordSecret('');
            setCryptoKey(null);
            setChats([]);
            localStorage.removeItem('nanobot_chats');
            localStorage.removeItem('nanobot_encrypted_chats');
            if (deletedUserId) {
              localStorage.removeItem(`nanobot_encrypted_chats_${deletedUserId}`);
            }
            localStorage.removeItem('nanobot_active_user');
            clearAllOriginalFiles().catch(() => {});
            handleStartNewChat();
          }}
          theme={theme}
          onThemeChange={(newTheme) => setTheme(newTheme)}
        />
      )}

      {/* Standalone About modal for non-signed-in users  [Commented by: Google AI Studio on 18/10/2026 12:58 AM] */}
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        connectedPlugins={currentUser?.plugins_connected}
      />

      {/* Quick Preview Tooltip for sidebar chat title hover without selecting [Commented by: Google AI Studio on 23/10/2026 12:40 AM] */}
      {quickPreview && (
        <div
          style={{ top: `${quickPreview.y}px`, left: `${quickPreview.x}px` }}
          className={`fixed z-60 w-80 max-w-[calc(100vw-24px)] rounded-xl shadow-2xl p-3.5 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95 border ${
            theme === 'Minimalist Light'
              ? 'bg-white/95 border-neutral-300 text-neutral-900 shadow-neutral-300/50 backdrop-blur-md'
              : 'bg-[#121212]/95 border-[#333] text-neutral-200 shadow-black/80 backdrop-blur-md'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-inherit opacity-90">
            <span className="text-xs font-semibold truncate max-w-[200px]">
              {quickPreview.title}
            </span>
            <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded font-medium border ${
              theme === 'Minimalist Light'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
            }`}>
              Quick Preview
            </span>
          </div>

          {/* Content: First 2 messages */}
          {quickPreview.isLoading ? (
            <div className="py-4 text-center text-xs opacity-60 flex items-center justify-center gap-2">
              <span className="animate-spin inline-block">⏳</span>
              <span>Loading preview messages...</span>
            </div>
          ) : quickPreview.messages.length === 0 ? (
            <div className="py-3 text-center text-xs italic opacity-50">
              No messages in this conversation yet.
            </div>
          ) : (
            <div className="space-y-2">
              {quickPreview.messages.slice(0, 2).map((msg, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-2 text-[11px] leading-relaxed border ${
                    msg.role === 'user'
                      ? theme === 'Minimalist Light'
                        ? 'bg-neutral-100 border-neutral-200 text-neutral-800'
                        : 'bg-[#1c1c1c] border-[#2c2c2c] text-neutral-300'
                      : theme === 'Minimalist Light'
                      ? 'bg-emerald-50/70 border-emerald-200 text-neutral-900'
                      : 'bg-[#0f241a] border-emerald-900/40 text-emerald-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-[10px] uppercase tracking-wider mb-1 opacity-75">
                    <span>{msg.role === 'user' ? '👤 User' : '⚡ nanobot'}</span>
                    <span className="text-[9px] opacity-60 font-mono">#{idx + 1}</span>
                  </div>
                  <p className="line-clamp-3 text-[11px]">
                    {getMessageSnippet(msg.content)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Centered Enter URL Modal Dialog [Commented by: Google AI Studio on 28/10/2026 12:08 PM] */}
      {isProvideUrlModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border space-y-4 animate-in fade-in zoom-in-95 duration-150 ${
            theme === 'Minimalist Light'
              ? 'bg-white border-neutral-300 text-neutral-900'
              : 'bg-[#121212] border-[#2b2b2b] text-white'
          }`}>
            <div className="flex items-center justify-between pb-1 border-b border-inherit opacity-90">
              <h3 className="text-base font-bold font-serif">Enter URL</h3>
              <button
                type="button"
                onClick={() => {
                  setIsProvideUrlModalOpen(false);
                  setProvideUrlInput('');
                }}
                className="text-neutral-400 hover:text-white cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Paste a shared noodle link to import and continue chatting.
            </p>

            <input
              type="text"
              autoFocus
              value={provideUrlInput}
              onChange={(e) => setProvideUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleImportFromUrl(provideUrlInput);
                }
              }}
              placeholder="https://.../?share=..."
              className={`w-full rounded-xl p-3 text-xs focus:outline-none border ${
                theme === 'Minimalist Light'
                  ? 'bg-neutral-100 border-neutral-300 text-neutral-900 focus:border-emerald-600'
                  : 'bg-[#181818] border-[#333] text-white focus:border-[#39ff14]'
              }`}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsProvideUrlModalOpen(false);
                  setProvideUrlInput('');
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white bg-transparent cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!provideUrlInput.trim() || isImportingUrl}
                onClick={() => handleImportFromUrl(provideUrlInput)}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors disabled:opacity-50"
              >
                {isImportingUrl ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
