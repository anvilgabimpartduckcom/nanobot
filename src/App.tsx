// Created unified nanobot App with Supabase auth, settings, incognito mode, deep research, and smooth streaming [Commented by: Google AI Studio on 12/10/2026 10:58 PM]

import React, { useState, useEffect, useRef } from 'react';
import { AuthModal } from './components/AuthModal';
// Imported SettingsModal, AboutModal, dynamic Theme/Accent system, and Fish Audio S2.1 Pro Voice utilities [Commented by: Google AI Studio on 28/11/2026 06:55]
import { SettingsModal, AppTheme } from './components/SettingsModal';
import { AboutModal } from './components/AboutModal';
import {
  AccentPreference,
  DEFAULT_ACCENT_PREFERENCE,
  applyAccentCssVariables,
  isValidAccentFamily,
  isValidHexColor,
} from './lib/theme';
import {
  ALL_VOICE_CHOICES,
  RANDOM_VOICE_ID,
  buildVoiceSystemInstructions,
  extractVoiceChoiceFromResponse,
  getVoiceOptionById,
  isValidVoiceId,
  synthesizeFishSpeech,
} from './lib/voice';
// Imported Supabase account/session helpers only; chat & file-output Supabase persistence removed under H-5 [Commented by: Google AI Studio on 28/11/2026 07:32]
import {
  UserProfile,
  supabase,
  restoreActiveSession,
  clearLegacyLocalProfileCache
} from './lib/supabase';
import { deriveKeyFromPassword } from './lib/crypto';
import { analyzeFileWithScript, ProcessedFile } from './lib/fileReader';
import { performDynamicSearch, runDeepResearch, extractUrlsWithTavily } from './lib/tavily';
import { markdownToHtml, escapeHtml, safeUrl } from './lib/markdown';
// Imported Cloudflare Worker client for shared noodles, MCP add-ons, and user preferences (regular D1 chat endpoints removed) [Commented by: Google AI Studio on 28/11/2026 07:32]
import { workerClient, WorkerMessage, WorkerFileOutput } from './lib/workerClient';
// Imported browser-local storage manager for regular chats, dedicated incognito chats, and local file outputs [Commented by: Google AI Studio on 28/11/2026 07:32]
import {
  saveRegularChatsLocally,
  loadRegularChatsLocally,
  saveIncognitoChatsLocally,
  loadIncognitoChatsLocally,
  setIncognitoModeFlagLocally,
  getIncognitoModeFlagLocally,
  clearIncognitoHistoryLocally,
  saveLocalFileOutput,
  loadLocalFileOutputs,
  deleteLocalConversationArtifacts,
  clearAllLocalChatAndFileData,
} from './lib/localChatStorage';
// Imported IndexedDB storage manager for client-only original user files [Commented by: Google AI Studio on 28/11/2026 07:32]
import {
  saveOriginalFile,
  getOriginalFilesForChat,
  deleteOriginalFilesForChat,
  clearAllOriginalFiles,
} from './lib/indexedDb';

// Replaced legacy PDF export import with client-side JSON chat backup exporter [Commented by: Google AI Studio at 22/11/2026 14:33]
import { exportNoodleAsJson, ExportFileOutput } from './lib/jsonExport';
// Pure sharing helpers for snapshot sanitization, URL extraction, clipboard copy, and independent forking [Commented by: Google AI Studio at 24/11/2026 17:13]
import {
  buildShareSnapshotMessages,
  copyTextToClipboard,
  createForkedChatSession,
  extractShareIdFromInput,
  SHARED_NOODLE_PRIVACY_DISCLOSURE,
} from './lib/shareUtils';

interface ChatMessage {
  id?: string;
  role: 'user' | 'ai';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  createdAt?: string;
  sources?: Array<{ title: string; url: string }>;
  reasoning?: string;
  displayAttachments?: Array<{ type: string; name: string; fileId?: string; isLocalMissing?: boolean }>;
  metadata?: Record<string, unknown>;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  pinned: boolean;
  updated: number;
  shareId?: string; // Stored Cloudflare D1 share snapshot ID to update snapshot under identical URL [Commented by: Google AI Studio on 28/10/2026 11:38 PM]
}

const STOP_FRAMES = ['|', '/', '-', '\\'];
const INPUT_MIN_HEIGHT = 52;
// Removed max_tokens output parameter and set input context window ceiling to 1,000,000 tokens [Commented by: Google AI Studio on 29/10/2026 09:20 PM]
const MAX_INPUT_TOKENS = 1_000_000;

// Interprets OpenRouter HTTP errors and response payloads into friendly, plain-English messages [Commented by: Google AI Studio on 30/10/2026 11:00 PM]
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
            className="accent-highlight-mark font-bold rounded-xs px-0.5"
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
  // Removed top notification toastNotice state entirely per user request [Commented by: Google AI Studio on 30/10/2026 11:00 PM]
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [passwordSecret, setPasswordSecret] = useState<string>('');
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  // Restore Incognito mode flag strictly from browser localStorage across page refreshes [Commented by: Google AI Studio on 28/11/2026 07:32]
  const [isIncognito, setIsIncognito] = useState<boolean>(() => getIncognitoModeFlagLocally());

  // States for top-right three-dot menus and URL modal [Commented by: Google AI Studio on 28/10/2026 11:38 PM]
  const [isNewNoodleMenuOpen, setIsNewNoodleMenuOpen] = useState(false);
  const [isRunningNoodleMenuOpen, setIsRunningNoodleMenuOpen] = useState(false);
  const [isProvideUrlModalOpen, setIsProvideUrlModalOpen] = useState(false);
  const [provideUrlInput, setProvideUrlInput] = useState('');
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [importUrlError, setImportUrlError] = useState<string | null>(null);

  // User message hover & inline editing state [Commented by: Google AI Studio on 28/10/2026 11:38 PM]
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [hoveredUserMessageIndex, setHoveredUserMessageIndex] = useState<number | null>(null);

  // Initialized Theme and dynamic Accent Colour state with persistent DOM CSS variable synchronization [Commented by: Google AI Studio on 28/11/2026 06:55]
  const [theme, setTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem('nanobot_theme') as AppTheme) || 'Neon Black';
  });
  const [accent, setAccent] = useState<AccentPreference>(() => {
    const savedFam = localStorage.getItem('nanobot_accent_family') || '';
    const savedCol = localStorage.getItem('nanobot_accent_color') || '';
    return {
      family: isValidAccentFamily(savedFam) ? savedFam : DEFAULT_ACCENT_PREFERENCE.family,
      color: isValidHexColor(savedCol) ? savedCol : DEFAULT_ACCENT_PREFERENCE.color,
    };
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

  useEffect(() => {
    applyAccentCssVariables(accent, theme);
    localStorage.setItem('nanobot_accent_family', accent.family);
    localStorage.setItem('nanobot_accent_color', accent.color);
  }, [accent, theme]);

  // Separate regular chat history and dedicated incognito history persisted locally [Commented by: Google AI Studio on 28/11/2026 07:32]
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [incognitoChats, setIncognitoChats] = useState<ChatSession[]>(() => loadIncognitoChatsLocally().chats as ChatSession[]);
  const chatsRef = useRef<ChatSession[]>([]);
  const incognitoChatsRef = useRef<ChatSession[]>(incognitoChats);
  chatsRef.current = chats;
  incognitoChatsRef.current = incognitoChats;
  const [isRegularHistoryLocked, setIsRegularHistoryLocked] = useState<boolean>(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Added history search query state for filtering chat sessions by title [Commented by: Google AI Studio on 17/10/2026 02:45 PM]
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<ProcessedFile[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [currentReasoning, setCurrentReasoning] = useState<string>('');
  // Inline reasoning accordion lifecycle: Thinking ▼ while thinking, auto-closes to Thinking ▲ when answer streams [Commented by: Google AI Studio on 30/10/2026 11:00 PM]
  const [, setIsThinking] = useState<boolean>(false);
  const [reasoningAccordionOpen, setReasoningAccordionOpen] = useState<boolean>(false);
  const [expandedReasoningIndices, setExpandedReasoningIndices] = useState<Record<number, boolean>>({});
  const [activeSources, setActiveSources] = useState<Array<{ title: string; url: string }>>([]);
  const [showSourcesPopup, setShowSourcesPopup] = useState<number | null>(null);
  // Local history status & storage error notice states (cloud regular-chat sync removed under H-5) [Commented by: Google AI Studio on 28/11/2026 07:32]
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [chatFileOutputs, setChatFileOutputs] = useState<Record<string, WorkerFileOutput[]>>({});
  const [quotaErrorNotice, setQuotaErrorNotice] = useState<string | null>(null);
  const [exportStatusNotice, setExportStatusNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Auto-scroll state: track whether user scrolled up during stream and whether down-arrow snapping is active [Commented by: Google AI Studio on 22/10/2026 04:51 PM]
  const [isUserScrolledUp, setIsUserScrolledUp] = useState<boolean>(false);
  const [isAutoScrollActive, setIsAutoScrollActive] = useState<boolean>(false);

  // Shared chat state for public URL loading, read-only viewing, share link feedback, and seamless forking [Commented by: Google AI Studio at 24/11/2026 17:13]
  const [sharedChatView, setSharedChatView] = useState<{
    id: string;
    title: string;
    messages: ChatMessage[];
    created_at: string;
    expires_at: string;
  } | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [isLoadingSharedChat, setIsLoadingSharedChat] = useState<boolean>(false);
  // Share revocation confirmation & status feedback state [Commented by: Google AI Studio at 24/11/2026 22:57]
  const [pendingRevokeShare, setPendingRevokeShare] = useState<{
    chatId: string;
    shareId: string;
    title: string;
  } | null>(null);
  const [isRevokingShare, setIsRevokingShare] = useState<boolean>(false);
  const [revokeShareError, setRevokeShareError] = useState<string | null>(null);
  const [shareStatusNotice, setShareStatusNotice] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
    shareUrl?: string;
    copied?: boolean;
  } | null>(null);

  // Quick preview state for sidebar chat item hover preview without selection [Commented by: Google AI Studio on 23/10/2026 12:38 PM]
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
  const plusMenuRef = useRef<HTMLDivElement>(null);

  // Composer plus popup menu, Deep Research / Learn Step By Step modes, Reasoning Effort, Workspace Mode (Chat/Agent/Voice), and Fish Audio Voice state [Commented by: Google AI Studio on 28/11/2026 06:55]
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<'normal' | 'deep_research' | 'learn_step_by_step'>('normal');
  const [isSuperDeepResearch, setIsSuperDeepResearch] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('medium');
  const [workspaceMode, setWorkspaceMode] = useState<'chat' | 'agent' | 'voice'>('chat');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => {
    const saved = localStorage.getItem('nanobot_voice_id') || '';
    return isValidVoiceId(saved) ? saved : RANDOM_VOICE_ID;
  });
  const [isChooseVoiceOpen, setIsChooseVoiceOpen] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [liveSpeechInterim, setLiveSpeechInterim] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [hasVoiceSessionStarted, setHasVoiceSessionStarted] = useState(false);
  const [isSynthesizingAudio, setIsSynthesizingAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const [activeVoiceLabel, setActiveVoiceLabel] = useState<string | null>(null);
  const [audioGenerationId, setAudioGenerationId] = useState<string | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const latestVoiceTranscriptRef = useRef<string>('');
  const shouldSubmitVoiceRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isPlusMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setIsPlusMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPlusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isPlusMenuOpen]);

  // Reset transient composer mode and menu state when signed-out state resets on logout [Commented by: Google AI Studio at 27/11/2026 21:17]
  useEffect(() => {
    if (!currentUser) {
      setIsPlusMenuOpen(false);
      setComposerMode('normal');
    }
  }, [currentUser]);

  // Hydrate Theme, Accent Colour, and Fish Audio Voice preferences from cloud for authenticated sessions [Commented by: Google AI Studio on 28/11/2026 06:55]
  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    workerClient
      .getPreferences()
      .then((res) => {
        if (cancelled || !res.success || !res.data?.preferences) return;
        const prefs = res.data.preferences;
        if (prefs.theme === 'Neon Black' || prefs.theme === 'Minimalist Light') {
          setTheme(prefs.theme);
        }
        if (
          prefs.accent_family &&
          isValidAccentFamily(prefs.accent_family) &&
          prefs.accent_color &&
          isValidHexColor(prefs.accent_color)
        ) {
          setAccent({
            family: prefs.accent_family,
            color: prefs.accent_color,
          });
        }
        if (prefs.voice_id && isValidVoiceId(prefs.voice_id)) {
          setSelectedVoiceId(prefs.voice_id);
          localStorage.setItem('nanobot_voice_id', prefs.voice_id);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  // Clean up SpeechRecognition, HTML5 Audio, and Blob ObjectURLs on unmount [Commented by: Google AI Studio on 28/11/2026 06:55]
  useEffect(() => {
    return () => {
      try {
        if (speechRecognitionRef.current) {
          speechRecognitionRef.current.abort();
        }
      } catch {}
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
    };
  }, []);

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

  // Purge obsolete plaintext local profile cache on mount and restore Supabase Auth session [Commented by: Google AI Studio at 23/11/2026 22:30]
  useEffect(() => {
    clearLegacyLocalProfileCache();
    if (!supabase) return;

    restoreActiveSession().then((res) => {
      if (res.user) {
        setCurrentUser(res.user);
        if (res.user.theme) setTheme(res.user.theme);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearLegacyLocalProfileCache();
        setCurrentUser(null);
        setPasswordSecret('');
        setCryptoKey(null);
        // Clear cached file outputs, previews, and authenticated transient state on explicit sign-out [Commented by: Google AI Studio at 25/11/2026 22:57]
        if (event === 'SIGNED_OUT') {
          if (abortControllerRef.current) abortControllerRef.current.abort();
          stopVoiceAndAudio();
          setHasVoiceSessionStarted(false);
          setWorkspaceMode('chat');
          setIsChooseVoiceOpen(false);
          setIsGenerating(false);
          setChats([]);
          chatsRef.current = [];
          setIsRegularHistoryLocked(false);
          setActiveChatId(null);
          setChatFileOutputs({});
          previewCacheRef.current = {};
          setQuickPreview(null);
          // Turn off incognito display mode on sign-out without deleting dedicated nanobot_incognito_chats storage [Commented by: Google AI Studio on 28/11/2026 07:32]
          setIsIncognito(false);
          setIncognitoModeFlagLocally(false);
          setIsSettingsOpen(false);
          setPendingRevokeShare(null);
          setRevokeShareError(null);
          setHistorySearchQuery('');
          setHistoryNotice(null);
          setQuotaErrorNotice(null);
          setExportStatusNotice(null);
          setShareStatusNotice(null);
          setExpandedReasoningIndices({});
          setShowSourcesPopup(null);
          setEditingMessageIndex(null);
          setEditText('');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Persist regular or incognito chats strictly to browser localStorage; fail closed when locked and never fall back to cloud storage [Commented by: Google AI Studio on 28/11/2026 07:32]
  const persistChatsList = async (
    nextList: ChatSession[],
    opts?: {
      incognito?: boolean;
      key?: CryptoKey | null;
      user?: UserProfile | null;
      keepInMemoryOnError?: boolean;
    }
  ): Promise<boolean> => {
    const targetIncognito = opts?.incognito ?? isIncognito;
    if (targetIncognito) {
      const saveRes = saveIncognitoChatsLocally(nextList);
      if (!saveRes.success) {
        setQuotaErrorNotice(saveRes.error || 'Unable to save incognito chats in browser localStorage.');
        if (opts?.keepInMemoryOnError) {
          incognitoChatsRef.current = nextList;
          setIncognitoChats(nextList);
        }
        return false;
      }
      incognitoChatsRef.current = nextList;
      setIncognitoChats(nextList);
      return true;
    }

    const targetUser = opts?.user !== undefined ? opts.user : currentUser;
    const targetKey = opts?.key !== undefined ? opts.key : cryptoKey;
    const saveRes = await saveRegularChatsLocally(nextList, {
      userId: targetUser?.id || null,
      cryptoKey: targetKey,
      salt: targetUser?.salt,
    });

    if (!saveRes.success) {
      if (saveRes.locked) {
        setIsRegularHistoryLocked(true);
        setHistoryNotice(
          saveRes.error ||
            'Your encrypted regular chat history is locked. Open Settings > Account and enter your password to unlock.'
        );
      } else {
        setQuotaErrorNotice(saveRes.error || 'Unable to save regular chats in browser localStorage.');
      }
      if (opts?.keepInMemoryOnError && !saveRes.locked) {
        chatsRef.current = nextList;
        setChats(nextList);
      }
      return false;
    }

    chatsRef.current = nextList;
    setChats(nextList);
    return true;
  };

  // Derive CryptoKey and restore regular chats strictly from browser localStorage (never Supabase, never downgrade signed-in history to plaintext) [Commented by: Google AI Studio on 28/11/2026 07:32]
  useEffect(() => {
    let cancelled = false;

    if (currentUser && passwordSecret) {
      deriveKeyFromPassword(passwordSecret, currentUser.salt || 'default_nanobot_salt')
        .then(async (key) => {
          if (cancelled) return;
          setCryptoKey(key);
          const loaded = await loadRegularChatsLocally({
            userId: currentUser.id,
            cryptoKey: key,
            salt: currentUser.salt,
          });
          if (cancelled) return;
          chatsRef.current = loaded.chats as ChatSession[];
          setChats(loaded.chats as ChatSession[]);
          setIsRegularHistoryLocked(loaded.locked);
          if (loaded.error) {
            setHistoryNotice(loaded.error);
          } else {
            setHistoryNotice(null);
          }
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('Error deriving encryption key:', err);
          setCryptoKey(null);
          chatsRef.current = [];
          setChats([]);
          setIsRegularHistoryLocked(true);
          setHistoryNotice(
            'Unable to unlock encrypted regular chat history. Open Settings > Account and enter your password to unlock.'
          );
        });
    } else if (currentUser) {
      setCryptoKey(null);
      loadRegularChatsLocally({ userId: currentUser.id, cryptoKey: null }).then((loaded) => {
        if (cancelled) return;
        chatsRef.current = [];
        setChats([]);
        setIsRegularHistoryLocked(true);
        setHistoryNotice(
          loaded.error ||
            'Your encrypted regular chat history is locked on this session. Open Settings > Account and enter your password to unlock your saved chats.'
        );
      });
    } else {
      setCryptoKey(null);
      setIsRegularHistoryLocked(false);
      loadRegularChatsLocally({ userId: null }).then((loaded) => {
        if (cancelled) return;
        chatsRef.current = loaded.chats as ChatSession[];
        setChats(loaded.chats as ChatSession[]);
        if (loaded.error) {
          setQuotaErrorNotice(loaded.error);
        } else {
          setHistoryNotice(null);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [currentUser, passwordSecret]);

  // Export currently active regular or incognito noodle history client-side as a structured JSON backup file [Commented by: Google AI Studio on 28/11/2026 07:32]
  const handleExportActiveChat = () => {
    const currentVisibleChats = isIncognito ? incognitoChatsRef.current : chatsRef.current;
    const targetChat =
      currentVisibleChats.find((c) => c.id === activeChatId) ||
      (activeChatId ? null : currentVisibleChats[0]);
    if (!targetChat || targetChat.messages.length === 0) {
      setExportStatusNotice({
        type: 'error',
        text: 'Cannot export: select an active conversation with at least one message.',
      });
      return;
    }

    try {
      const outputs: ExportFileOutput[] = (chatFileOutputs[targetChat.id] || []).map((o) => ({
        id: o.id || o.source_file_id,
        source_file_id: o.source_file_id,
        file_name: o.file_name,
        file_type: o.file_type,
        output_type: o.output_type,
        output_content: o.output_content,
        created_at: o.created_at || new Date().toISOString(),
      }));
      exportNoodleAsJson(targetChat, outputs);
      setExportStatusNotice({
        type: 'success',
        text: 'Conversation backup downloaded as DO_NOT_EDIT_BACKUP_FOR_nanobot.json.',
      });
      setTimeout(() => {
        setExportStatusNotice((prev) => (prev?.type === 'success' ? null : prev));
      }, 4000);
    } catch (err: unknown) {
      const e = err as Error;
      console.error('JSON chat export failed:', e);
      setExportStatusNotice({
        type: 'error',
        text: e.message || 'Failed to export conversation as JSON.',
      });
    }
  };

  // Create or update a public 30-day share link with explicit clipboard and error feedback [Commented by: Google AI Studio at 24/11/2026 17:13]
  const handleShareActiveChat = async () => {
    if (!currentUser) {
      setShareStatusNotice({
        type: 'error',
        text: 'Sharing is unavailable while signed out. Please sign in to create a share link.',
      });
      return;
    }

    if (isIncognito) {
      setShareStatusNotice({
        type: 'error',
        text: 'Sharing is unavailable while Incognito Noodle mode is active.',
      });
      return;
    }

    const targetChat = chats.find((c) => c.id === activeChatId) || (activeChatId ? null : chats[0]);
    if (!targetChat || targetChat.messages.length === 0) {
      setShareStatusNotice({
        type: 'error',
        text: 'Cannot share an empty noodle. Send at least one message first.',
      });
      return;
    }

    setIsSharing(true);
    setShareStatusNotice(null);
    try {
      const cleanMessages = buildShareSnapshotMessages(targetChat.messages);

      // Pass existing targetChat.shareId so re-sharing by the same owner updates the snapshot under identical URL
      const res = await workerClient.createShare(targetChat.title, cleanMessages as WorkerMessage[], targetChat.shareId);
      if (res.success && res.data?.shareId) {
        const updatedChat: ChatSession = {
          ...targetChat,
          shareId: res.data.shareId,
        };
        persistChat(updatedChat);

        const shareUrl = `${window.location.origin}/?share=${encodeURIComponent(res.data.shareId)}`;
        const copyRes = await copyTextToClipboard(shareUrl);

        if (copyRes.copied) {
          setShareStatusNotice({
            type: 'success',
            text: res.data.updated
              ? 'Share link updated and copied to clipboard.'
              : 'Share link created and copied to clipboard.',
            shareUrl,
            copied: true,
          });
        } else {
          setShareStatusNotice({
            type: 'warning',
            text: `Share link created, but automatic copying failed${copyRes.error ? ` (${copyRes.error})` : ''}. Copy the link manually below:`,
            shareUrl,
            copied: false,
          });
        }
      } else {
        throw new Error(res.error || 'Failed to generate share URL.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create share link.';
      console.warn('Share noodle notice:', message);
      setShareStatusNotice({
        type: 'error',
        text: message,
      });
    } finally {
      setIsSharing(false);
    }
  };

  // Open confirmation dialog before revoking an existing public share link [Commented by: Google AI Studio at 24/11/2026 22:57]
  const requestRevokeShareForChat = (targetChat?: ChatSession | null) => {
    if (!currentUser) {
      setShareStatusNotice({
        type: 'error',
        text: 'You must be signed in to revoke a share link.',
      });
      return;
    }
    if (!targetChat?.shareId) {
      setShareStatusNotice({
        type: 'error',
        text: 'This noodle does not currently have an active share link.',
      });
      return;
    }
    setRevokeShareError(null);
    setPendingRevokeShare({
      chatId: targetChat.id,
      shareId: targetChat.shareId,
      title: targetChat.title || 'Shared Noodle',
    });
  };

  // Execute confirmed owner-only share revocation and clear local shareId on success [Commented by: Google AI Studio at 24/11/2026 22:57]
  const handleConfirmRevokeShare = async () => {
    if (!pendingRevokeShare) return;
    if (!currentUser) {
      setRevokeShareError('You must be signed in to revoke this share link.');
      return;
    }

    setIsRevokingShare(true);
    setRevokeShareError(null);
    try {
      const res = await workerClient.revokeShare(pendingRevokeShare.shareId);
      if (res.success && res.data?.revoked) {
        const targetLocalChat = chats.find((c) => c.id === pendingRevokeShare.chatId);
        if (targetLocalChat) {
          const { shareId: _removedShareId, ...withoutShareId } = targetLocalChat;
          const updatedChat: ChatSession = withoutShareId;
          persistChat(updatedChat);
        }
        setPendingRevokeShare(null);
        setRevokeShareError(null);
        setShareStatusNotice({
          type: 'success',
          text: 'Share link revoked. Anyone with the previous link can no longer view or fork this noodle.',
        });
      } else {
        throw new Error(res.error || 'Failed to revoke share link.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to revoke share link.';
      setRevokeShareError(message);
      setShareStatusNotice({
        type: 'error',
        text: message,
      });
    } finally {
      setIsRevokingShare(false);
    }
  };

  // Import shared noodle via URL into an independent local copy (signed-in) or view-only snapshot (signed-out) [Commented by: Google AI Studio at 24/11/2026 17:13]
  const handleImportFromUrl = async (urlStr: string) => {
    const { shareId, error: parseError } = extractShareIdFromInput(urlStr);
    if (!shareId) {
      setImportUrlError(parseError || 'Please enter a valid shared noodle link or share ID.');
      return;
    }

    setImportUrlError(null);
    setIsImportingUrl(true);
    try {
      const res = await workerClient.getPublicShare(shareId);
      if (res.success && res.share) {
        if (currentUser) {
          // Enforce fail-closed lock check before importing into signed-in regular history [Commented by: Google AI Studio on 28/11/2026 07:32]
          if (!cryptoKey || isRegularHistoryLocked) {
            setImportUrlError('Your encrypted regular history is locked. Open Settings > Account and enter your password to unlock before importing.');
            setIsSettingsOpen(true);
            return;
          }
          // Fork into current account as an independent local noodle without retaining original shareId
          const importedNoodle = createForkedChatSession({
            id: res.share.id,
            title: res.share.title || 'Imported Noodle',
            messages: (res.share.messages || []) as ChatMessage[],
          }) as ChatSession;
          const nextChats = [importedNoodle, ...chatsRef.current];
          const saved = await persistChatsList(nextChats, { incognito: false });
          if (!saved) {
            setImportUrlError('Imported snapshot could not be saved to browser localStorage.');
            return;
          }
          setIsIncognito(false);
          setIncognitoModeFlagLocally(false);
          setActiveChatId(importedNoodle.id);
          setSharedChatView(null);
          setIsProvideUrlModalOpen(false);
          setProvideUrlInput('');
          setImportUrlError(null);
        } else {
          // Signed out: load view-only shared chat
          const robotsMeta = document.querySelector('meta[name="robots"]');
          if (robotsMeta) {
            robotsMeta.setAttribute('content', 'noindex, nofollow, noarchive');
          }
          setSharedChatView({
            id: res.share.id,
            title: res.share.title,
            messages: res.share.messages as ChatMessage[],
            created_at: res.share.created_at,
            expires_at: res.share.expires_at,
          });
          setIsProvideUrlModalOpen(false);
          setProvideUrlInput('');
          setImportUrlError(null);
        }
      } else {
        setImportUrlError(res.error || 'Failed to load shared noodle. The link may be invalid or expired.');
      }
    } catch (err: unknown) {
      const e = err as Error;
      setImportUrlError(`Error loading shared noodle: ${e.message || 'Unknown error'}`);
    } finally {
      setIsImportingUrl(false);
    }
  };

  // Detect public share parameter in URL on page load, load view-only snapshot, and surface errors cleanly [Commented by: Google AI Studio at 24/11/2026 17:13]
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('share')) return;

    const rawShareParam = (params.get('share') || '').trim();
    if (!rawShareParam) {
      setShareStatusNotice({
        type: 'error',
        text: 'The shared noodle link is incomplete or missing a share identifier.',
      });
      return;
    }

    // Anti-scraping meta tag: prevents web scrapers from discovering or indexing shared chats
    const robotsMeta = document.querySelector('meta[name="robots"]');
    if (robotsMeta) {
      robotsMeta.setAttribute('content', 'noindex, nofollow, noarchive');
    }

    setIsLoadingSharedChat(true);
    workerClient
      .getPublicShare(rawShareParam)
      .then((res) => {
        if (res.success && res.share) {
          setSharedChatView({
            id: res.share.id,
            title: res.share.title,
            messages: res.share.messages as ChatMessage[],
            created_at: res.share.created_at,
            expires_at: res.share.expires_at,
          });
        } else {
          setShareStatusNotice({
            type: 'error',
            text: res.error || 'Shared noodle could not be found or has expired after 30 days.',
          });
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to load shared noodle.';
        console.warn('Failed to load shared chat:', message);
        setShareStatusNotice({
          type: 'error',
          text: message,
        });
      })
      .finally(() => {
        setIsLoadingSharedChat(false);
      });
  }, []);

  // Fork shared chat into user's browser-local regular chat history as an independent separate chat session [Commented by: Google AI Studio on 28/11/2026 07:32]
  const handleContinueSharedChat = async () => {
    if (!sharedChatView) return;

    if (!currentUser) {
      setAuthModalMode('signin');
      return;
    }

    if (!cryptoKey || isRegularHistoryLocked) {
      setHistoryNotice('Your encrypted regular chat history is locked. Open Settings > Account and enter your password to unlock before saving.');
      setIsSettingsOpen(true);
      return;
    }

    const forkedChat = createForkedChatSession(sharedChatView) as ChatSession;
    const saved = await persistChat(forkedChat, { incognito: false });
    if (!saved) return;

    setIsIncognito(false);
    setIncognitoModeFlagLocally(false);
    setActiveChatId(forkedChat.id);

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
  }, [chats, incognitoChats, isIncognito, activeChatId]);

  // Select regular or incognito conversation strictly from localStorage and verify IndexedDB local file presence [Commented by: Google AI Studio on 28/11/2026 07:32]
  const handleSelectChat = async (id: string) => {
    setSharedChatView(null);
    setShareStatusNotice(null);
    if (window.location.search.includes('share=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    const robotsMeta = document.querySelector('meta[name="robots"]');
    if (robotsMeta) {
      robotsMeta.setAttribute('content', 'index, follow');
    }
    setActiveChatId(id);
    setSidebarOpen(false);
    setVoiceError(null);
    setLiveSpeechInterim('');
    const currentList = isIncognito ? incognitoChatsRef.current : chatsRef.current;
    const cachedTarget = currentList.find((c) => c.id === id);
    const hasVoiceMessages = Boolean(
      cachedTarget?.messages?.some(
        (m) => m.metadata?.mode === 'voice' || m.metadata?.composerMode === 'voice'
      )
    );
    if (hasVoiceMessages) {
      setWorkspaceMode('voice');
      setHasVoiceSessionStarted(true);
    } else if (workspaceMode === 'voice') {
      setWorkspaceMode('chat');
      setHasVoiceSessionStarted(false);
    }

    // Check local file availability in IndexedDB for this conversation
    const localFiles = await getOriginalFilesForChat(id);
    const localFileIds = new Set(localFiles.map((f) => f.fileId));

    // Load local file outputs strictly from browser localStorage (never Supabase or Worker D1) [Commented by: Google AI Studio on 28/11/2026 07:32]
    try {
      const outputScope = isIncognito ? 'incognito' : (currentUser ? currentUser.id : 'guest');
      const localOutputs = await loadLocalFileOutputs(outputScope, id, isIncognito ? null : cryptoKey);
      if (localOutputs.length > 0) {
        const mappedOutputs: WorkerFileOutput[] = localOutputs.map((o) => ({
          id: o.id || o.source_file_id,
          conversation_id: o.conversation_id,
          source_file_id: o.source_file_id,
          file_name: o.file_name,
          file_type: o.file_type,
          output_type: o.output_type,
          output_content: o.extracted_output + (o.reader_code ? `\n\n[Python Reader Script]:\n${o.reader_code}` : ''),
          created_at: o.created_at || new Date().toISOString(),
        }));
        setChatFileOutputs((prev) => ({ ...prev, [id]: mappedOutputs }));
      }
    } catch (err) {
      console.warn('Local file outputs load notice:', err);
    }

    if (cachedTarget) {
      const updatedTarget: ChatSession = {
        ...cachedTarget,
        messages: cachedTarget.messages.map((m) => ({
          ...m,
          displayAttachments: m.displayAttachments?.map((att) => ({
            ...att,
            isLocalMissing: att.fileId ? !localFileIds.has(att.fileId) : false,
          })),
        })),
      };
      if (isIncognito) {
        setIncognitoChats((prev) => prev.map((c) => (c.id === id ? updatedTarget : c)));
      } else {
        setChats((prev) => prev.map((c) => (c.id === id ? updatedTarget : c)));
      }
    }
  };

  // Persist regular or incognito noodle strictly to browser localStorage; never Supabase or Worker D1 [Commented by: Google AI Studio on 28/11/2026 07:32]
  const persistChat = async (
    chat: ChatSession,
    opts?: { incognito?: boolean; keepInMemoryOnError?: boolean }
  ): Promise<boolean> => {
    const targetIncognito = opts?.incognito ?? isIncognito;
    const prev = targetIncognito ? incognitoChatsRef.current : chatsRef.current;
    const exists = prev.some((c) => c.id === chat.id);
    const updatedList = exists ? prev.map((c) => (c.id === chat.id ? chat : c)) : [chat, ...prev];
    return persistChatsList(updatedList, {
      incognito: targetIncognito,
      keepInMemoryOnError: opts?.keepInMemoryOnError,
    });
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  };

  // Detects manual upward scroll during active AI response stream [Commented by: Google AI Studio on 22/10/2026 04:51 PM]
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

  // Down arrow button click snaps chat to bottom and re-engages continuous auto-scroll [Commented by: Google AI Studio on 22/10/2026 04:51 PM]
  const handleScrollToBottomClick = () => {
    setIsAutoScrollActive(true);
    setIsUserScrolledUp(false);
    scrollToBottom();
  };

  // Auto-scroll snaps view to bottom when activated or on initial renders [Commented by: Google AI Studio on 22/10/2026 04:51 PM]
  useEffect(() => {
    if (isGenerating) {
      if (isAutoScrollActive) {
        scrollToBottom();
      }
    } else {
      scrollToBottom();
    }
  }, [chats, incognitoChats, isIncognito, currentStatus, streamDisplayContent, isAutoScrollActive, isGenerating]);

  // Automated descriptive title generator parsing initial user message and AI response instead of slicing 30 chars [Commented by: Google AI Studio on 22/10/2026 04:51 PM]
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

  // Stop active SpeechRecognition, audio playback, and revoke ObjectURL helper [Commented by: Google AI Studio on 28/11/2026 06:55]
  const stopVoiceAndAudio = () => {
    shouldSubmitVoiceRef.current = false;
    latestVoiceTranscriptRef.current = '';
    try {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.abort();
        speechRecognitionRef.current = null;
      }
    } catch {}
    setIsListeningVoice(false);
    setLiveSpeechInterim('');
    setIsSynthesizingAudio(false);
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    setIsPlayingAudio(false);
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    setLastAudioUrl(null);
    setActiveVoiceLabel(null);
    setAudioGenerationId(null);
  };

  // Start new chat, reset voice playback/session flags, and clear any active view-only shared snapshot [Commented by: Google AI Studio on 28/11/2026 06:55]
  const handleStartNewChat = () => {
    setSharedChatView(null);
    setShareStatusNotice(null);
    if (window.location.search.includes('share=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    const robotsMeta = document.querySelector('meta[name="robots"]');
    if (robotsMeta) {
      robotsMeta.setAttribute('content', 'index, follow');
    }
    stopVoiceAndAudio();
    setHasVoiceSessionStarted(false);
    setVoiceError(null);
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

  // Persist user's Fish Audio voice selection locally and to cloud preferences [Commented by: Google AI Studio on 28/11/2026 06:55]
  const handleSelectVoice = (voiceId: string) => {
    if (!isValidVoiceId(voiceId)) return;
    setSelectedVoiceId(voiceId);
    localStorage.setItem('nanobot_voice_id', voiceId);
    setIsChooseVoiceOpen(false);
    if (currentUser) {
      workerClient.updatePreferences({ voice_id: voiceId }).catch(() => {});
    }
  };

  // Toggle HTML5 audio playback for the latest generated Fish Audio clip [Commented by: Google AI Studio on 28/11/2026 06:55]
  const handleToggleReplayAudio = () => {
    if (!lastAudioUrl) return;
    if (audioElementRef.current && isPlayingAudio) {
      audioElementRef.current.pause();
      setIsPlayingAudio(false);
      return;
    }
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = 0;
      audioElementRef.current
        .play()
        .then(() => {
          setIsPlayingAudio(true);
          setVoiceError(null);
        })
        .catch(() => {
          setVoiceError('Browser blocked audio playback. Please click Play Audio again.');
        });
      return;
    }
    const audio = new Audio(lastAudioUrl);
    audioElementRef.current = audio;
    audio.onplay = () => setIsPlayingAudio(true);
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => {
      setIsPlayingAudio(false);
      setVoiceError('Unable to play generated audio.');
    };
    audio
      .play()
      .then(() => {
        setIsPlayingAudio(true);
        setVoiceError(null);
      })
      .catch(() => {
        setVoiceError('Browser blocked audio playback. Please click Play Audio again.');
      });
  };

  // Visible regular or incognito sessions separated cleanly [Commented by: Google AI Studio on 28/11/2026 07:32]
  const visibleChats = isIncognito ? incognitoChats : chats;
  const activeChat = visibleChats.find((c) => c.id === activeChatId);

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

  // Send message (supports normal composer, inline edited resend, and Voice mode Nemotron + Fish Audio S2.1 Pro pipeline) [Commented by: Google AI Studio on 28/11/2026 06:55]
  const handleSend = async (
    editedPromptText?: string,
    editedMsgIndex?: number,
    options?: { isVoiceTurn?: boolean }
  ) => {
    if (isGenerating) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setIsGenerating(false);
      setIsThinking(false);
      setReasoningAccordionOpen(false);
      setIsSynthesizingAudio(false);
      stopStreamSmoothing();
      return;
    }

    const isVoiceTurn = Boolean(options?.isVoiceTurn || workspaceMode === 'voice');
    const isEditMode = editedMsgIndex !== undefined && typeof editedPromptText === 'string';
    const trimmedPrompt = (
      isVoiceTurn && typeof editedPromptText === 'string' && editedMsgIndex === undefined
        ? editedPromptText
        : isEditMode
        ? editedPromptText
        : inputText
    ).trim();
    if (!trimmedPrompt && attachments.length === 0) return;

    if (!isOnline) {
      if (isVoiceTurn) {
        setVoiceError('No Internet connection available.');
      } else {
        alert('No Internet connection available.');
      }
      return;
    }

    if (sharedChatView && !currentUser) {
      setAuthModalMode('signin');
      return;
    }

    // Fail closed if signed in with locked regular encrypted history so new chats never overwrite or downgrade local encrypted history [Commented by: Google AI Studio on 28/11/2026 07:32]
    if (!isIncognito && currentUser && (!cryptoKey || isRegularHistoryLocked)) {
      const lockMsg =
        'Your encrypted regular chat history is locked. Open Settings > Account and enter your password to unlock before sending or saving regular chats.';
      if (isVoiceTurn) {
        setVoiceError(lockMsg);
      } else {
        setHistoryNotice(lockMsg);
      }
      setIsSettingsOpen(true);
      return;
    }

    // Determined API keys strictly from authenticated user profile, removing obsolete global env fallbacks [Commented by: Google AI Studio on 01/11/2026 04:18 PM]
    const orKey = currentUser?.openrouter_key || '';
    const tvKey = currentUser?.tavily_key || '';

    if (orKey.startsWith('enc:')) {
      if (isVoiceTurn) {
        setVoiceError('Your OpenRouter API Key is zero-knowledge encrypted. Unlock your credentials in Account Settings.');
      } else {
        setHistoryNotice('Your OpenRouter API Key is zero-knowledge encrypted. Open Settings > Account and enter your account password to unlock.');
      }
      setIsSettingsOpen(true);
      return;
    }

    // Require Tavily key (and unlock if encrypted) before starting Deep Research outside Voice mode [Commented by: Google AI Studio on 28/11/2026 06:58]
    if (!isVoiceTurn) {
      if (composerMode === 'deep_research' && tvKey.startsWith('enc:')) {
        setHistoryNotice('Your Tavily API Key is zero-knowledge encrypted. Open Settings > Account and enter your account password to unlock.');
        setIsSettingsOpen(true);
        return;
      }

      if (!tvKey && composerMode === 'deep_research') {
        setQuotaErrorNotice('Please Sign In or configure your Tavily API Key in Account Settings.');
        return;
      }
    }

    if (!orKey && (isVoiceTurn || composerMode !== 'deep_research')) {
      if (isVoiceTurn) {
        setVoiceError('Please Sign In or configure your OpenRouter API Key in Account Settings.');
      } else {
        setQuotaErrorNotice('Please Sign In or configure your OpenRouter API Key in Account Settings.');
      }
      return;
    }

    // Prepare User Message Content
    let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    const displayAttachments: Array<{ type: string; name: string; fileId?: string; isLocalMissing?: boolean }> = [];

    // Inject synthesized reader script template and extracted data preview into file context [Commented by: Google AI Studio on 19/10/2026 11:02 PM]
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

    // Create or locate noodle session (regular or incognito kept isolated) [Commented by: Google AI Studio on 28/11/2026 07:32]
    let chat = activeChat ? { ...activeChat, messages: [...activeChat.messages] } : undefined;
    let forkedFromShared = false;
    if (isEditMode && chat) {
      // Preserve history prior to edited message
      chat = {
        ...chat,
        messages: chat.messages.slice(0, editedMsgIndex)
      };
    } else if (!chat && sharedChatView) {
      chat = createForkedChatSession(sharedChatView) as ChatSession;
      forkedFromShared = true;
    } else if (!chat) {
      chat = {
        id: Date.now().toString(),
        title: promptSummary.slice(0, 30),
        messages: [],
        pinned: false,
        updated: Date.now()
      };
    }

    // Prepare User Message object before persistence check [Commented by: Google AI Studio on 28/11/2026 07:32]
    const createMessageId = () =>
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const existingLocalOutputs = chatFileOutputs[chat.id] || [];
    let localOutputsContext = '';
    if (attachments.length === 0 && existingLocalOutputs.length > 0) {
      existingLocalOutputs.forEach((out) => {
        localOutputsContext += `\n\n[Preserved AI Output for file: "${out.file_name}"]:\n(Note: Extracted file output is loaded from browser-local storage.)\n${out.output_content}\n`;
      });
    }

    const fullTextPrompt = trimmedPrompt + attachedFileContext + localOutputsContext;

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

    const updatedMessages: ChatMessage[] = [
      ...chat.messages,
      {
        id: createMessageId(),
        role: 'user',
        content: userContent,
        createdAt: new Date().toISOString(),
        displayAttachments,
        metadata: {
          composerMode: isVoiceTurn ? 'voice' : composerMode,
          ...(isVoiceTurn
            ? { mode: 'voice' }
            : composerMode === 'deep_research'
            ? { deepResearchTier: isSuperDeepResearch ? 'pro' : 'mini' }
            : {}),
        },
      }
    ];

    chat.messages = updatedMessages;
    chat.updated = Date.now();

    // Persist user message strictly to localStorage BEFORE starting generation or clearing composer input; abort and surface error on failure [Commented by: Google AI Studio on 28/11/2026 07:32]
    const userMsgSaved = await persistChat(chat);
    if (!userMsgSaved) {
      if (isVoiceTurn) {
        setVoiceError('Unable to save message locally in browser storage. Generation aborted.');
      }
      return;
    }

    setActiveChatId(chat.id);
    if (forkedFromShared) {
      setSharedChatView(null);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    // Save raw files strictly to browser IndexedDB and extracted file outputs strictly to browser localStorage (never Supabase) [Commented by: Google AI Studio on 28/11/2026 07:32]
    const outputScope = isIncognito ? 'incognito' : (currentUser ? currentUser.id : 'guest');
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

      if (!att.isImage) {
        const outputPayload = att.contentSnippet;
        saveLocalFileOutput(
          outputScope,
          {
            conversation_id: chat!.id,
            source_file_id: att.fileId,
            file_name: att.name,
            file_type: att.type,
            output_type: att.outputType,
            reader_code: att.generatedReaderCode || '',
            extracted_output: outputPayload,
            metadata: { size: att.size, isImage: att.isImage },
          },
          {
            cryptoKey: isIncognito ? null : cryptoKey,
            salt: currentUser?.salt,
            requireEncryption: Boolean(currentUser && !isIncognito),
          }
        )
          .then((saveRes) => {
            if (!saveRes.success) {
              if (saveRes.error) setQuotaErrorNotice(saveRes.error);
              return;
            }
            setChatFileOutputs((prev) => ({
              ...prev,
              [chat!.id]: [
                ...(prev[chat!.id] || []).filter((o) => o.source_file_id !== att.fileId),
                {
                  id: `out_${att.fileId}`,
                  conversation_id: chat!.id,
                  source_file_id: att.fileId,
                  file_name: att.name,
                  file_type: att.type,
                  output_type: att.outputType,
                  output_content: outputPayload + (att.generatedReaderCode ? `\n\n[Python Reader Script]:\n${att.generatedReaderCode}` : ''),
                  created_at: new Date().toISOString(),
                },
              ],
            }));
          })
          .catch((err) => {
            console.warn('saveLocalFileOutput notice:', err);
          });
      }
    });

    // Reset composer input if not in inline edit mode
    if (!isEditMode) {
      setInputText('');
      setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = `${INPUT_MIN_HEIGHT}px`;
    }

    // Initialize Generation
    setIsGenerating(true);
    // Reset auto-scroll flags: auto-scroll activates when user clicks down arrow after scrolling up [Commented by: Google AI Studio on 22/10/2026 04:51 PM]
    setIsUserScrolledUp(false);
    setIsAutoScrollActive(false);
    setCurrentReasoning('');
    setIsThinking(false);
    setReasoningAccordionOpen(false);
    setActiveSources([]);
    startStreamSmoothing();

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Route messages via composer Deep Research toggle for all users outside Voice mode once required keys are verified [Commented by: Google AI Studio on 28/11/2026 06:58]
    if (!isVoiceTurn) {
      if (composerMode === 'deep_research') {
        const isPro = isSuperDeepResearch;
        const researchQuery = trimmedPrompt || promptSummary;

        setCurrentStatus(`Deep Research (${isPro ? 'Super' : 'Standard'})...`);

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
            id: createMessageId(),
            role: 'ai',
            content: researchResult.content,
            createdAt: new Date().toISOString(),
            sources: researchResult.sources,
            metadata: {
              mode: 'deep_research',
              tier: isPro ? 'pro' : 'mini',
            },
          };

          chat.messages.push(aiMsg);
          // Generate concise descriptive title for new chat session parsing first user message and AI response [Commented by: Google AI Studio on 22/10/2026 04:51 PM]
          if (chat.messages.length === 2) {
            const firstUserContent = typeof chat.messages[0].content === 'string'
              ? chat.messages[0].content
              : '';
            chat.title = generateChatSessionTitle(firstUserContent, researchResult.content);
          }
          await persistChat(chat, { keepInMemoryOnError: true });
          setCurrentStatus(null);
        } catch (err: unknown) {
          const e = err as Error;
          const errMsg = e.name === 'AbortError' ? 'Research Stopped.' : e.message;
          chat.messages.push({
            id: createMessageId(),
            role: 'ai',
            content: errMsg,
            createdAt: new Date().toISOString(),
            metadata: { mode: 'deep_research', isError: e.name !== 'AbortError' },
          });
          await persistChat(chat, { keepInMemoryOnError: true });
          setCurrentStatus(null);
        } finally {
          setIsGenerating(false);
          stopStreamSmoothing();
        }
        return;
      }
    }

    // Configured system prompt with real MCP server tool definitions, Learn Step By Step tutor mode, Voice Fish Audio speech formatting, and URL scraping capability [Commented by: Google AI Studio on 28/11/2026 06:55]
    const customInstructions = currentUser?.ai_instructions || '';
    const learnStepByStepPrompt =
      !isVoiceTurn && composerMode === 'learn_step_by_step'
        ? `\n8. Learn Step By Step Mode (ACTIVE): Act as an encouraging, structured master tutor guiding the user step by step. Always organize explanations into clear, numbered progressive steps (Step 1, Step 2, Step 3, etc.). For each step: explain the intuition and "why" before technical details, provide a concrete worked example or analogy, point out common mistakes to avoid, and end with a brief comprehension check or next-step prompt so the user learns actively.`
        : '';
    const voiceModePrompt = isVoiceTurn ? buildVoiceSystemInstructions(selectedVoiceId) : '';
    // Updated system identity to source available AI chat bot [Commented by: Google AI Studio on 29/10/2026 09:00 PM]
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
7. File Reading Protocol: When a user provides, uploads, or refers to any file (documents, PDFs, spreadsheets, datasets, code, or arbitrary files except images), you must write and display the exact code (e.g. Python code using pandas, pypdf, openpyxl, docx, json, csv, or standard libraries) to read, inspect, and parse that file. Present this reader script in a dedicated code block starting with \`\`\`python. Then, explain the output of executing that code, present the extracted contents and data findings, and thoroughly answer the user's questions based on the file.${learnStepByStepPrompt}${voiceModePrompt}
${customInstructions ? `Custom User Instructions: ${customInstructions}` : ''}`;

    // Configured 1,000,000 input token context window for nvidia/nemotron-3.5-super-vl:free, strictly omitting model reasoning and raw code outputs [Commented by: Google AI Studio on 29/10/2026 09:20 PM]
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
    let searchTriggered = false; // [Commented by: Google AI Studio on 31/10/2026 10:44 PM]

    // Retrieve active MCP tools from connected providers for this user [Commented by: Google AI Studio on 31/10/2026 10:31 PM]
    const openRouterMcpTools: Array<{
      type: 'function';
      function: { name: string; description: string; parameters: Record<string, unknown> };
    }> = [];

    if (currentUser) {
      try {
        const mcpResponse = await workerClient.getMcpTools();
        if (mcpResponse.success && mcpResponse.data?.connections) {
          for (const conn of mcpResponse.data.connections) {
            if (conn.status === 'connected' && Array.isArray(conn.tools)) {
              for (const tool of conn.tools) {
                const namespacedName = `${conn.providerId}__${tool.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
                openRouterMcpTools.push({
                  type: 'function',
                  function: {
                    name: namespacedName,
                    description: `[${conn.providerId.toUpperCase()} MCP] ${tool.description}`,
                    parameters: (tool.inputSchema as Record<string, unknown>) || { type: 'object', properties: {} },
                  },
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn('Notice loading active MCP tools for session:', e);
      }
    }

    // Genuine tool-calling loop compatible with OpenRouter and Cloudflare Worker backend execution [Commented by: Google AI Studio on 31/10/2026 10:31 PM]
    async function runGeneration(messagesArr: typeof apiMessages, depth = 0) {
      if (depth > 5) return; // Prevent infinite tool execution loops
      setCurrentStatus(depth > 0 ? 'Analyzing Tool Results...' : 'Generating Answer...');

      // In Voice mode, enforce model_training OFF and reasoning disabled on Nemotron while keeping all tools enabled [Commented by: Google AI Studio on 28/11/2026 06:55]
      const optOutTraining = isVoiceTurn ? true : (isIncognito || currentUser?.model_training === false);
      const effectiveReasoningEffort = isVoiceTurn ? 'low' : reasoningEffort;

      // Configured dynamic OpenRouter reasoning parameter from Effort slider (Low=no reasoning, Medium, High) [Commented by: Google AI Studio at 22/11/2026 11:51]
      const reasoningConfig: Record<string, unknown> =
        effectiveReasoningEffort === 'low'
          ? { enabled: false }
          : effectiveReasoningEffort === 'high'
          ? { effort: 'high' }
          : { effort: 'medium' };

      const bodyPayload: Record<string, unknown> = {
        model: 'nvidia/nemotron-3.5-super-vl:free',
        temperature: 0.0,
        stream: true,
        reasoning: reasoningConfig,
        messages: messagesArr,
      };

      if (optOutTraining) {
        bodyPayload.provider = { data_collection: 'deny' };
      }

      // Supply dynamically discovered MCP tools to the model if providers are connected
      if (openRouterMcpTools.length > 0) {
        bodyPayload.tools = openRouterMcpTools;
        bodyPayload.tool_choice = 'auto';
      }

      let res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'nanobot',
        },
        body: JSON.stringify(bodyPayload),
        signal,
      });

      // If provider/tools/reasoning parameter format triggers HTTP 400, gracefully fall back across OpenRouter syntax variants
      if (!res.ok && res.status === 400) {
        if (bodyPayload.provider) {
          delete bodyPayload.provider;
          res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${orKey}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'nanobot',
            },
            body: JSON.stringify(bodyPayload),
            signal,
          });
        }

        if (!res.ok && res.status === 400 && bodyPayload.tools) {
          delete bodyPayload.tools;
          delete bodyPayload.tool_choice;
          res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${orKey}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'nanobot',
            },
            body: JSON.stringify(bodyPayload),
            signal,
          });
        }

        if (!res.ok && res.status === 400 && effectiveReasoningEffort === 'low' && (bodyPayload.reasoning as any)?.enabled === false) {
          bodyPayload.reasoning = { effort: 'none' };
          res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${orKey}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'nanobot',
            },
            body: JSON.stringify(bodyPayload),
            signal,
          });

          if (!res.ok && res.status === 400) {
            delete bodyPayload.reasoning;
            res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${orKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'nanobot',
              },
              body: JSON.stringify(bodyPayload),
              signal,
            });
          }
        }
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(interpretOpenRouterError(res.status, errText));
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Response stream unavailable.');

      const accumulatedToolCalls: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }> = [];

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

            // Accumulate streamed reasoning
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
                setIsThinking(true);
                setReasoningAccordionOpen(true);
              }
            }

            // Accumulate streamed tool calls
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!accumulatedToolCalls[idx]) {
                  accumulatedToolCalls[idx] = {
                    id: tc.id || `call_${Date.now()}_${idx}`,
                    type: 'function',
                    function: { name: '', arguments: '' },
                  };
                }
                if (tc.id) accumulatedToolCalls[idx].id = tc.id;
                if (tc.function?.name) accumulatedToolCalls[idx].function.name += tc.function.name;
                if (tc.function?.arguments) accumulatedToolCalls[idx].function.arguments += tc.function.arguments;
              }
            }

            // Accumulate content tokens (strip inline <voice>...</voice> selection wrapper from live Voice transcript display) [Commented by: Google AI Studio on 28/11/2026 06:55]
            const token = delta.content || '';
            if (token) {
              setIsThinking(false);
              setReasoningAccordionOpen(false);
              currentOutput += token;
              targetContentRef.current = isVoiceTurn
                ? currentOutput.replace(/<voice>[\s\S]*?<\/voice>/gi, '').trimStart()
                : currentOutput;
            }
          } catch {
            // Ignore partial stream parse errors
          }
        }
      }

      // Execute genuine MCP tools if the model emitted structured tool calls [Commented by: Google AI Studio on 31/10/2026 10:31 PM]
      if (accumulatedToolCalls.length > 0) {
        setCurrentStatus(`Executing ${accumulatedToolCalls.length} MCP tool${accumulatedToolCalls.length > 1 ? 's' : ''}...`);
        const toolMessages: Array<{ role: string; tool_call_id: string; name: string; content: string }> = [];

        for (const toolCall of accumulatedToolCalls) {
          const rawName = toolCall.function.name;
          const sepIdx = rawName.indexOf('__');
          const providerId = sepIdx !== -1 ? rawName.substring(0, sepIdx) : rawName;
          const toolName = sepIdx !== -1 ? rawName.substring(sepIdx + 2) : rawName;

          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
          } catch {
            parsedArgs = {};
          }

          setCurrentStatus(`Executing ${providerId} tool: ${toolName}...`);
          let toolResultText = '';

          try {
            const callRes = await workerClient.callMcpTool(providerId, toolName, parsedArgs);
            if (callRes.success && callRes.data?.result) {
              const contentParts = callRes.data.result.content || [];
              toolResultText = contentParts.map((p) => p.text).join('\n') || JSON.stringify(callRes.data.result);
            } else {
              toolResultText = `Tool execution failed: ${callRes.error || 'Unknown error'}`;
            }
          } catch (execErr: unknown) {
            const err = execErr as Error;
            toolResultText = `Tool call exception: ${err.message}`;
          }

          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: rawName,
            content: toolResultText,
          });
        }

        const nextApiMessages: typeof apiMessages = [
          ...messagesArr,
          {
            role: 'assistant',
            content: currentOutput || null,
            ...(accumulatedToolCalls.length > 0 ? { tool_calls: accumulatedToolCalls } : {}),
          } as any,
          ...toolMessages as any,
        ];

        currentOutput = '';
        targetContentRef.current = '';
        await runGeneration(nextApiMessages, depth + 1);
        return;
      }


      // Processed Scraping and Search tags with exact regex and single-use tool lifecycle [Commented by: Google AI Studio on 19/10/2026 02:25 PM]
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

      // Resolve Fish Audio voice selection (including Random <voice>...</voice> tag parsing) and strip wrapper tag from stored answer [Commented by: Google AI Studio on 28/11/2026 06:55]
      const voiceResolution = isVoiceTurn
        ? extractVoiceChoiceFromResponse(currentOutput, selectedVoiceId)
        : null;
      const finalAssistantText = voiceResolution ? voiceResolution.cleanedText : currentOutput;
      targetContentRef.current = finalAssistantText;
      setStreamDisplayContent(finalAssistantText);

      const aiMessage: ChatMessage = {
        id: createMessageId(),
        role: 'ai',
        content: finalAssistantText,
        createdAt: new Date().toISOString(),
        sources: accumulatedSources,
        reasoning: reasoningText,
        metadata: {
          model: 'nvidia/nemotron-3.5-super-vl:free',
          reasoningEffort: isVoiceTurn ? 'none' : reasoningEffort,
          composerMode: isVoiceTurn ? 'voice' : composerMode,
          ...(voiceResolution
            ? {
                mode: 'voice',
                voiceId: voiceResolution.resolvedVoiceId,
                voiceName: voiceResolution.resolvedVoiceName,
              }
            : {}),
        },
      };

      chat.messages.push(aiMessage);
      // Generate concise descriptive title for new chat session parsing first user message and AI response [Commented by: Google AI Studio on 22/10/2026 04:51 PM]
      if (chat.messages.length === 2) {
        const firstUserContent = typeof chat.messages[0].content === 'string'
          ? chat.messages[0].content
          : Array.isArray(chat.messages[0].content)
          ? chat.messages[0].content.find((c) => c.type === 'text')?.text || ''
          : '';
        chat.title = generateChatSessionTitle(firstUserContent, finalAssistantText);
      }
      await persistChat(chat, { keepInMemoryOnError: true });

      // Persist AI-generated file reading reader_code outputs strictly to browser localStorage (never Supabase) [Commented by: Google AI Studio on 28/11/2026 07:32]
      if (chat) {
        const codeBlockMatch = finalAssistantText.match(/```(?:python|py)?([\s\S]*?)```/i);
        if (codeBlockMatch) {
          saveLocalFileOutput(
            outputScope,
            {
              conversation_id: chat.id,
              source_file_id: `ai_gen_${Date.now()}`,
              file_name: 'AI Generated Reader Script',
              file_type: 'text/x-python',
              output_type: 'code_execution',
              reader_code: codeBlockMatch[1].trim(),
              extracted_output: finalAssistantText.slice(0, 8000),
              metadata: { hasCode: true },
            },
            {
              cryptoKey: isIncognito ? null : cryptoKey,
              salt: currentUser?.salt,
              requireEncryption: Boolean(currentUser && !isIncognito),
            }
          )
            .then((saveRes) => {
              if (!saveRes.success && saveRes.error) {
                setQuotaErrorNotice(saveRes.error);
              }
            })
            .catch(() => {});
        }
      }

      // Synthesize speech via fish-audio/s2.1-pro-free:free respecting user's model_training preference and play audio automatically [Commented by: Google AI Studio on 28/11/2026 06:55]
      if (isVoiceTurn && voiceResolution && !signal.aborted && finalAssistantText.trim()) {
        setVoiceError(null);
        setIsSynthesizingAudio(true);
        setCurrentStatus(`Generating Voice Audio (${voiceResolution.resolvedVoiceName})...`);
        try {
          if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current = null;
          }
          setIsPlayingAudio(false);
          if (currentAudioUrlRef.current) {
            URL.revokeObjectURL(currentAudioUrlRef.current);
            currentAudioUrlRef.current = null;
          }

          const speechResult = await synthesizeFishSpeech({
            openrouterKey: orKey,
            text: finalAssistantText,
            voiceId: voiceResolution.resolvedVoiceId,
            modelTrainingEnabled: !isIncognito && currentUser?.model_training !== false,
            signal,
          });

          currentAudioUrlRef.current = speechResult.audioUrl;
          setLastAudioUrl(speechResult.audioUrl);
          setActiveVoiceLabel(voiceResolution.resolvedVoiceName);
          setAudioGenerationId(speechResult.generationId);

          const audio = new Audio(speechResult.audioUrl);
          audioElementRef.current = audio;
          audio.onplay = () => setIsPlayingAudio(true);
          audio.onended = () => setIsPlayingAudio(false);
          audio.onerror = () => {
            setIsPlayingAudio(false);
            setVoiceError('Generated audio failed during playback.');
          };

          try {
            await audio.play();
            setIsPlayingAudio(true);
          } catch {
            setVoiceError('Audio ready — click Play Audio to listen.');
          }
        } catch (ttsErr: unknown) {
          const tErr = ttsErr as Error;
          if (tErr.name !== 'AbortError') {
            setVoiceError(tErr.message || 'Voice audio generation failed.');
          }
        } finally {
          setIsSynthesizingAudio(false);
        }
      }
    } catch (err: unknown) {
      stopStreamSmoothing();
      const e = err as Error;
      if (e.name === 'AbortError') {
        const stoppedMsg: ChatMessage = {
          id: createMessageId(),
          role: 'ai',
          content: currentOutput || 'Stopped',
          createdAt: new Date().toISOString(),
          sources: accumulatedSources,
          reasoning: reasoningText,
          metadata: { aborted: true },
        };
        chat.messages.push(stoppedMsg);
        await persistChat(chat, { keepInMemoryOnError: true });
      } else {
        const errorMsg = e.message.startsWith('OpenRouter Error:') ? e.message : `OpenRouter Error: ${e.message}`;
        chat.messages.push({
          id: createMessageId(),
          role: 'ai',
          content: errorMsg,
          createdAt: new Date().toISOString(),
          metadata: { isError: true },
        });
        await persistChat(chat, { keepInMemoryOnError: true });
      }
    } finally {
      setIsGenerating(false);
      setCurrentStatus(null);
      setIsThinking(false);
      setReasoningAccordionOpen(false);
    }
  };

  // User message inline edit resend handler [Commented by: Google AI Studio on 28/10/2026 11:58 PM]
  const handleResendEditedMessage = async (msgIndex: number, newText: string) => {
    setEditingMessageIndex(null);
    setEditText('');
    await handleSend(newText, msgIndex);
  };

  // Start or stop Web Speech API microphone capture and auto-send transcribed voice input to Nemotron + Fish Audio [Commented by: Google AI Studio on 28/11/2026 06:55]
  const handleToggleVoiceMicrophone = () => {
    if (isGenerating) {
      handleSend(undefined, undefined, { isVoiceTurn: true });
      return;
    }

    if (isListeningVoice) {
      shouldSubmitVoiceRef.current = true;
      try {
        speechRecognitionRef.current?.stop();
      } catch {
        setIsListeningVoice(false);
      }
      return;
    }

    if (!isOnline) {
      setVoiceError('No Internet connection available.');
      return;
    }

    if (!currentUser) {
      setVoiceError('Please Sign In or configure your OpenRouter API Key in Account Settings.');
      return;
    }

    const orKey = currentUser.openrouter_key || '';
    if (orKey.startsWith('enc:')) {
      setVoiceError('Your OpenRouter API Key is zero-knowledge encrypted. Unlock your credentials in Account Settings.');
      setIsSettingsOpen(true);
      return;
    }
    if (!orKey) {
      setVoiceError('Please configure your OpenRouter API Key in Account Settings before starting Voice Chat.');
      return;
    }

    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setVoiceError('Your browser does not support Web Speech API voice input. Please try Chrome, Edge, or Safari.');
      return;
    }

    try {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        setIsPlayingAudio(false);
      }

      const recognition = new SpeechRecognitionCtor();
      recognition.lang = navigator.language || 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      latestVoiceTranscriptRef.current = '';
      shouldSubmitVoiceRef.current = true;
      speechRecognitionRef.current = recognition;

      recognition.onstart = () => {
        setVoiceError(null);
        setIsListeningVoice(true);
        setHasVoiceSessionStarted(true);
        setLiveSpeechInterim('');
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = 0; i < event.results.length; i += 1) {
          const piece = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalTranscript += piece;
          } else {
            interimTranscript += piece;
          }
        }
        const combined = `${finalTranscript} ${interimTranscript}`.trim();
        latestVoiceTranscriptRef.current = combined;
        setLiveSpeechInterim(combined);
      };

      recognition.onerror = (event: any) => {
        const errCode = String(event?.error || '');
        if (errCode === 'aborted') {
          setIsListeningVoice(false);
          return;
        }
        shouldSubmitVoiceRef.current = false;
        setIsListeningVoice(false);
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          setVoiceError('Microphone access was denied. Please allow microphone permission in your browser.');
        } else if (errCode === 'no-speech') {
          setVoiceError('No speech detected. Click the microphone button and speak clearly.');
        } else if (errCode === 'audio-capture') {
          setVoiceError('No microphone device detected.');
        } else {
          setVoiceError(`Voice recognition error (${errCode || 'unknown'}). Please try again.`);
        }
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
        speechRecognitionRef.current = null;
        const captured = latestVoiceTranscriptRef.current.trim();
        latestVoiceTranscriptRef.current = '';
        setLiveSpeechInterim('');
        if (shouldSubmitVoiceRef.current && (captured || attachments.length > 0)) {
          shouldSubmitVoiceRef.current = false;
          void handleSend(captured || 'Analyze attached files', undefined, { isVoiceTurn: true });
        }
      };

      recognition.start();
    } catch (err: unknown) {
      const e = err as Error;
      setIsListeningVoice(false);
      setVoiceError(e.message || 'Failed to start microphone voice input.');
    }
  };

  // Clear either incognito history explicitly OR unpinned regular history strictly from browser localStorage [Commented by: Google AI Studio on 28/11/2026 07:32]
  const handleClearChatHistory = async () => {
    if (isIncognito) {
      const toRemove = incognitoChatsRef.current;
      clearIncognitoHistoryLocally();
      setIncognitoChats([]);
      incognitoChatsRef.current = [];
      toRemove.forEach((c) => {
        deleteLocalConversationArtifacts('incognito', c.id);
        deleteOriginalFilesForChat(c.id).catch(() => {});
      });
      handleStartNewChat();
      return;
    }

    if (currentUser && (!cryptoKey || isRegularHistoryLocked)) {
      setHistoryNotice('Your encrypted regular history is locked. Open Settings > Account and enter your password to unlock before modifying.');
      setIsSettingsOpen(true);
      return;
    }

    const currentRegular = chatsRef.current;
    const remaining = currentRegular.filter((c) => Boolean(c.pinned));
    const saved = await persistChatsList(remaining, { incognito: false });
    if (!saved) return;

    const scope = currentUser ? currentUser.id : 'guest';
    currentRegular.forEach((c) => {
      if (!c.pinned) {
        deleteLocalConversationArtifacts(scope, c.id);
        deleteOriginalFilesForChat(c.id).catch(() => {});
      }
    });

    const wasActiveCleared = currentRegular.some((c) => !c.pinned && c.id === activeChatId);
    if (wasActiveCleared || !activeChatId) {
      handleStartNewChat();
    }
  };

  // Toggle noodle pin with stable persistence strictly in browser localStorage (separated by regular vs incognito) [Commented by: Google AI Studio on 28/11/2026 07:32]
  const handleTogglePin = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isIncognito && currentUser && (!cryptoKey || isRegularHistoryLocked)) {
      setHistoryNotice('Your encrypted regular history is locked. Unlock it in Settings > Account first.');
      setIsSettingsOpen(true);
      return;
    }
    const sourceList = isIncognito ? incognitoChatsRef.current : chatsRef.current;
    const updated = sourceList.map((c) => (c.id === id ? { ...c, pinned: !Boolean(c.pinned) } : c));
    const sorted = [...updated].sort(
      (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || 0) - (a.updated || 0)
    );
    await persistChatsList(sorted, { incognito: isIncognito });
  };

  // Delete individual regular or incognito noodle and its browser-local files/outputs (never touches Supabase or Worker D1) [Commented by: Google AI Studio on 28/11/2026 07:32]
  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isIncognito && currentUser && (!cryptoKey || isRegularHistoryLocked)) {
      setHistoryNotice('Your encrypted regular history is locked. Unlock it in Settings > Account first.');
      setIsSettingsOpen(true);
      return;
    }
    const sourceList = isIncognito ? incognitoChatsRef.current : chatsRef.current;
    const nextList = sourceList.filter((c) => c.id !== id);
    const saved = await persistChatsList(nextList, { incognito: isIncognito });
    if (!saved) return;

    const scope = isIncognito ? 'incognito' : (currentUser ? currentUser.id : 'guest');
    deleteOriginalFilesForChat(id).catch(() => {});
    deleteLocalConversationArtifacts(scope, id);
    if (activeChatId === id) handleStartNewChat();
  };

  // Rename regular or incognito noodle strictly in browser localStorage [Commented by: Google AI Studio on 28/11/2026 07:32]
  const handleRenameChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isIncognito && currentUser && (!cryptoKey || isRegularHistoryLocked)) {
      setHistoryNotice('Your encrypted regular history is locked. Unlock it in Settings > Account first.');
      setIsSettingsOpen(true);
      return;
    }
    const sourceList = isIncognito ? incognitoChatsRef.current : chatsRef.current;
    const chat = sourceList.find((c) => c.id === id);
    const nextTitle = prompt('Rename noodle:', chat?.title)?.trim();
    if (nextTitle) {
      const nextList = sourceList.map((c) =>
        c.id === id ? { ...c, title: nextTitle.slice(0, 50) } : c
      );
      await persistChatsList(nextList, { incognito: isIncognito });
    }
  };

  // Auto-resize composer textarea
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = `${INPUT_MIN_HEIGHT}px`;
    e.target.style.height = `${Math.max(e.target.scrollHeight, INPUT_MIN_HEIGHT)}px`;
  };

  // Filter chat history sessions by title match for active regular or incognito view [Commented by: Google AI Studio on 28/11/2026 07:32]
  const filteredChats = currentUser && historySearchQuery.trim()
    ? visibleChats.filter((c) => {
        const query = historySearchQuery.trim().toLowerCase();
        const title = (c.title || 'Untitled Chat').toLowerCase();
        return title.includes(query);
      })
    : visibleChats;

  // Helper to extract clean preview text from ChatMessage content [Commented by: Google AI Studio on 23/10/2026 12:38 PM]
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

  // Quick preview hover handler reading strictly from browser-local chat state (never Worker getMessages) [Commented by: Google AI Studio on 28/11/2026 07:32]
  const handleChatTitleMouseEnter = (chat: ChatSession, e: React.MouseEvent<HTMLElement>) => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
    const target = e.currentTarget;
    previewTimerRef.current = window.setTimeout(() => {
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

      setQuickPreview({
        chatId: chat.id,
        title: chat.title || 'Untitled Chat',
        x,
        y,
        messages: [],
        isLoading: false
      });
    }, 140);
  };

  const handleChatTitleMouseLeave = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setQuickPreview(null);
  };

  // Rendered container with dynamic theme classes for Neon Black and Minimalist Light [Commented by: Google AI Studio on 20/10/2026 11:32 PM]
  return (
    <div className={`flex h-screen w-screen relative overflow-hidden transition-colors duration-200 ${
      theme === 'Minimalist Light' ? 'bg-[#f8f9fa] text-neutral-900' : 'bg-black text-white'
    }`}>
      {/* SIDEBAR */}
      {/* Slide-over drawer animation for mobile history sidebar with smooth 300ms ease-in-out transition  [Commented by: Google AI Studio on 22/10/2026 04:51 PM] */}
      <aside
        className={`${
          sidebarOpen ? 'max-sm:translate-x-0 sm:flex sm:w-[300px]' : 'max-sm:-translate-x-full sm:hidden'
        } max-sm:fixed max-sm:inset-0 max-sm:w-screen max-sm:h-screen max-sm:z-40 max-sm:flex w-[300px] h-full flex-col p-[15px] z-40 shrink-0 transform transition-transform duration-300 ease-in-out transition-colors ${
          theme === 'Minimalist Light'
            ? 'bg-white max-sm:bg-white border-r border-[#e5e7eb] text-neutral-900 shadow-2xl sm:shadow-none'
            : 'bg-[#0a0a0a] max-sm:bg-[#0a0a0a] border-r border-[#262626] text-white shadow-2xl sm:shadow-none'
        }`}
      >
        {/* Sidebar header distinguishing Regular vs Incognito local history [Commented by: Google AI Studio on 28/11/2026 07:32] */}
        <div className={`flex items-center justify-between pb-3 border-b mb-3 ${
          theme === 'Minimalist Light' ? 'border-[#e5e7eb]' : 'border-[#262626]'
        }`}>
          <h3 className={`font-semibold text-base tracking-wide ${sidebarOpen ? 'max-sm:pr-12' : ''} ${
            theme === 'Minimalist Light' ? 'text-neutral-800' : 'text-neutral-300'
          }`}>
            {isIncognito ? 'Incognito History 🕶️' : 'Noodle History ◴'}
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
              className={`w-full rounded-lg pl-8 pr-7 py-1.5 text-xs transition-colors focus:outline-none accent-focus-border ${
                theme === 'Minimalist Light'
                  ? 'bg-neutral-100 border border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:bg-white'
                  : 'bg-[#141414] border border-[#262626] text-white placeholder-neutral-500'
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

        {/* Locked encrypted regular history prompt when signed in without unlocked password key [Commented by: Google AI Studio on 28/11/2026 07:32] */}
        {!isIncognito && currentUser && isRegularHistoryLocked && (
          <div className="bg-amber-950/80 border border-amber-500/40 text-amber-200 px-2.5 py-2 rounded-lg text-[10.5px] mb-2 space-y-1.5">
            <div className="font-semibold">🔒 Encrypted History Locked</div>
            <div className="leading-snug opacity-90">
              Enter your account password in Settings &gt; Account to unlock your saved regular chats.
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 font-semibold cursor-pointer"
            >
              Unlock History
            </button>
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
        {/* Non-intrusive localStorage/IndexedDB quota warning [Commented by: Google AI Studio on 28/11/2026 07:32] */}
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
          {visibleChats.length === 0 ? (
            <div className="text-sm text-neutral-500 p-2 italic">
              {isIncognito ? 'No incognito noodles yet' : 'No noodle history yet'}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-xs text-neutral-500 p-2 italic text-center space-y-1.5">
              <div>No noodles matching &quot;{historySearchQuery}&quot;</div>
              <button
                onClick={() => setHistorySearchQuery('')}
                className="text-[11px] accent-text hover:underline cursor-pointer"
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
                      ? 'bg-neutral-100 text-neutral-900 font-semibold border-l-2 accent-border shadow-xs'
                      : 'bg-[#222] text-white border-l-2 accent-border'
                    : theme === 'Minimalist Light'
                    ? 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    : 'text-neutral-400 hover:bg-[#151515] hover:text-white'
                }`}
              >
                {/* Noodle title with search highlighting and quick preview on hover without selecting [Commented by: Google AI Studio on 29/10/2026 04:00 PM] */}
                <span
                  onMouseEnter={(e) => handleChatTitleMouseEnter(c, e)}
                  onMouseLeave={handleChatTitleMouseLeave}
                  className="truncate max-w-[170px] accent-hover-text transition-colors"
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
            {isIncognito ? 'Clear Incognito History' : 'Clear Noodle History'}
          </button>

          {/* Render Settings button for signed-in users or 'About nanobot' button in exact same position for non-signed-in users  [Commented by: Google AI Studio on 20/10/2026 11:32 PM] */}
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
      {/* When mobile sidebar is opened, this sidebar button rides on top with z-50 in the top-right, while all other buttons, chat box, and text disappear  [Commented by: Google AI Studio on 21/10/2026 05:45 PM] */}
      <main className="flex-1 relative flex flex-col items-center h-full overflow-hidden">
        {/* Top Controls (Left: Sidebar Toggle & New Noodle; positioned in top-right aligned with History divider line on mobile when sidebar is open) */}
        {/* Moved button a bit upwards on mobile with max-sm:top-[11px] to perfectly align bottom edge with divider line under History text  [Commented by: Google AI Studio on 21/10/2026 06:08 PM] */}
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
            onClick={() => {
              setWorkspaceMode('chat');
              handleStartNewChat();
            }}
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

        {/* Top-Middle Workspace Mode Switcher ('Chat', 'Agent', 'Voice') visible in new chat interface [Commented by: Google AI Studio on 28/11/2026 06:55] */}
        {!activeChat && !sharedChatView && !hasVoiceSessionStarted && (
          <div
            role="tablist"
            aria-label="Workspace mode"
            className={`absolute top-4 max-sm:top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1 rounded-xl border transition-colors ${
              sidebarOpen ? 'max-sm:hidden' : ''
            } ${
              theme === 'Minimalist Light'
                ? 'bg-white/95 border-neutral-300 shadow-sm'
                : 'bg-[#0d0d0d]/95 border-[#2b2b2b]'
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={workspaceMode === 'chat'}
              onClick={() => {
                setWorkspaceMode('chat');
                handleStartNewChat();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                workspaceMode === 'chat'
                  ? 'accent-btn shadow-xs'
                  : theme === 'Minimalist Light'
                  ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                  : 'text-neutral-400 hover:text-white hover:bg-[#1a1a1a]'
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspaceMode === 'agent'}
              onClick={() => {
                stopVoiceAndAudio();
                setVoiceError(null);
                setWorkspaceMode('agent');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                workspaceMode === 'agent'
                  ? 'accent-btn shadow-xs'
                  : theme === 'Minimalist Light'
                  ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                  : 'text-neutral-400 hover:text-white hover:bg-[#1a1a1a]'
              }`}
            >
              Agent
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspaceMode === 'voice'}
              onClick={() => {
                setVoiceError(null);
                setWorkspaceMode('voice');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                workspaceMode === 'voice'
                  ? 'accent-btn shadow-xs'
                  : theme === 'Minimalist Light'
                  ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                  : 'text-neutral-400 hover:text-white hover:bg-[#1a1a1a]'
              }`}
            >
              Voice
            </button>
          </div>
        )}

        {/* Top-Right Controls */}
        {/* Responsive layout placing 'Import Shared Noodle' below 'Sign In' and 'Sign Up' on mobile to prevent button overlap [Commented by: Google AI Studio on 30/10/2026 11:00 PM] */}
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
                  {/* Incognito Noodle switch persisting mode flag locally without deleting incognito history on toggle off [Commented by: Google AI Studio on 28/11/2026 07:32] */}
                  <div className="flex items-center justify-between px-3 py-2 hover:bg-neutral-800/40 rounded-lg">
                    <span className="font-medium">Incognito Noodle</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isIncognito}
                      onClick={() => {
                        const next = !isIncognito;
                        setIsIncognito(next);
                        setIncognitoModeFlagLocally(next);
                        setActiveChatId(null);
                        setSharedChatView(null);
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isIncognito ? 'accent-solid-bg' : 'bg-neutral-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                          isIncognito ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Direct Import Noodle URL trigger [Commented by: Google AI Studio on 30/10/2026 11:00 PM] */}
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
            /* Signed-In Running Noodle (>0 messages): borderless three-dot menu with Share (disabled notice in Incognito) and Export as JSON */
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
                <div className={`absolute right-0 top-full mt-2 w-60 rounded-xl py-2 px-1 text-xs shadow-2xl z-50 border ${
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
                    className={`w-full text-left px-3 py-2 hover:bg-neutral-800/40 rounded-lg font-medium cursor-pointer transition-colors ${
                      isIncognito ? 'opacity-65' : ''
                    }`}
                  >
                    <div>
                      {isSharing
                        ? 'Sharing...'
                        : isIncognito
                          ? 'Share (Unavailable in Incognito)'
                          : activeChat?.shareId
                            ? 'Update Share Link'
                            : 'Share'}
                    </div>
                    <div className="text-[10px] opacity-70 font-normal leading-snug mt-0.5">
                      {isIncognito
                        ? 'Turn off Incognito to share a public 30-day link.'
                        : activeChat?.shareId
                          ? 'Update public 30-day Cloudflare D1 snapshot under this link.'
                          : 'Public link in Cloudflare D1 (30-day expiry or until revoked).'}
                    </div>
                  </button>
                  {/* Owner-only immediate share revocation trigger opening confirmation dialog [Commented by: Google AI Studio at 24/11/2026 22:57] */}
                  {activeChat?.shareId && !isIncognito && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsRunningNoodleMenuOpen(false);
                        requestRevokeShareForChat(activeChat);
                      }}
                      disabled={isRevokingShare}
                      className="w-full text-left px-3 py-2 hover:bg-red-950/50 text-red-400 hover:text-red-300 rounded-lg font-medium cursor-pointer transition-colors"
                    >
                      <div>{isRevokingShare ? 'Revoking...' : 'Revoke Share Link'}</div>
                      <div className="text-[10px] opacity-75 font-normal leading-snug mt-0.5">
                        Immediately disable the public link without deleting private history.
                      </div>
                    </button>
                  )}
                  {/* Client-side JSON backup export button [Commented by: Google AI Studio at 22/11/2026 14:33] */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRunningNoodleMenuOpen(false);
                      handleExportActiveChat();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-800/40 rounded-lg font-medium cursor-pointer transition-colors flex items-center gap-2"
                  >
                    <span className="font-mono text-[11px] opacity-80">{'{}'}</span>
                    <span>Export as JSON</span>
                  </button>
                </div>
              )}
            </div>
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
        {!activeChat && !sharedChatView && !hasVoiceSessionStarted && !isListeningVoice && (
          <h1 className={`absolute top-[19vh] text-[3.5rem] font-bold font-serif tracking-tight pointer-events-none select-none transition-colors ${
            sidebarOpen ? 'max-sm:hidden' : ''
          } ${
            theme === 'Minimalist Light' ? 'text-neutral-900' : 'text-white'
          }`}>
            nanobot
          </h1>
        )}

        {/* Chat Messages Area (also shows live speech recognition transcript, tool statuses, and response stream in Voice mode) [Commented by: Google AI Studio on 28/11/2026 06:55] */}
        {/* Attached onScroll listener for user scroll detection during active AI streaming  [Commented by: Google AI Studio on 22/10/2026 04:51 PM] */}
        <div
          ref={chatAreaRef}
          onScroll={handleChatScroll}
          className={`w-full flex-1 overflow-y-auto px-4 md:px-12 pt-20 pb-44 flex flex-col gap-6 ${
            sidebarOpen ? 'max-sm:hidden' : ''
          } ${
            !activeChat && !sharedChatView && !hasVoiceSessionStarted && !isListeningVoice && !isGenerating ? 'hidden' : 'flex'
          }`}
        >
          {/* Shared Chat Session Banner */}
          {/* View-only shared chat notification banner with accurate public Cloudflare D1 disclosure & fork action [Commented by: Google AI Studio at 24/11/2026 17:13] */}
          {sharedChatView && (
            <div className="p-4 rounded-xl border accent-soft-box flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2 animate-in fade-in duration-200">
              <div className="space-y-1">
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  <span>🔗 Shared Noodle (Read-Only):</span>
                  <span className="font-bold">{sharedChatView.title}</span>
                </div>
                <div className="text-[11px] opacity-85 leading-relaxed">
                  {SHARED_NOODLE_PRIVACY_DISCLOSURE}
                  {sharedChatView.expires_at && !Number.isNaN(Date.parse(sharedChatView.expires_at))
                    ? ` (Expires ${new Date(sharedChatView.expires_at).toLocaleDateString()})`
                    : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={handleContinueSharedChat}
                className="px-4 py-2 rounded-lg accent-btn font-semibold text-xs transition-colors cursor-pointer shrink-0 shadow-sm"
              >
                {currentUser ? 'Continue this chat ➔' : 'Sign in to fork & continue ➔'}
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
                      <div className={`p-3 rounded-2xl w-full border accent-border shadow-lg ${
                        theme === 'Minimalist Light'
                          ? 'bg-white'
                          : 'bg-[#181818]'
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
                              className="px-3 py-1 rounded accent-btn font-semibold cursor-pointer"
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
                                      title="Original file bytes stored in browser IndexedDB only. Preserved extracted output loaded from browser localStorage."
                                    >
                                      (Original file unavailable in IndexedDB • Local output active)
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
                      <div className="mb-3 border-l-2 accent-border-soft pl-3 py-1">
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
                        type="button"
                        onClick={() => {
                          void copyTextToClipboard(textContent);
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

              {/* Live Web Speech API user transcript preview while speaking in Voice mode [Commented by: Google AI Studio on 28/11/2026 06:55] */}
              {isListeningVoice && (
                <div className="flex flex-col items-end w-full">
                  <div className={`px-4 py-3 rounded-2xl max-w-[85%] md:max-w-[75%] text-sm leading-relaxed border accent-border-soft ${
                    theme === 'Minimalist Light'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'bg-[#181818] text-neutral-100'
                  }`}>
                    <div className="text-[10px] uppercase tracking-wider font-semibold accent-text mb-1">
                      Listening (Live Transcript)...
                    </div>
                    <div>{liveSpeechInterim || 'Speak now...'}</div>
                  </div>
                </div>
              )}

              {/* Inline reasoning accordion: Thinking ▼ while thinking; auto-closes and reverts to Thinking ▲ when answer streams [Commented by: Google AI Studio on 30/10/2026 11:00 PM] */}
              {currentReasoning && (
                <div className="mb-3 border-l-2 accent-border-soft pl-3 py-1">
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

          {/* Live Web Speech API transcript bubble shown before generation starts [Commented by: Google AI Studio on 28/11/2026 06:55] */}
          {!isGenerating && isListeningVoice && (
            <div className="flex flex-col items-end w-full">
              <div className={`px-4 py-3 rounded-2xl max-w-[85%] md:max-w-[75%] text-sm leading-relaxed border accent-border-soft ${
                theme === 'Minimalist Light'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'bg-[#181818] text-neutral-100'
              }`}>
                <div className="text-[10px] uppercase tracking-wider font-semibold accent-text mb-1">
                  Listening (Live Transcript)...
                </div>
                <div>{liveSpeechInterim || 'Speak now...'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Composer Wrap (moves smoothly down when active chat or Voice session is active) [Commented by: Google AI Studio on 28/11/2026 06:55] */}
        {/* Moved chat box slightly downwards to top-[34vh] so the neon aura does not touch the nanobot title text  [Commented by: Google AI Studio on 21/10/2026 06:17 PM] */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-full max-w-[750px] px-4 transition-all duration-300 z-20 ${
            sidebarOpen ? 'max-sm:hidden' : ''
          } ${
            activeChat || sharedChatView || hasVoiceSessionStarted || isListeningVoice ? 'bottom-[45px]' : 'top-[34vh]'
          }`}
        >
          {/* Auto-scroll Snap Button: Appears when user scrolls up during active streaming; clicking snaps to bottom and activates auto-scroll */}
          {/* Down arrow floating button snapped to the bottom to resume auto-scroll streaming  [Commented by: Google AI Studio on 22/10/2026 04:51 PM] */}
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
                <svg className="w-4 h-4 accent-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            </div>
          )}

          {/* Locked encrypted regular history prompt above composer [Commented by: Google AI Studio on 28/11/2026 07:32] */}
          {!isIncognito && currentUser && isRegularHistoryLocked && (
            <div className="mb-2 px-3 py-2 rounded-lg bg-amber-950/85 border border-amber-500/50 text-amber-100 text-xs flex items-center justify-between gap-2 shadow-lg">
              <span>🔒 Encrypted regular history is locked. Unlock it in Settings &gt; Account to view or save regular chats.</span>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 font-semibold cursor-pointer shrink-0"
              >
                Unlock
              </button>
            </div>
          )}
          {/* Storage quota and persistence notices [Commented by: Google AI Studio on 28/11/2026 07:32] */}
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
          {exportStatusNotice && (
            <div
              className={`mb-2 px-3 py-1.5 rounded-lg border text-xs flex items-center justify-between shadow-lg ${
                exportStatusNotice.type === 'error'
                  ? 'bg-red-950/80 border-red-600/60 text-red-200'
                  : 'accent-soft-box'
              }`}
            >
              <span>{exportStatusNotice.type === 'error' ? '⚠️' : '✓'} {exportStatusNotice.text}</span>
              <button
                type="button"
                onClick={() => setExportStatusNotice(null)}
                className="opacity-70 hover:opacity-100 ml-2 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          )}
          {isLoadingSharedChat && (
            <div className="mb-2 px-3 py-1.5 rounded-lg bg-blue-950/70 border border-blue-700/60 text-blue-200 text-xs shadow-lg">
              Loading shared noodle snapshot...
            </div>
          )}
          {shareStatusNotice && (
            <div
              role="status"
              className={`mb-2 px-3 py-2 rounded-lg border text-xs shadow-lg space-y-1.5 ${
                shareStatusNotice.type === 'error'
                  ? 'bg-red-950/85 border-red-600/60 text-red-200'
                  : shareStatusNotice.type === 'warning'
                    ? 'bg-amber-950/85 border-amber-600/60 text-amber-200'
                    : 'accent-soft-box'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">
                  {shareStatusNotice.type === 'error' ? '⚠️' : shareStatusNotice.type === 'warning' ? '⚠️' : '✓'} {shareStatusNotice.text}
                </span>
                <button
                  type="button"
                  onClick={() => setShareStatusNotice(null)}
                  aria-label="Dismiss share notice"
                  className="opacity-70 hover:opacity-100 ml-2 cursor-pointer font-bold shrink-0"
                >
                  ✕
                </button>
              </div>
              {shareStatusNotice.shareUrl && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareStatusNotice.shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label="Share URL"
                      className="flex-1 bg-black/40 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const url = shareStatusNotice.shareUrl || '';
                        const res = await copyTextToClipboard(url);
                        if (res.copied) {
                          setShareStatusNotice((prev) =>
                            prev ? { ...prev, type: 'success', text: 'Share link copied to clipboard.', copied: true } : prev
                          );
                        } else {
                          setShareStatusNotice((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  type: 'warning',
                                  text: 'Clipboard access blocked by browser. Please select and copy the link manually:',
                                  copied: false,
                                }
                              : prev
                          );
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold cursor-pointer shrink-0"
                    >
                      {shareStatusNotice.copied ? 'Copied' : 'Copy Link'}
                    </button>
                    {activeChat?.shareId && currentUser && !isIncognito && (
                      <button
                        type="button"
                        onClick={() => requestRevokeShareForChat(activeChat)}
                        disabled={isRevokingShare}
                        className="px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800/80 text-red-100 text-[11px] font-semibold cursor-pointer shrink-0"
                      >
                        Revoke Link
                      </button>
                    )}
                  </div>
                  <div className="text-[10.5px] opacity-80 leading-snug">
                    {SHARED_NOODLE_PRIVACY_DISCLOSURE}
                  </div>
                </>
              )}
            </div>
          )}
          {/* Shared file input usable from both Chat mode + menu and Voice mode + upload button [Commented by: Google AI Studio on 28/11/2026 06:55] */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          {sharedChatView && !currentUser ? (
            <div className={`w-full rounded-[20px] p-4 flex items-center justify-between gap-3 border ${
              theme === 'Minimalist Light'
                ? 'bg-white border-neutral-300 text-neutral-700 shadow-lg'
                : 'bg-[#111] border-[#333] text-neutral-300'
            }`}>
              <span className="text-xs">
                Viewing a read-only shared noodle. Sign in and click Continue this chat to fork an independent copy.
              </span>
              <button
                type="button"
                onClick={() => setAuthModalMode('signin')}
                className="px-3.5 py-1.5 rounded-lg accent-btn text-xs font-semibold cursor-pointer shrink-0"
              >
                Sign In
              </button>
            </div>
          ) : workspaceMode === 'voice' ? (
            /* Voice Mode UI: centered Microphone button, left + file upload button, and Choose Voice button [Commented by: Google AI Studio on 28/11/2026 06:55] */
            <div className="w-full flex flex-col items-center gap-3">
              {voiceError && (
                <div className="w-full max-w-lg px-3.5 py-2 rounded-xl bg-red-950/85 border border-red-600/60 text-red-200 text-xs flex items-center justify-between shadow-lg">
                  <span>⚠️ {voiceError}</span>
                  <button
                    type="button"
                    onClick={() => setVoiceError(null)}
                    className="ml-2 text-red-300 hover:text-white cursor-pointer font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {attachments.length > 0 && (
                <div className="flex gap-2 overflow-x-auto py-1 max-w-full">
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
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="text-red-400 hover:text-red-300 font-bold ml-1 text-sm cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {(isSynthesizingAudio || lastAudioUrl) && (
                <div
                  className={`px-3.5 py-1.5 rounded-xl border text-xs flex items-center gap-3 shadow-sm ${
                    theme === 'Minimalist Light'
                      ? 'bg-white border-neutral-300 text-neutral-800'
                      : 'bg-[#111] border-[#2e2e2e] text-neutral-200'
                  }`}
                >
                  {isSynthesizingAudio ? (
                    <span className="status-pulse flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full accent-solid-bg"></span>
                      <span>Generating Voice Audio...</span>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleToggleReplayAudio}
                        className="px-2.5 py-1 rounded-lg accent-btn font-semibold text-[11px] cursor-pointer"
                      >
                        {isPlayingAudio ? 'Pause Audio' : 'Play Audio'}
                      </button>
                      {activeVoiceLabel && (
                        <span className="text-[11px] text-neutral-400">
                          Voice: <span className="font-semibold accent-text">{activeVoiceLabel}</span>
                        </span>
                      )}
                      {audioGenerationId && (
                        <span className="text-[10px] font-mono text-neutral-500 hidden sm:inline">
                          ID: {audioGenerationId.slice(0, 12)}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload File"
                  aria-label="Upload File"
                  className={`w-11 h-11 rounded-full border flex items-center justify-center text-lg font-bold transition-colors cursor-pointer ${
                    theme === 'Minimalist Light'
                      ? 'bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-100 shadow-md'
                      : 'bg-[#111] border-[#333] text-white hover:border-neutral-500 neon-glow'
                  }`}
                >
                  +
                </button>

                <button
                  type="button"
                  onClick={handleToggleVoiceMicrophone}
                  aria-label={
                    isGenerating
                      ? 'Stop voice generation'
                      : isListeningVoice
                      ? 'Stop listening and send'
                      : 'Start voice input'
                  }
                  title={
                    isGenerating
                      ? 'Stop generation'
                      : isListeningVoice
                      ? 'Tap to finish speaking'
                      : 'Tap to speak'
                  }
                  className={`w-16 h-16 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                    isGenerating
                      ? 'bg-red-600 hover:bg-red-700 border-red-500 text-white shadow-xl'
                      : isListeningVoice
                      ? 'accent-btn accent-border scale-105 animate-pulse shadow-2xl'
                      : theme === 'Minimalist Light'
                      ? 'bg-white border-neutral-300 text-neutral-900 hover:bg-neutral-50 shadow-xl'
                      : 'bg-[#111] border-[#333] text-white hover:border-neutral-400 neon-glow'
                  }`}
                >
                  {isGenerating ? (
                    <span className="font-mono text-base font-bold">{STOP_FRAMES[stopFrameIndex]}</span>
                  ) : (
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8"
                      />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsChooseVoiceOpen(true)}
                  className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer flex flex-col items-start leading-tight ${
                    theme === 'Minimalist Light'
                      ? 'bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-100 shadow-md'
                      : 'bg-[#111] border-[#333] text-white hover:border-neutral-500'
                  }`}
                >
                  <span>Choose Voice</span>
                  <span className="text-[10px] accent-text font-normal">
                    {getVoiceOptionById(selectedVoiceId).name}
                  </span>
                </button>
              </div>
            </div>
          ) : (
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

            {/* Bottom Controls: Plus Popup Menu + Deep Research / Learn Step By Step + Effort Slider visible for both signed-in and signed-out users [Commented by: Google AI Studio at 27/11/2026 21:17] */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div ref={plusMenuRef} className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                    aria-expanded={isPlusMenuOpen}
                    aria-haspopup="menu"
                    className={`p-1 text-[1.2rem] cursor-pointer transition-colors ${
                      theme === 'Minimalist Light'
                        ? 'text-neutral-600 hover:text-neutral-900'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                    title="Actions: Upload File, Deep Research, Learn Step By Step"
                  >
                    ➕
                  </button>

                  {isPlusMenuOpen && (
                    <div
                      role="menu"
                      className="absolute bottom-full left-0 mb-2 w-52 bg-black text-white border border-[#2f2f2f] rounded-xl shadow-2xl p-1.5 z-40 flex flex-col gap-0.5"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsPlusMenuOpen(false);
                          fileInputRef.current?.click();
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-white hover:bg-[#1a1a1a] flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <span aria-hidden="true">📁</span>
                        <span>Upload File</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setComposerMode('deep_research');
                          setIsPlusMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-white hover:bg-[#1a1a1a] flex items-center gap-2.5 cursor-pointer transition-colors ${
                          composerMode === 'deep_research' ? 'bg-[#161616] accent-text' : ''
                        }`}
                      >
                        <span aria-hidden="true">🔬</span>
                        <span>Deep Research</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setComposerMode('learn_step_by_step');
                          setIsPlusMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-white hover:bg-[#1a1a1a] flex items-center gap-2.5 cursor-pointer transition-colors ${
                          composerMode === 'learn_step_by_step' ? 'bg-[#161616] accent-text' : ''
                        }`}
                      >
                        <span aria-hidden="true">🪜</span>
                        <span>Learn Step By Step</span>
                      </button>
                    </div>
                  )}
                </div>

                {composerMode === 'deep_research' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSuperDeepResearch(false)}
                      className={`text-xs cursor-pointer select-none ${
                        !isSuperDeepResearch
                          ? theme === 'Minimalist Light'
                            ? 'text-neutral-900 font-semibold'
                            : 'text-white font-semibold'
                          : 'text-neutral-500'
                      }`}
                    >
                      Deep Research
                    </button>
                    {/* Dynamic accent-colored Super Deep Research knob [Commented by: Google AI Studio on 28/11/2026 06:55] */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isSuperDeepResearch}
                      aria-label="Toggle between Deep Research and Super Deep Research"
                      onClick={() => setIsSuperDeepResearch((prev) => !prev)}
                      className="w-11 h-6 rounded-full bg-black border border-[#333] p-0.5 flex items-center cursor-pointer shrink-0"
                    >
                      <span
                        className={`w-[18px] h-[18px] rounded-full accent-solid-bg transition-transform duration-150 ${
                          isSuperDeepResearch ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSuperDeepResearch(true)}
                      className={`text-xs cursor-pointer select-none ${
                        isSuperDeepResearch
                          ? theme === 'Minimalist Light'
                            ? 'text-neutral-900 font-semibold'
                            : 'text-white font-semibold'
                          : 'text-neutral-500'
                      }`}
                    >
                      Super Deep Research
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerMode('normal')}
                      title="Exit Deep Research mode"
                      aria-label="Exit Deep Research mode"
                      className="text-xs text-neutral-400 hover:text-red-400 px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {composerMode === 'learn_step_by_step' && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black border border-[#333] text-xs accent-text font-medium">
                    <span aria-hidden="true">🪜</span>
                    <span>Learn Step By Step</span>
                    <button
                      type="button"
                      onClick={() => setComposerMode('normal')}
                      title="Exit Learn Step By Step mode"
                      aria-label="Exit Learn Step By Step mode"
                      className="text-neutral-400 hover:text-red-400 ml-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 ml-auto">
                {/* Green 3-stop OpenRouter Reasoning Effort slider with white thumb (Low / Medium / High), visible to all users [Commented by: Google AI Studio at 27/11/2026 21:17] */}
                <div className="flex flex-col items-center min-w-[136px] select-none">
                  <div className="w-full flex items-center justify-between text-[10px] font-semibold leading-none mb-1">
                    <span className={theme === 'Minimalist Light' ? 'text-neutral-600' : 'text-neutral-400'}>
                      Effort
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={1}
                    value={reasoningEffort === 'low' ? 0 : reasoningEffort === 'medium' ? 1 : 2}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setReasoningEffort(val === 0 ? 'low' : val === 1 ? 'medium' : 'high');
                    }}
                    aria-label="Effort"
                    className="effort-slider"
                  />
                  <div
                    className={`w-full flex items-center justify-between text-[9.5px] leading-none mt-1 ${
                      theme === 'Minimalist Light' ? 'text-neutral-600' : 'text-neutral-400'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setReasoningEffort('low')}
                      className={`cursor-pointer ${reasoningEffort === 'low' ? 'accent-text font-semibold' : ''}`}
                    >
                      Low
                    </button>
                    <button
                      type="button"
                      onClick={() => setReasoningEffort('medium')}
                      className={`cursor-pointer ${reasoningEffort === 'medium' ? 'accent-text font-semibold' : ''}`}
                    >
                      Medium
                    </button>
                    <button
                      type="button"
                      onClick={() => setReasoningEffort('high')}
                      className={`cursor-pointer ${reasoningEffort === 'high' ? 'accent-text font-semibold' : ''}`}
                    >
                      High
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSend()}
                  className={`w-[36px] h-[36px] rounded-full flex items-center justify-center font-bold text-[18px] transition-colors cursor-pointer shrink-0 ${
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
          )}
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
      {/* Passed theme and onThemeChange props to SettingsModal for switching between Neon Black and Minimalist Light  [Commented by: Google AI Studio on 20/10/2026 11:33 PM] */}
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
          // Cleanly reset in-memory session state, transient notices, and legacy profile cache on sign-out without deleting account or unrelated guest data [Commented by: Google AI Studio at 25/11/2026 22:57]
          onLogout={() => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            stopVoiceAndAudio();
            setHasVoiceSessionStarted(false);
            setWorkspaceMode('chat');
            setIsChooseVoiceOpen(false);
            setIsGenerating(false);
            stopStreamSmoothing();
            setCurrentUser(null);
            setPasswordSecret('');
            setCryptoKey(null);
            setChats([]);
            chatsRef.current = [];
            setIsRegularHistoryLocked(false);
            setChatFileOutputs({});
            previewCacheRef.current = {};
            setQuickPreview(null);
            // Turn off incognito display mode on logout without deleting nanobot_incognito_chats [Commented by: Google AI Studio on 28/11/2026 07:32]
            setIsIncognito(false);
            setIncognitoModeFlagLocally(false);
            setIsSettingsOpen(false);
            setIsNewNoodleMenuOpen(false);
            setIsRunningNoodleMenuOpen(false);
            setIsProvideUrlModalOpen(false);
            setProvideUrlInput('');
            setImportUrlError(null);
            setPendingRevokeShare(null);
            setRevokeShareError(null);
            setHistorySearchQuery('');
            setHistoryNotice(null);
            setQuotaErrorNotice(null);
            setExportStatusNotice(null);
            setExpandedReasoningIndices({});
            setShowSourcesPopup(null);
            setEditingMessageIndex(null);
            setEditText('');
            clearLegacyLocalProfileCache();
            handleStartNewChat();
          }}
          onDeleteAccount={() => {
            // Thoroughly wipe all regular, incognito, encrypted, and file-output browser storage upon account deletion [Commented by: Google AI Studio on 28/11/2026 07:32]
            const deletedUserId = currentUser?.id;
            setCurrentUser(null);
            setPasswordSecret('');
            setCryptoKey(null);
            setIsRegularHistoryLocked(false);
            setChats([]);
            chatsRef.current = [];
            setIncognitoChats([]);
            incognitoChatsRef.current = [];
            setIsIncognito(false);
            setChatFileOutputs({});
            setPendingRevokeShare(null);
            setRevokeShareError(null);
            clearAllLocalChatAndFileData(deletedUserId, { includeIncognito: true, includeGuest: true });
            clearLegacyLocalProfileCache();
            clearAllOriginalFiles().catch(() => {});
            handleStartNewChat();
          }}
          theme={theme}
          onThemeChange={(newTheme) => setTheme(newTheme)}
          accent={accent}
          onAccentChange={(newAccent) => setAccent(newAccent)}
        />
      )}

      {/* Standalone About modal for non-signed-in users  [Commented by: Google AI Studio on 18/10/2026 12:58 PM] */}
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        connectedPlugins={currentUser?.plugins_connected}
        theme={theme}
      />

      {/* Choose Voice Popup Modal for Voice Mode (Random + 8 documented Fish Audio S2.1 Pro voices) [Commented by: Google AI Studio on 28/11/2026 06:55] */}
      {isChooseVoiceOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="choose-voice-modal-title"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border space-y-4 animate-in fade-in zoom-in-95 duration-150 ${
            theme === 'Minimalist Light'
              ? 'bg-white border-neutral-300 text-neutral-900'
              : 'bg-[#121212] border-[#2b2b2b] text-white'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-inherit opacity-90">
              <div>
                {/* Removed Choose Voice modal header subtitle text per user selection [Commented by: Google AI Studio on 28/11/2026 06:57] */}
                <h3 id="choose-voice-modal-title" className="text-base font-bold font-serif">
                  Choose Voice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsChooseVoiceOpen(false)}
                aria-label="Close Choose Voice modal"
                className="text-neutral-400 hover:text-white cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
              {ALL_VOICE_CHOICES.map((voice) => {
                const isSelected = selectedVoiceId === voice.id;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => handleSelectVoice(voice.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'accent-soft-box border accent-border'
                        : theme === 'Minimalist Light'
                        ? 'bg-neutral-50 border-neutral-200 hover:bg-neutral-100 text-neutral-900'
                        : 'bg-[#181818] border-[#282828] hover:border-neutral-600 text-white'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{voice.name}</div>
                      <div className={`text-[11px] mt-0.5 ${isSelected ? 'opacity-90' : 'text-neutral-400'}`}>
                        {voice.description}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-xs font-bold shrink-0">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quick Preview Tooltip for sidebar chat title hover without selecting [Commented by: Google AI Studio on 23/10/2026 12:40 PM] */}
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
            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded font-medium border accent-soft-box">
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
                      : 'accent-soft-box'
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
                  setImportUrlError(null);
                }}
                className="text-neutral-400 hover:text-white cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Paste a shared noodle link to view a public snapshot{currentUser ? ' or import an independent copy into your browser-local encrypted history' : ''}.
            </p>

            {importUrlError && (
              <div className="px-3 py-2 rounded-lg bg-red-950/80 border border-red-600/60 text-red-200 text-xs">
                ⚠️ {importUrlError}
              </div>
            )}

            <input
              type="text"
              autoFocus
              value={provideUrlInput}
              onChange={(e) => {
                setProvideUrlInput(e.target.value);
                if (importUrlError) setImportUrlError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleImportFromUrl(provideUrlInput);
                }
              }}
              placeholder="https://.../?share=..."
              className={`w-full rounded-xl p-3 text-xs focus:outline-none border accent-focus-border ${
                theme === 'Minimalist Light'
                  ? 'bg-neutral-100 border-neutral-300 text-neutral-900'
                  : 'bg-[#181818] border-[#333] text-white'
              }`}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsProvideUrlModalOpen(false);
                  setProvideUrlInput('');
                  setImportUrlError(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white bg-transparent cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!provideUrlInput.trim() || isImportingUrl}
                onClick={() => handleImportFromUrl(provideUrlInput)}
                className="px-5 py-2 rounded-lg text-xs font-bold accent-btn cursor-pointer transition-colors disabled:opacity-50"
              >
                {isImportingUrl ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation dialog preventing accidental public share revocation [Commented by: Google AI Studio at 24/11/2026 22:57] */}
      {pendingRevokeShare && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-share-modal-title"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border space-y-4 animate-in fade-in zoom-in-95 duration-150 ${
            theme === 'Minimalist Light'
              ? 'bg-white border-neutral-300 text-neutral-900'
              : 'bg-[#121212] border-[#2b2b2b] text-white'
          }`}>
            <div className="flex items-center justify-between pb-1 border-b border-inherit opacity-90">
              <h3 id="revoke-share-modal-title" className="text-base font-bold font-serif">
                Revoke Share Link?
              </h3>
              <button
                type="button"
                disabled={isRevokingShare}
                onClick={() => {
                  setPendingRevokeShare(null);
                  setRevokeShareError(null);
                }}
                aria-label="Close revoke confirmation"
                className="text-neutral-400 hover:text-white cursor-pointer text-sm disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Revoking <span className="font-semibold text-neutral-200">{pendingRevokeShare.title}</span> will immediately delete this public snapshot from the Cloudflare sharing database. Anyone holding the link will no longer be able to view or fork it. Your personal copy remains in your browser-local history.
            </p>

            {revokeShareError && (
              <div className="px-3 py-2 rounded-lg bg-red-950/80 border border-red-600/60 text-red-200 text-xs">
                ⚠️ {revokeShareError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isRevokingShare}
                onClick={() => {
                  setPendingRevokeShare(null);
                  setRevokeShareError(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white bg-transparent cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRevokingShare}
                onClick={handleConfirmRevokeShare}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white cursor-pointer transition-colors disabled:opacity-50"
              >
                {isRevokingShare ? 'Revoking...' : 'Confirm Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
