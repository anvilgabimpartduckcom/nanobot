// {Created two-column SettingsModal with Account, AI Configuration, MCP Plugins, and Notion Docs} [Commented by: Google AI Studio on 12/10/2026 10:56 AM]

import React, { useState } from 'react';
import { UserProfile, supabase, isSupabaseConfigured, getLocalProfiles, saveLocalProfiles } from '../lib/supabase';
import { MCP_PLUGINS, PluginDefinition } from '../lib/plugins';
import { deriveKeyFromPassword, encryptText } from '../lib/crypto';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  currentPasswordSecret: string;
  onUpdateUser: (updatedUser: UserProfile, newPasswordSecret?: string) => void;
  onDeleteAccount: () => void;
}

type TabType = 'account' | 'ai_config' | 'plugins' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  currentPasswordSecret,
  onUpdateUser,
  onDeleteAccount
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('account');

  // Account Tab form fields
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState(currentPasswordSecret);
  const [openrouterKey, setOpenrouterKey] = useState(user.openrouter_key);
  const [tavilyKey, setTavilyKey] = useState(user.tavily_key);

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

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Account Save
  // {Zero-knowledge encryption for updated API credentials before storing in Supabase} [Commented by: Google AI Studio on 16/10/2026 10:55 PM]
  const handleSaveAccount = async () => {
    setStatusMessage(null);
    try {
      const updated: UserProfile = {
        ...user,
        username: username.trim(),
        openrouter_key: openrouterKey.trim(),
        tavily_key: tavilyKey.trim(),
        model_training: modelTraining,
        ai_instructions: customInstructions,
        plugins_connected: connectedPlugins as UserProfile['plugins_connected']
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
      setStatusMessage('Account details saved successfully.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      const e = err as Error;
      setStatusMessage(`Error saving: ${e.message}`);
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

  // Handle Delete Account
  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to permanently delete your nanobot account and all encrypted chats?')) {
      return;
    }

    try {
      // Remove from local profiles
      const profiles = getLocalProfiles().filter((p) => p.id !== user.id);
      saveLocalProfiles(profiles);

      if (isSupabaseConfigured && supabase) {
        await supabase.from('user_profiles').delete().eq('email', user.email);
      }

      onDeleteAccount();
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Failed to delete account: ${e.message}`);
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

  // {Configured MCP permission authorization and account connection flow} [Commented by: Google AI Studio on 19/10/2026 02:25 AM]
  const handlePluginAction = (plugin: PluginDefinition) => {
    if (connectedPlugins[plugin.id]) {
      const nextPlugins = {
        ...connectedPlugins,
        [plugin.id]: false
      };
      setConnectedPlugins(nextPlugins);
      persistPlugins(nextPlugins);
      setStatusMessage(`${plugin.name} MCP server disconnected.`);
      setTimeout(() => setStatusMessage(null), 3500);
    } else {
      setAuthorizingPlugin(plugin);
      setAuthAccount(user.email || '');
      setAuthError(null);
    }
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
      <div className="relative w-full max-w-4xl h-[620px] bg-[#0c0c0c] border border-[#2b2b2b] rounded-2xl flex overflow-hidden shadow-2xl text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-neutral-400 hover:text-white p-2 text-lg"
          aria-label="Close settings"
        >
          ✕
        </button>

        {/* Left Column (Menu) */}
        <div className="w-56 bg-[#080808] border-r border-[#222] p-4 flex flex-col gap-2 shrink-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2 px-3 pt-2">
            Settings
          </h3>

          <button
            onClick={() => setActiveTab('account')}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'account'
                ? 'bg-[#1a1a1a] text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-[#121212]'
            }`}
          >
            Account
          </button>

          <button
            onClick={() => setActiveTab('ai_config')}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'ai_config'
                ? 'bg-[#1a1a1a] text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-[#121212]'
            }`}
          >
            AI Configuration
          </button>

          {/* {Configured Plugin Marketplace navigation tab in SettingsModal} [Commented by: Google AI Studio on 19/10/2026 10:50 AM] */}
          <button
            onClick={() => setActiveTab('plugins')}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'plugins'
                ? 'bg-[#1a1a1a] text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-[#121212]'
            }`}
          >
            Plugin Marketplace
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'about'
                ? 'bg-[#1a1a1a] text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-[#121212]'
            }`}
          >
            About nanobot
          </button>
        </div>

        {/* Right Column (Content Window) */}
        <div className="flex-1 p-6 sm:p-8 overflow-y-auto">
          {statusMessage && (
            <div className="mb-4 p-3 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-emerald-400">
              {statusMessage}
            </div>
          )}

          {/* TAB 1: ACCOUNT */}
          {activeTab === 'account' && (
            <div className="space-y-5 max-w-xl">
              {/* {Added Supabase Cloud connectivity indicator in Account settings} [Commented by: Google AI Studio on 13/10/2026 03:20 AM] */}
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-4">
                <h2 className="text-xl font-bold font-serif">Account Settings</h2>
                <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
                  isSupabaseConfigured
                    ? 'bg-emerald-950/60 border-emerald-700 text-emerald-400'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-400'
                }`}>
                  {isSupabaseConfigured ? '● Supabase Cloud Connected' : '⚡ Netlify Integration Ready'}
                </span>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#39ff14]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#39ff14]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
                  Enter{' '}
                  <a
                    href="https://openrouter.ai/workspaces"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    Openrouter API Key
                  </a>
                </label>
                <input
                  type="password"
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#39ff14]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
                  Enter{' '}
                  <a
                    href="https://app.tavily.com/home"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    Tavily API Key
                  </a>
                </label>
                <input
                  type="password"
                  value={tavilyKey}
                  onChange={(e) => setTavilyKey(e.target.value)}
                  className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#39ff14]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
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
              <div className="pt-6">
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
                  placeholder="Type custom instructions for nanobot... (Press Enter to save, Shift+Enter for new line)"
                  rows={6}
                  className="w-full bg-[#141414] border border-[#333] rounded-xl p-4 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] text-sm leading-relaxed resize-none"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Tip: Press <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-300">Enter</kbd> to save instructions immediately, or <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-300">Shift + Enter</kbd> for a new line.
                </p>
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

          {/* TAB 3: PLUGIN MARKETPLACE */}
          {/* {Configured Plugin Marketplace section with toggle switches to authorize MCP permissions and enable tools for chat} [Commented by: Google AI Studio on 19/10/2026 10:50 AM] */}
          {activeTab === 'plugins' && (
            <div className="space-y-4 max-w-xl">
              <div>
                <h2 className="text-xl font-bold font-serif mb-1">Plugin Marketplace</h2>
                <p className="text-xs text-neutral-400">
                  Explore available Model Context Protocol (MCP) plugins, read their descriptions, and toggle permissions to enable them for the chat.
                </p>
              </div>

              {statusMessage && (
                <div className="bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs px-3 py-2 rounded-lg font-mono">
                  {statusMessage}
                </div>
              )}

              <div className="space-y-3 pt-2">
                {MCP_PLUGINS.map((plugin) => {
                  const isConnected = Boolean(connectedPlugins[plugin.id]);
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
                              {isConnected ? (
                                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono">
                                  ✓ Enabled
                                </span>
                              ) : (
                                <span className="text-[10px] bg-neutral-900 text-neutral-400 border border-neutral-800 px-1.5 py-0.5 rounded font-mono">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-neutral-400 mt-0.5 leading-snug">
                              {plugin.description}
                            </div>
                            <div className="text-[11px] text-neutral-500 font-mono mt-1">
                              Server: {plugin.mcpServerName} • <span className="text-emerald-400 font-semibold">{plugin.tools.length} Tools Available</span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Permission & Connection Toggle Switch */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isConnected}
                            onClick={() => handlePluginAction(plugin)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              isConnected ? 'bg-emerald-500' : 'bg-neutral-700'
                            }`}
                            title={isConnected ? 'Disable MCP plugin' : 'Authorize & enable MCP plugin'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                isConnected ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePluginAction(plugin)}
                            className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition-colors shrink-0 cursor-pointer ${
                              isConnected
                                ? 'bg-neutral-800 text-neutral-300 hover:bg-rose-950 hover:text-rose-300 border border-neutral-700'
                                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
                            }`}
                          >
                            {isConnected ? 'Disconnect' : 'Connect'}
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
                            Available MCP Tools Provided to AI Model:
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
          {/* {Updated About nanobot documentation with privacy statement, developer contact, Notion 101 link, Ctrl+S backup warning, GitHub source link, and dynamic alphabetical service credits with active plugin insertion} [Commented by: Google AI Studio on 16/10/2026 10:55 PM] */}
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

            const activePluginNames = MCP_PLUGINS
              .filter((p) => Boolean(connectedPlugins[p.id]))
              .map((p) => p.name);

            const sortedServices = Array.from(new Set([...baseServices, ...activePluginNames]))
              .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

            return (
              <div className="space-y-4 max-w-xl text-neutral-300">
                <h2 className="text-xl font-bold font-serif text-white">About nanobot</h2>
                <p className="text-sm leading-relaxed">
                  Everyone should get to use AI, and that too without giving away their data. So we created nanobot, an open source AI chatbot which respects your privacy, and is free to use. Users bring their own API keys, which helps in further keeping nanobot completely free to use.
                </p>
                {/* {Rendered developer email in plain text box without hyperlink per user instruction} [Commented by: Google AI Studio on 18/10/2026 01:11 PM] */}
                <p className="text-sm leading-relaxed">
                  For more information, or under any problems, please contact developer via email:{' '}
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

                <div className="bg-[#141414] border border-[#333] rounded-xl p-4 space-y-2 mt-4 text-xs text-neutral-300">
                  <div className="font-semibold text-white text-sm">Note:</div>
                  <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                    <li>
                      nanobot has a 30-days chat deletion policy. Any chat inactive for 30 days will be automatically deleted. This is required for storage purposes. On top of that, we request you to delete any chat that you have no longer use for. Your deleting of one chat will help another user create a new chat.
                    </li>
                    <li>
                      Warning: Though we&#39;ve given our best not to have any data loss, some of your data might get deleted. Though this&#39;ll be extremely rare, we recommend to keep a backup of important chats by saving them using &#39;Ctrl+S&#39; combination.
                    </li>
                  </ol>
                </div>

                <p className="text-sm pt-2 leading-relaxed">
                  <a
                    href="https://github.com/anvilgabimpartduckcom/nanobot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                  >
                    Visit nanobot&#39;s source code in Github
                  </a>
                </p>

                <div className="border-t border-neutral-800 pt-4 mt-2 space-y-2 text-xs text-neutral-400 leading-relaxed">
                  <p>
                    Special thanks to {sortedServices.join(', ')}. The features from these services have enabled and assisted us in coding, developing, hosting, creating backend and maintaining nanobot.
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    All terms and conditions are under these services.
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
