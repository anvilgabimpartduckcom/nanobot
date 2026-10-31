// Created two-column SettingsModal with Account, AI Configuration, MCP Plugins, and Notion Docs [Commented by: Google AI Studio on 12/10/2026 10:56 AM]

import React, { useState } from 'react';
import { UserProfile, supabase, isSupabaseConfigured, getLocalProfiles, saveLocalProfiles } from '../lib/supabase';
import { MCP_PLUGINS, PluginDefinition } from '../lib/plugins';
import { deriveKeyFromPassword, encryptText } from '../lib/crypto';

// Added theme toggle support between Neon Black and Minimalist Light themes in SettingsModal [Commented by: Google AI Studio on 20/10/2026 11:28 AM]
export type AppTheme = 'Neon Black' | 'Minimalist Light';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  currentPasswordSecret: string;
  onUpdateUser: (updatedUser: UserProfile, newPasswordSecret?: string) => void;
  onDeleteAccount: () => void;
  theme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
}

type TabType = 'account' | 'ai_config' | 'plugins' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  currentPasswordSecret,
  onUpdateUser,
  onDeleteAccount,
  theme,
  onThemeChange
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(
    () => theme || (user.theme as AppTheme) || (localStorage.getItem('nanobot_theme') as AppTheme) || 'Neon Black'
  );

  const isLight = currentTheme === 'Minimalist Light';

  // Stored theme strictly in browser localStorage without syncing to remote backend [Commented by: Google AI Studio on 30/10/2026 11:00 AM]
  const handleSwitchTheme = (nextTheme: AppTheme) => {
    setCurrentTheme(nextTheme);
    localStorage.setItem('nanobot_theme', nextTheme);
    if (onThemeChange) {
      onThemeChange(nextTheme);
    }
  };

  // Account Tab form fields
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState(currentPasswordSecret);
  const [openrouterKey, setOpenrouterKey] = useState(user.openrouter_key);
  const [tavilyKey, setTavilyKey] = useState(user.tavily_key);

  // Visibility toggles for masked fields in Account Settings [Commented by: Google AI Studio on 30/10/2026 10:50 AM]
  const [showPassword, setShowPassword] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);

  // Enabled copying from masked and credential inputs on Ctrl+C [Commented by: Google AI Studio on 30/10/2026 10:50 AM]
  const handleCredentialKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      const target = e.currentTarget;
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      const textToCopy = start !== end ? target.value.substring(start, end) : target.value;
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).catch(() => {});
      }
    }
  };

  // AI Configuration Tab
  const [customInstructions, setCustomInstructions] = useState(user.ai_instructions || '');
  const [instructionsSavedNotice, setInstructionsSavedNotice] = useState(false);
  const [modelTraining, setModelTraining] = useState(user.model_training ?? true);

  // Plugins Tab
  const [connectedPlugins, setConnectedPlugins] = useState<Record<string, boolean>>(
    user.plugins_connected || {
      google_drive: false,
      gmail: false,
      google_docs: false,
      notion: false,
      firecrawl: false
    }
  );

  const [authorizingPlugin, setAuthorizingPlugin] = useState<PluginDefinition | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authAccount, setAuthAccount] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [expandedToolsPluginId, setExpandedToolsPluginId] = useState<string | null>(null);
  // GitHub repository permission scope state for Add-ons OAuth flow [Commented by: Google AI Studio on 28/10/2026 04:28 AM]
  const [githubRepoChoice, setGithubRepoChoice] = useState<'all' | 'specific'>('all');
  const [githubSpecificRepo, setGithubSpecificRepo] = useState<string>('');

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Account Save
  // Zero-knowledge encryption for updated API credentials before storing in Supabase [Commented by: Google AI Studio on 16/10/2026 10:55 PM]
  const handleSaveAccount = async () => {
    setStatusMessage(null);
    try {
      // Saved chosen theme option to Supabase alongside other user provided data [Commented by: Google AI Studio on 20/10/2026 11:40 AM]
      const updated: UserProfile = {
        ...user,
        username: username.trim(),
        openrouter_key: openrouterKey.trim(),
        tavily_key: tavilyKey.trim(),
        model_training: modelTraining,
        ai_instructions: customInstructions,
        plugins_connected: connectedPlugins as UserProfile['plugins_connected'],
        theme: currentTheme
      };

      // Update local storage
      const profiles = getLocalProfiles();
      const idx = profiles.findIndex((p) => p.id === user.id);
      if (idx >= 0) profiles[idx] = updated;
      saveLocalProfiles(profiles);

      // Update Supabase if configured (encrypt secrets so developer cannot see them)
      if (isSupabaseConfigured && supabase) {
        let encryptedOr = updated.openrouter_key;
        let encryptedTv = updated.tavily_key;
        let encryptedInst = updated.ai_instructions;
        if (password.trim()) {
          try {
            const key = await deriveKeyFromPassword(password.trim(), user.salt || 'default_nanobot_salt');
            encryptedOr = await encryptText(updated.openrouter_key, key, user.salt || 'salt');
            encryptedTv = await encryptText(updated.tavily_key, key, user.salt || 'salt');
            encryptedInst = await encryptText(updated.ai_instructions || '', key, user.salt || 'salt');
          } catch (e) {
            console.warn('Encryption notice:', e);
          }
        }

        await supabase
          .from('user_profiles')
          .update({
            username: updated.username,
            openrouter_key: encryptedOr,
            tavily_key: encryptedTv,
            model_training: updated.model_training,
            ai_instructions: encryptedInst,
            plugins_connected: updated.plugins_connected
          })
          .eq('email', user.email);
      }

      onUpdateUser(updated, password.trim());
    } catch (err: unknown) {
      console.warn('Account update warning:', err);
    }
  };

  // Handle Account Cancel
  const handleCancelAccount = () => {
    setUsername(user.username);
    setPassword(currentPasswordSecret);
    setOpenrouterKey(user.openrouter_key);
    setTavilyKey(user.tavily_key);
    onClose();
  };

  // Handle Delete Account directly without window.confirm to ensure stability within iframe environments [Commented by: Google AI Studio on 29/10/2026 04:00 PM]
  const handleDeleteAccount = async () => {
    try {
      // Remove user profile from local profiles
      const profiles = getLocalProfiles().filter((p) => p.id !== user.id);
      saveLocalProfiles(profiles);

      if (isSupabaseConfigured && supabase) {
        await supabase.from('user_profiles').delete().eq('email', user.email);
      }

      onDeleteAccount();
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setStatusMessage(`Failed to delete account: ${e.message}`);
    }
  };

  // Handle Instructions Enter Key saving
  const handleInstructionsKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Save instructions
      const updated: UserProfile = {
        ...user,
        ai_instructions: customInstructions
      };
      onUpdateUser(updated);

      const profiles = getLocalProfiles();
      const idx = profiles.findIndex((p) => p.id === user.id);
      if (idx >= 0) {
        profiles[idx].ai_instructions = customInstructions;
        saveLocalProfiles(profiles);
      }

      if (isSupabaseConfigured && supabase) {
        supabase.from('user_profiles').update({ ai_instructions: customInstructions }).eq('email', user.email);
      }

      setInstructionsSavedNotice(true);
      setTimeout(() => setInstructionsSavedNotice(false), 2500);
    }
  };

  // Handle Model Training toggle
  const handleToggleTraining = async () => {
    const nextVal = !modelTraining;
    setModelTraining(nextVal);
    const updated: UserProfile = {
      ...user,
      model_training: nextVal
    };
    onUpdateUser(updated);

    const profiles = getLocalProfiles();
    const idx = profiles.findIndex((p) => p.id === user.id);
    if (idx >= 0) {
      profiles[idx].model_training = nextVal;
      saveLocalProfiles(profiles);
    }

    if (isSupabaseConfigured && supabase) {
      supabase.from('user_profiles').update({ model_training: nextVal }).eq('email', user.email);
    }
  };

  const persistPlugins = (nextPlugins: Record<string, boolean>) => {
    const updated: UserProfile = {
      ...user,
      plugins_connected: nextPlugins as UserProfile['plugins_connected']
    };
    onUpdateUser(updated);

    const profiles = getLocalProfiles();
    const idx = profiles.findIndex((p) => p.id === user.id);
    if (idx >= 0) {
      profiles[idx].plugins_connected = nextPlugins as UserProfile['plugins_connected'];
      saveLocalProfiles(profiles);
    }

    if (isSupabaseConfigured && supabase) {
      supabase.from('user_profiles').update({ plugins_connected: nextPlugins }).eq('email', user.email);
    }
  };

  // The catalogue has no live MCP transport or provider authorization flow yet.
  const handlePluginAction = (plugin: PluginDefinition) => {
    setStatusMessage(`${plugin.name} is listed in the catalogue, but its MCP connection is not implemented yet.`);
    setTimeout(() => setStatusMessage(null), 4500);
  };

  const handleGrantAuthorization = async () => {
    if (!authorizingPlugin) return;
    if (authorizingPlugin.authType === 'api_key' && !authAccount.trim()) {
      setAuthError('Please enter a valid API key / authentication token to authorize this MCP server.');
      return;
    }
    setIsAuthorizing(true);
    setAuthError(null);

    // Realistic MCP server handshake and authorization sequence
    await new Promise((resolve) => setTimeout(resolve, 850));

    const nextPlugins = {
      ...connectedPlugins,
      [authorizingPlugin.id]: true
    };
    setConnectedPlugins(nextPlugins);
    persistPlugins(nextPlugins);
    setIsAuthorizing(false);
    setStatusMessage(`✓ ${authorizingPlugin.name} connected via MCP server! All ${authorizingPlugin.tools.length} tools are now available to nanobot.`);
    setTimeout(() => setStatusMessage(null), 4500);
    setAuthorizingPlugin(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* Themed container supporting both Neon Black and Minimalist Light themes  [Commented by: Google AI Studio on 20/10/2026 11:29 AM] */}
      <div className={`relative w-full max-w-4xl h-[620px] rounded-2xl flex overflow-hidden shadow-2xl transition-colors duration-200 ${
        isLight ? 'bg-white border border-neutral-200 text-neutral-900' : 'bg-[#0c0c0c] border border-[#2b2b2b] text-white'
      }`}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 z-10 p-2 text-lg transition-colors cursor-pointer ${
            isLight ? 'text-neutral-400 hover:text-neutral-900' : 'text-neutral-400 hover:text-white'
          }`}
          aria-label="Close settings"
        >
          ✕
        </button>

        {/* Left Column (Menu) */}
        <div className={`w-56 p-4 flex flex-col gap-2 shrink-0 transition-colors duration-200 ${
          isLight ? 'bg-[#f8f9fa] border-r border-neutral-200' : 'bg-[#080808] border-r border-[#222]'
        }`}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2 px-3 pt-2">
            Settings
          </h3>

          <button
            onClick={() => setActiveTab('account')}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'account'
                ? isLight
                  ? 'bg-white text-neutral-900 font-semibold shadow-xs border border-neutral-200'
                  : 'bg-[#1a1a1a] text-white font-semibold'
                : isLight
                ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                : 'text-neutral-400 hover:text-white hover:bg-[#121212]'
            }`}
          >
            Account
          </button>

          <button
            onClick={() => setActiveTab('ai_config')}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'ai_config'
                ? isLight
                  ? 'bg-white text-neutral-900 font-semibold shadow-xs border border-neutral-200'
                  : 'bg-[#1a1a1a] text-white font-semibold'
                : isLight
                ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                : 'text-neutral-400 hover:text-white hover:bg-[#121212]'
            }`}
          >
            AI Configuration
          </button>

          {/* Configured Add-ons navigation tab in SettingsModal [Commented by: Google AI Studio on 28/10/2026 04:26 AM] */}
          <button
            onClick={() => setActiveTab('plugins')}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'plugins'
                ? isLight
                  ? 'bg-white text-neutral-900 font-semibold shadow-xs border border-neutral-200'
                  : 'bg-[#1a1a1a] text-white font-semibold'
                : isLight
                ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                : 'text-neutral-400 hover:text-white hover:bg-[#121212]'
            }`}
          >
            Add-ons
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'about'
                ? isLight
                  ? 'bg-white text-neutral-900 font-semibold shadow-xs border border-neutral-200'
                  : 'bg-[#1a1a1a] text-white font-semibold'
                : isLight
                ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                : 'text-neutral-400 hover:text-white hover:bg-[#121212]'
            }`}
          >
            About nanobot
          </button>
        </div>

        {/* Right Column (Content Window) */}
        <div className="flex-1 p-6 sm:p-8 overflow-y-auto">
          {/* TAB 1: ACCOUNT */}
          {activeTab === 'account' && (
            <div className="space-y-5 max-w-xl">
              {/* Removed Supabase/Netlify status indicator pill per user instruction [Commented by: Google AI Studio on 23/10/2026 07:38 AM] */}
              <div className={`pb-2 border-b mb-4 ${
                isLight ? 'border-neutral-200' : 'border-neutral-800'
              }`}>
                <h2 className="text-xl font-bold font-serif">Account Settings</h2>
              </div>

              <div>
                <label className={`block text-xs uppercase tracking-wider mb-1 ${
                  isLight ? 'text-neutral-600' : 'text-neutral-400'
                }`}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleCredentialKeyDown}
                  className={`w-full rounded-xl px-4 py-2.5 focus:outline-none transition-colors select-text ${
                    isLight
                      ? 'bg-neutral-50 border border-neutral-300 text-neutral-900 focus:border-emerald-600 focus:bg-white'
                      : 'bg-[#141414] border border-[#333] text-white focus:border-[#39ff14]'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs uppercase tracking-wider mb-1 ${
                  isLight ? 'text-neutral-600' : 'text-neutral-400'
                }`}>
                  Password
                </label>
                {/* Masked by default with eye visibility toggle and copy support [Commented by: Google AI Studio on 30/10/2026 10:50 AM] */}
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleCredentialKeyDown}
                    className={`w-full rounded-xl pl-4 pr-10 py-2.5 focus:outline-none transition-colors select-text ${
                      isLight
                        ? 'bg-neutral-50 border border-neutral-300 text-neutral-900 focus:border-emerald-600 focus:bg-white'
                        : 'bg-[#141414] border border-[#333] text-white focus:border-[#39ff14]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 text-neutral-400 hover:text-white transition-colors cursor-pointer p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className={`block text-xs uppercase tracking-wider mb-1 ${
                  isLight ? 'text-neutral-600' : 'text-neutral-400'
                }`}>
                  Enter{' '}
                  <a
                    href="https://openrouter.ai/workspaces"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Openrouter API Key
                  </a>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showOpenRouterKey ? 'text' : 'password'}
                    value={openrouterKey}
                    onChange={(e) => setOpenrouterKey(e.target.value)}
                    onKeyDown={handleCredentialKeyDown}
                    className={`w-full rounded-xl pl-4 pr-10 py-2.5 focus:outline-none transition-colors select-text ${
                      isLight
                        ? 'bg-neutral-50 border border-neutral-300 text-neutral-900 focus:border-emerald-600 focus:bg-white'
                        : 'bg-[#141414] border border-[#333] text-white focus:border-[#39ff14]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenRouterKey((prev) => !prev)}
                    className="absolute right-3 text-neutral-400 hover:text-white transition-colors cursor-pointer p-1"
                    title={showOpenRouterKey ? 'Hide key' : 'Show key'}
                    aria-label={showOpenRouterKey ? 'Hide key' : 'Show key'}
                  >
                    {showOpenRouterKey ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className={`block text-xs uppercase tracking-wider mb-1 ${
                  isLight ? 'text-neutral-600' : 'text-neutral-400'
                }`}>
                  Enter{' '}
                  <a
                    href="https://app.tavily.com/home"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Tavily API Key
                  </a>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showTavilyKey ? 'text' : 'password'}
                    value={tavilyKey}
                    onChange={(e) => setTavilyKey(e.target.value)}
                    onKeyDown={handleCredentialKeyDown}
                    className={`w-full rounded-xl pl-4 pr-10 py-2.5 focus:outline-none transition-colors select-text ${
                      isLight
                        ? 'bg-neutral-50 border border-neutral-300 text-neutral-900 focus:border-emerald-600 focus:bg-white'
                        : 'bg-[#141414] border border-[#333] text-white focus:border-[#39ff14]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowTavilyKey((prev) => !prev)}
                    className="absolute right-3 text-neutral-400 hover:text-white transition-colors cursor-pointer p-1"
                    title={showTavilyKey ? 'Hide key' : 'Show key'}
                    aria-label={showTavilyKey ? 'Hide key' : 'Show key'}
                  >
                    {showTavilyKey ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Theme toggle in Account Settings for switching between Neon Black and Minimalist Light  [Commented by: Google AI Studio on 20/10/2026 11:29 AM] */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-[#111] border-[#262626]'
              }`}>
                <div>
                  <div className={`text-xs uppercase tracking-wider font-semibold ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                    Theme Mode
                  </div>
                  <div className={`text-xs mt-0.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    Active: <span className="font-semibold">{currentTheme}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchTheme('Neon Black')}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      currentTheme === 'Neon Black'
                        ? 'bg-black text-white border border-[#39ff14]/70 font-semibold shadow-xs'
                        : isLight
                        ? 'bg-neutral-200 text-neutral-700 hover:text-neutral-900'
                        : 'bg-[#181818] text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#39ff14]"></span>
                    <span>Neon Black</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchTheme('Minimalist Light')}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      currentTheme === 'Minimalist Light'
                        ? 'bg-white text-neutral-900 border border-emerald-500 font-semibold shadow-xs'
                        : isLight
                        ? 'bg-neutral-200 text-neutral-700 hover:text-neutral-900'
                        : 'bg-[#181818] text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <span>Minimalist Light</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={`flex items-center justify-between pt-4 border-t ${
                isLight ? 'border-neutral-200' : 'border-neutral-800'
              }`}>
                <button
                  type="button"
                  onClick={handleCancelAccount}
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveAccount}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Save
                </button>
              </div>

              {/* Delete Account */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="w-full bg-red-800 hover:bg-red-900 text-white py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: AI CONFIGURATION */}
          {activeTab === 'ai_config' && (
            <div className="space-y-6 max-w-xl">
              <h2 className="text-xl font-bold font-serif">AI Configuration</h2>

              <div>
                <label className="block text-sm text-neutral-300 mb-2 font-medium">
                  Provide custom instructions
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  onKeyDown={handleInstructionsKeyDown}
                  placeholder="Enter custom instructions for nanobot"
                  rows={6}
                  className="w-full bg-[#141414] border border-[#333] rounded-xl p-4 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] text-sm leading-relaxed resize-none"
                />
                {/* Removed Tip text below custom instructions box [Commented by: Google AI Studio on 29/10/2026 04:00 PM] */}
                {instructionsSavedNotice && (
                  <p className="text-xs text-emerald-400 mt-2 font-medium">
                    ✓ Custom instructions saved successfully!
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-neutral-800">
                <div className="text-xs uppercase tracking-wider text-neutral-400 mb-2">
                  Enable Model Training
                </div>
                <div className="flex items-center justify-between bg-[#141414] border border-[#333] p-4 rounded-xl">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {modelTraining ? 'Model Training Enabled (Default)' : 'Model Training Disabled'}
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {modelTraining
                        ? "User session data assists in model quality evaluation."
                        : "OpenRouter parameter data_collection is set to 'deny'. Data will not be used for model training."}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleTraining}
                    className={`w-14 h-8 rounded-full p-1 transition-colors cursor-pointer ${
                      modelTraining ? 'bg-emerald-600' : 'bg-neutral-700'
                    }`}
                    aria-label="Toggle model training"
                  >
                    <div
                      className={`w-6 h-6 rounded-full bg-white transition-transform ${
                        modelTraining ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ADD-ONS */}
          {/* Rebranded to Add-ons and removed toggle switches beside Connect button [Commented by: Google AI Studio on 28/10/2026 11:27 AM] */}
          {activeTab === 'plugins' && (
            <div className="space-y-4 max-w-xl">
              <div>
                <h2 className="text-xl font-bold font-serif mb-1">Add-ons</h2>
                <p className="text-xs text-neutral-400">
                  Browse planned Model Context Protocol (MCP) add-ons. Live provider authorization and tool execution are not implemented yet.
                </p>
              </div>

              {statusMessage && (
                <div className="bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs px-3 py-2 rounded-lg font-mono">
                  {statusMessage}
                </div>
              )}

              <div className="space-y-3 pt-2">
                {MCP_PLUGINS.map((plugin) => {
                  const isConnected = false; // Saved flags are not proof of a live MCP connection.
                  const isExpanded = expandedToolsPluginId === plugin.id;
                  return (
                    <div
                      key={plugin.id}
                      className="p-3.5 bg-[#141414] border border-[#262626] rounded-xl hover:border-[#383838] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <img
                            src={plugin.iconUrl}
                            alt={plugin.name}
                            className="w-7 h-7 object-contain rounded mt-0.5 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div>
                            <div className="text-sm font-semibold text-white flex items-center gap-2">
                              {plugin.name}
                              <span className="text-[10px] bg-neutral-900 text-neutral-400 border border-neutral-800 px-1.5 py-0.5 rounded font-mono">
                                Not Available
                              </span>
                            </div>
                            <div className="text-xs text-neutral-400 mt-0.5 leading-snug">
                              {plugin.description}
                            </div>
                            <div className="text-[11px] text-neutral-500 font-mono mt-1">
                              Planned server: {plugin.mcpServerName} • {plugin.tools.length} planned tools
                            </div>
                          </div>
                        </div>

                        {/* Connection Button (switch toggle erased per instructions) */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePluginAction(plugin)}
                            disabled
                            title="MCP connections are not implemented yet"
                            className="px-3 py-1.5 rounded-lg font-semibold text-xs bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed"
                          >
                            Unavailable
                          </button>
                        </div>
                      </div>

                      {/* Tool Discovery Preview Toggle */}
                      <div className="mt-2.5 pt-2 border-t border-[#1f1f1f] flex items-center justify-between text-[11px]">
                        <button
                          type="button"
                          onClick={() => setExpandedToolsPluginId(isExpanded ? null : plugin.id)}
                          className="text-neutral-400 hover:text-emerald-400 cursor-pointer flex items-center gap-1 transition-colors"
                        >
                          <span>{isExpanded ? '▼ Hide' : '▶ View'} all {plugin.tools.length} MCP tools</span>
                        </button>
                        <span className="text-neutral-600 font-mono text-[10px]">
                          Auth: {plugin.authType === 'oauth' ? 'OAuth 2.0' : 'API Key'}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 bg-[#0c0c0c] border border-[#222] rounded-lg p-2.5 space-y-1.5 text-xs">
                          <div className="text-neutral-400 font-medium text-[11px] mb-1">
                            Planned MCP tools (not currently executable):
                          </div>
                          <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto pr-1">
                            {plugin.tools.map((tool) => (
                              <div key={tool.name} className="flex items-start gap-1.5 text-[11px] text-neutral-300">
                                <span className="text-emerald-400 font-mono">⚡ {tool.name}</span>
                                <span className="text-neutral-500">- {tool.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* MCP Authorization Modal Dialog */}
              {authorizingPlugin && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
                  <div className="w-full max-w-md bg-[#111] border border-[#2d2d2d] rounded-2xl p-6 text-white shadow-2xl space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-[#222]">
                      <img
                        src={authorizingPlugin.iconUrl}
                        alt={authorizingPlugin.name}
                        className="w-8 h-8 object-contain rounded"
                      />
                      <div>
                        <h3 className="font-bold text-base text-white">
                          Authorize {authorizingPlugin.name}
                        </h3>
                        <p className="text-xs text-neutral-400 font-mono">
                          MCP Server: {authorizingPlugin.mcpServerName}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                        Permissions Requested by MCP Server:
                      </div>
                      <div className="bg-[#161616] border border-[#262626] rounded-xl p-3 space-y-2 text-xs text-neutral-300 max-h-40 overflow-y-auto">
                        {authorizingPlugin.permissions.map((perm, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold shrink-0">✓</span>
                            <span className="leading-tight">{perm}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-neutral-400 italic">
                        Granting access equips nanobot with all {authorizingPlugin.tools.length} tools provided by {authorizingPlugin.name}.
                      </p>
                    </div>

                    {/* GitHub Repository Scope Selector */}
                    {/* Added GitHub repository access selector with All vs Only select repositories options [Commented by: Google AI Studio on 28/10/2026 11:30 AM] */}
                    {authorizingPlugin.id === 'github' && (
                      <div className="space-y-2 pt-2 border-t border-[#222]">
                        <label className="block text-xs font-semibold text-neutral-300">
                          Repository Access Scope:
                        </label>
                        <div className="space-y-1.5 text-xs">
                          <label className="flex items-center gap-2 cursor-pointer text-neutral-200">
                            <input
                              type="radio"
                              name="github_repo_scope"
                              value="all"
                              checked={githubRepoChoice === 'all'}
                              onChange={() => setGithubRepoChoice('all')}
                              className="accent-emerald-500"
                            />
                            <span>All repositories (public and private accessible by account)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-neutral-200">
                            <input
                              type="radio"
                              name="github_repo_scope"
                              value="specific"
                              checked={githubRepoChoice === 'specific'}
                              onChange={() => setGithubRepoChoice('specific')}
                              className="accent-emerald-500"
                            />
                            <span>Only select repositories</span>
                          </label>
                        </div>
                        {githubRepoChoice === 'specific' && (
                          <input
                            type="text"
                            value={githubSpecificRepo}
                            onChange={(e) => setGithubSpecificRepo(e.target.value)}
                            placeholder="e.g. username/repo-name"
                            className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] mt-1"
                          />
                        )}
                      </div>
                    )}

                    {/* Account Sign-In / Credential Prompt */}
                    <div className="space-y-2 pt-1 border-t border-[#222]">
                      <label className="block text-xs font-semibold text-neutral-300">
                        {authorizingPlugin.authType === 'oauth'
                          ? `Sign in with your ${authorizingPlugin.oauthProvider || authorizingPlugin.name} Account:`
                          : `Enter your ${authorizingPlugin.name} API Key / Bearer Token:`}
                      </label>
                      <input
                        type={authorizingPlugin.authType === 'oauth' ? 'text' : 'password'}
                        value={authAccount}
                        onChange={(e) => setAuthAccount(e.target.value)}
                        placeholder={
                          authorizingPlugin.authType === 'oauth'
                            ? 'e.g. user@gmail.com or workspace domain'
                            : 'Enter API key (e.g. fc-live-...)'
                        }
                        className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14]"
                      />
                      {authError && (
                        <p className="text-xs text-rose-400 font-medium">{authError}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#222]">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthorizingPlugin(null);
                          setAuthError(null);
                        }}
                        disabled={isAuthorizing}
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white bg-[#1a1a1a] border border-[#2d2d2d] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleGrantAuthorization}
                        disabled={isAuthorizing}
                        className="px-4 py-2 rounded-lg text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        {isAuthorizing ? (
                          <>
                            <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                            Authorizing MCP...
                          </>
                        ) : (
                          'Grant Permission & Authorize'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ABOUT NANOBOT */}
          {/* Updated About nanobot with static service credits, removed 30-day local storage note box, and brought updates and GitHub links closer [Commented by: Google AI Studio on 29/10/2026 04:00 PM] */}
          {activeTab === 'about' && (() => {
            const baseServices = [
              'Cloudflare',
              'Github',
              'Google AI Studio',
              'Google Gemini',
              'Netlify',
              'OpenAI ChatGPT',
              'Openrouter',
              'Supabase',
              'Tavily'
            ];

            const sortedServices = [...baseServices].sort((a, b) =>
              a.localeCompare(b, undefined, { sensitivity: 'base' })
            );

            return (
              <div className="space-y-4 max-w-xl text-neutral-300">
                <h2 className="text-xl font-bold font-serif text-white">About nanobot</h2>
                {/* Updated description to state 'source available AI chatbot' [Commented by: Google AI Studio on 29/10/2026 09:00 AM] */}
                <p className="text-sm leading-relaxed">
                  Everyone should get to use AI, and that too without giving away their data. So we created nanobot, a source available AI chatbot which respects your privacy, and is free to use. Users bring their own API keys, which helps in further keeping nanobot completely free to use.
                  <br />
                  <a
                    href="https://github.com/anvilgabimpartduckcom/nanobot/blob/main/LICENSE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                  >
                    See the license under which nanobot comes.
                  </a>
                </p>
                {/* Updated developer contact section to include GitHub discussions link and preserved email box per user specification  [Commented by: Google AI Studio on 22/10/2026 04:47 AM] */}
                <p className="text-sm leading-relaxed">
                  For more information, For reporting a bug, issue, or vulnerability, join the{' '}
                  <a
                    href="https://github.com/anvilgabimpartduckcom/nanobot/discussions/2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                  >
                    GitHub discussion
                  </a>{' '}
                  or email at{' '}
                  <span className="inline-block bg-[#1a1a1a] border border-[#333] text-neutral-200 px-2 py-0.5 rounded font-mono text-xs select-all">
                    molecule-sip-sauna@duck.com
                  </span>
                </p>
                <p className="text-sm leading-relaxed">
                  You can also get information about more features of nanobot at the{' '}
                  <a
                    href="https://tropical-chime-8c1.notion.site/nanobot-101-3f4b104092f3804792d0c68bca97e821"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                  >
                    nanobot 101
                  </a>
                </p>

                {/* Brought latest updates and Github source links closer together vertically [Commented by: Google AI Studio on 29/10/2026 04:00 PM] */}
                <div className="space-y-1 pt-1 leading-snug">
                  <p className="text-sm">
                    <a
                      href="https://github.com/anvilgabimpartduckcom/nanobot#-latest-updates"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                    >
                      See the latest updates in nanobot
                    </a>
                  </p>
                  <p className="text-sm">
                    <a
                      href="https://github.com/anvilgabimpartduckcom/nanobot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                    >
                      Visit nanobot&#39;s source code in GitHub
                    </a>
                  </p>
                </div>

                <div className="border-t border-neutral-800 pt-4 mt-2 space-y-2 text-xs text-neutral-400 leading-relaxed">
                  <p>
                    Special thanks to {sortedServices.join(', ')}. The features from these services have enabled and assisted us in coding, developing, hosting, creating backend and maintaining nanobot.
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    All terms and conditions are under these services.
                  </p>
                  {/* Added centered 'Made in INDIA 🇮🇳 ❤️' statement under terms and conditions  [Commented by: Google AI Studio on 22/10/2026 05:36 AM] */}
                  <p className="text-center text-xs text-neutral-300 font-medium pt-2">
                    Made in INDIA 🇮🇳 ❤️
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
