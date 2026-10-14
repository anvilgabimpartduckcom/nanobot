// {Created two-column SettingsModal with Account, AI Configuration, MCP Plugins, and Notion Docs} [Commented by: Sonic on 10/12/2026 10:56 AM]

import React, { useState } from 'react';
import { UserProfile, supabase, isSupabaseConfigured, getLocalProfiles, saveLocalProfiles } from '../lib/supabase';
import { MCP_PLUGINS } from '../lib/plugins';

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
      firecrawl: false,
      tavily: false
    }
  );

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Account Save
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

      // Update Supabase if configured
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('user_profiles')
          .update({
            username: updated.username,
            openrouter_key: updated.openrouter_key,
            tavily_key: updated.tavily_key,
            model_training: updated.model_training,
            ai_instructions: updated.ai_instructions,
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

  // Handle Plugin toggle
  const handleTogglePlugin = (pluginId: string) => {
    const nextPlugins = {
      ...connectedPlugins,
      [pluginId]: !connectedPlugins[pluginId]
    };
    setConnectedPlugins(nextPlugins);
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

          <button
            onClick={() => setActiveTab('plugins')}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'plugins'
                ? 'bg-[#1a1a1a] text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-[#121212]'
            }`}
          >
            Plugins
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
              {/* {Added Supabase Cloud connectivity indicator in Account settings} [Commented by: Sonic on 10/13/2026 03:20 AM] */}
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

          {/* TAB 3: PLUGINS */}
          {activeTab === 'plugins' && (
            <div className="space-y-4 max-w-xl">
              <div>
                <h2 className="text-xl font-bold font-serif mb-1">Plugins Hub</h2>
                <p className="text-xs text-neutral-400">
                  Connect nanobot to external services using MCP servers. The model will automatically invoke these tools when you ask it to.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {MCP_PLUGINS.map((plugin) => {
                  const isConnected = Boolean(connectedPlugins[plugin.id]);
                  return (
                    <div
                      key={plugin.id}
                      className="flex items-center justify-between p-3.5 bg-[#141414] border border-[#262626] rounded-xl hover:border-[#383838] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={plugin.iconUrl}
                          alt={plugin.name}
                          className="w-7 h-7 object-contain rounded"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center gap-2">
                            {plugin.name}
                            {isConnected && (
                              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-mono">
                                Connected
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-neutral-400 leading-tight">
                            {plugin.description}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTogglePlugin(plugin.id)}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg cursor-pointer transition-colors ${
                          isConnected
                            ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                        }`}
                        title={isConnected ? 'Disconnect plugin' : 'Connect via MCP Server'}
                        aria-label={isConnected ? `Disconnect ${plugin.name}` : `Connect ${plugin.name}`}
                      >
                        {isConnected ? '✓' : '+'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: ABOUT NANOBOT */}
          {/* {Updated About nanobot documentation with privacy statement, developer contact, hyperlinked docs, and 30-day chat deletion policy notes} [Commented by: Sonic on 10/14/2026 10:35 AM] */}
          {activeTab === 'about' && (
            <div className="space-y-4 max-w-xl text-neutral-300">
              <h2 className="text-xl font-bold font-serif text-white">About nanobot</h2>
              <p className="text-sm leading-relaxed">
                Everyone should get to use AI, and that too without giving away their data. So we created nanobot, an open source AI chatbot which respects your privacy, and is free to use. Users bring their own API keys, which helps in further keeping nanobot completely free to use.
              </p>
              <p className="text-sm leading-relaxed">
                For more information, or under any problems, please contact developer via email:{' '}
                <a
                  href="mailto:molecule-sip-sauna@duck.com"
                  className="text-emerald-400 hover:underline font-mono"
                >
                  molecule-sip-sauna@duck.com
                </a>
              </p>
              <p className="text-sm leading-relaxed">
                You can also get more info at the{' '}
                <a
                  href="https://tropical-chime-8c1.notion.site/nanobot-Docs-3f4b104092f3804792d0c68bca97e821"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  nanobot Docs
                </a>
              </p>

              <div className="bg-[#141414] border border-[#333] rounded-xl p-4 space-y-2 mt-4 text-xs text-neutral-300">
                <div className="font-semibold text-white text-sm">Note:</div>
                <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                  <li>
                    nanobot has a 30-days chat deletion policy. Any chat inactive for 30 days will be automatically deleted. This is required for storage purposes. On top of that, we request you to delete any chat that you have no longer use for. Your deleting of one chat will help another user create a new chat.
                  </li>
                  <li>
                    Though we&#39;ve given our best not to have any data loss, some of your data might get deleted. Though this&#39;ll be extremely rare, we recommend to keep a backup of any important chats or data. nanobot or its developer will not be responsible for any data loss.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
