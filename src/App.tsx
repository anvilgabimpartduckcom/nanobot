// {Created unified nanobot App with Supabase auth, settings, incognito mode, deep research, and smooth streaming} [Commented by: Sonic on 10/12/2026 10:58 AM]

import React, { useState, useEffect, useRef } from 'react';
import { AuthModal } from './components/AuthModal';
import { SettingsModal } from './components/SettingsModal';
// {Updated Supabase sync imports for remote and local encrypted chat operations} [Commented by: Sonic on 10/13/2026 03:21 AM]
import { UserProfile, isSupabaseConfigured, supabase, fetchUserEncryptedChats, persistEncryptedChatRecord, removeEncryptedChatRecord } from './lib/supabase';
import { deriveKeyFromPassword, encryptData, decryptData } from './lib/crypto';
import { analyzeFileWithScript, ProcessedFile } from './lib/fileReader';
import { performDynamicSearch, runDeepResearch } from './lib/tavily';
import { markdownToHtml, escapeHtml, safeUrl } from './lib/markdown';

interface ChatMessage {
  role: 'user' | 'ai';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  sources?: Array<{ title: string; url: string }>;
  reasoning?: string;
  displayAttachments?: Array<{ type: string; name: string }>;
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
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [passwordSecret, setPasswordSecret] = useState<string>('');
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | null>(null);
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

  // Derive CryptoKey when user logs in with password
  useEffect(() => {
    if (currentUser && passwordSecret) {
      deriveKeyFromPassword(passwordSecret, currentUser.salt || 'default_nanobot_salt')
        .then((key) => {
          setCryptoKey(key);
          loadEncryptedChats(currentUser.id, key);
        })
        .catch((err) => console.error('Error deriving encryption key:', err));
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

  // {Integrated remote Supabase encrypted chat syncing with zero-knowledge AES-GCM} [Commented by: Sonic on 10/13/2026 03:18 AM]
  const loadEncryptedChats = async (userId: string, key: CryptoKey) => {
    try {
      const records = await fetchUserEncryptedChats(userId);
      const decryptedChats: ChatSession[] = [];

      for (const rec of records) {
        try {
          const decryptedTitle = await decryptData(rec.title_ciphertext, rec.iv, key);
          const decryptedPayload = await decryptData(rec.data_ciphertext, rec.iv, key);
          const parsed = JSON.parse(decryptedPayload);

          decryptedChats.push({
            id: rec.id,
            title: decryptedTitle,
            messages: parsed.messages || [],
            pinned: rec.pinned,
            updated: new Date(rec.updated_at).getTime()
          });
        } catch (decryptErr) {
          console.warn('Failed to decrypt chat record:', rec.id, decryptErr);
        }
      }

      setChats(decryptedChats);
    } catch (e) {
      console.error('Error loading encrypted chats:', e);
    }
  };

  // Save active chat (Encrypted to Supabase if signed in, skipped if Incognito)
  const persistChat = async (chat: ChatSession) => {
    if (isIncognito) return; // Do not save incognito chats

    if (currentUser && cryptoKey) {
      try {
        const payloadStr = JSON.stringify({ messages: chat.messages });
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
    const displayAttachments: Array<{ type: string; name: string }> = [];

    // Check if there are non-image files with extracted text
    let attachedFileContext = '';
    attachments.forEach((att) => {
      displayAttachments.push({ type: att.isImage ? 'image' : 'file', name: att.name });
      if (!att.isImage && att.contentSnippet) {
        attachedFileContext += `\n\n--- Uploaded File: ${att.name} ---\n${att.contentSnippet}\n`;
      }
    });

    const fullTextPrompt = trimmedPrompt + attachedFileContext;

    // {Typed userContent multimodal parts array explicitly for TypeScript safety} [Commented by: Sonic on 10/12/2026 11:00 AM]
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

    // Build System Prompt with Outsider Persona Guardrail & Custom Instructions
    const customInstructions = currentUser?.ai_instructions || '';
    const connectedPlugins = currentUser?.plugins_connected || {};
    const pluginsContext = Object.entries(connectedPlugins)
      .filter(([_, isConn]) => isConn)
      .map(([id]) => id)
      .join(', ');

    const systemPrompt = `You are 'nanobot', an advanced, autonomous AI assistant. You can process text, images, and files seamlessly. Current Date/Time: ${getCurrentDateTime()}.
Follow these guidelines strictly:
1. Always use emojis for visual cues to make the conversation engaging.
2. If a user asks for up-to-date facts, news, or information you lack, you MUST search the web. To do this, output EXACTLY the tag <search>your search query</search>. You may output multiple tags for parallel searches.
3. Keep search queries concise and optimized for a search engine.
4. When you receive search results, analyze them carefully and provide a comprehensive final answer.
5. Always cite your sources using inline citations in the format [1], [2], corresponding to the provided search results. Do not list the sources at the end of your response.
6. If the user ever wants some help on personal stuff, you must reply as if you are an objective outsider on that matter.
${pluginsContext ? `7. Connected MCP Plugins available upon user request: ${pluginsContext}.` : ''}
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
  const handleClearChatHistory = () => {
    if (!window.confirm('Clear unpinned chats from history?')) return;
    const remaining = chats.filter((c) => c.pinned);
    setChats(remaining);

    // {Synchronized chat deletions to remote Supabase database and local store} [Commented by: Sonic on 10/13/2026 03:19 AM]
    chats.forEach((c) => {
      if (!c.pinned) removeEncryptedChatRecord(c.id);
    });

    try {
      localStorage.setItem('nanobot_chats', JSON.stringify(remaining));
    } catch {}

    handleStartNewChat();
  };

  // Toggle chat pin
  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const next = { ...c, pinned: !c.pinned };
          persistChat(next);
          return next;
        }
        return c;
      })
    );
  };

  // Delete chat
  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeEncryptedChatRecord(id);
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) handleStartNewChat();
  };

  // Rename chat
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
      <aside
        className={`${
          sidebarOpen ? 'flex' : 'hidden'
        } w-[300px] h-full bg-[#0a0a0a] border-r border-[#262626] flex-col p-4 z-40 shrink-0`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#262626] mb-3">
          <h3 className="font-semibold text-sm tracking-wide text-neutral-300">
            History ◴
          </h3>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-neutral-400 hover:text-white p-1 text-sm"
          >
            ✕
          </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {chats.length === 0 ? (
            <div className="text-xs text-neutral-600 p-2 italic">No chat history yet</div>
          ) : (
            chats.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  setActiveChatId(c.id);
                  setSidebarOpen(false);
                }}
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
          {/* Requirement 2: Clear Chat History moves slightly upwards */}
          <button
            onClick={handleClearChatHistory}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer"
          >
            Clear Chat History
          </button>

          {/* Requirement 2: Black Settings button placed below Clear Chat History only after user has signed in */}
          {currentUser && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-full bg-black border border-[#333] hover:border-neutral-500 text-white font-medium py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
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
            className="w-10 h-10 bg-transparent text-white border border-[#333] rounded-xl flex items-center justify-center text-lg hover:border-neutral-500 cursor-pointer"
            title="Toggle History"
          >
            {sidebarOpen ? '✕' : '◴'}
          </button>
          <button
            onClick={handleStartNewChat}
            className="w-10 h-10 bg-transparent text-white border border-[#333] rounded-xl flex items-center justify-center text-lg hover:border-neutral-500 cursor-pointer"
            title="New Chat"
          >
            💬
          </button>
        </div>

        {/* Top-Right Controls (Requirement 1 & 11) */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-30">
          {!currentUser ? (
            <>
              <button
                onClick={() => setAuthModalMode('signin')}
                className="bg-black border border-[#333] hover:border-neutral-500 text-white font-medium px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthModalMode('signup')}
                className="bg-black border border-[#333] hover:border-neutral-500 text-white font-medium px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Sign Up
              </button>
            </>
          ) : (
            // Requirement 11: Sunglasses / Sun emoji for Incognito chat toggle
            <button
              onClick={() => setIsIncognito((prev) => !prev)}
              className="w-10 h-10 bg-[#111] border border-[#333] hover:border-[#39ff14] rounded-xl flex items-center justify-center text-xl cursor-pointer transition-colors"
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

        {/* Main Heading (Visible in zero state) */}
        {!activeChat && (
          <h1 className="absolute top-[20vh] text-6xl font-bold font-serif text-white tracking-tight pointer-events-none select-none">
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
                      <div className="mt-2 text-xs text-neutral-400 space-y-0.5 border-t border-neutral-700 pt-1.5">
                        {m.displayAttachments.map((att, aIdx) => (
                          <div key={aIdx}>
                            {att.type === 'image' ? '🖼️ Image' : `📄 ${att.name}`}
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
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-full max-w-[750px] px-4 transition-all duration-300 z-20 ${
            activeChat ? 'bottom-8' : 'top-[34vh]'
          }`}
        >
          <div className="w-full bg-[#111] border border-[#2b2b2b] rounded-3xl p-4 flex flex-col gap-2.5 neon-glow">
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
              /* {Updated composer input placeholder to clean 'Ask Anything...' label} [Commented by: Sonic on 10/13/2026 10:26 AM] */
              placeholder="Ask Anything..."
              rows={1}
              className="w-full bg-transparent border-none text-white resize-none outline-none text-base leading-relaxed placeholder-neutral-500 min-h-[52px] max-h-[160px]"
            />

            {/* Bottom Controls */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-neutral-400 hover:text-white p-1 text-lg cursor-pointer transition-colors"
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
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    isGenerating
                      ? 'bg-red-600 hover:bg-red-700 text-white font-mono text-sm'
                      : 'bg-[#000080] hover:bg-[#000066] text-white'
                  }`}
                  title={isGenerating ? 'Stop Generation' : 'Send'}
                >
                  {isGenerating ? (
                    <span>{STOP_FRAMES[stopFrameIndex]}</span>
                  ) : (
                    <span className="font-bold text-sm">?</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* AUTH MODAL */}
      {authModalMode && (
        <AuthModal
          mode={authModalMode}
          isOpen={true}
          onClose={() => setAuthModalMode(null)}
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
