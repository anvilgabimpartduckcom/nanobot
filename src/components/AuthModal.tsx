// {Removed email id login concept completely for direct username, password, and API keys entry on Sign Up, and implemented zero-knowledge client-side encryption for credentials saved to Supabase} [Commented by: Google AI Studio on 16/10/2026 10:55 PM]

import React, { useState } from 'react';
import { supabase, isSupabaseConfigured, getLocalProfiles, saveLocalProfiles, UserProfile } from '../lib/supabase';
import { generateSalt, deriveKeyFromPassword, encryptText, decryptText } from '../lib/crypto';

interface AuthModalProps {
  mode: 'signin' | 'signup';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile, passwordSecret: string) => void;
  onSwitchMode?: (mode: 'signin' | 'signup') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  mode: initialMode,
  isOpen,
  onClose,
  onSuccess,
  onSwitchMode
}) => {
  const [currentMode, setCurrentMode] = useState<'signin' | 'signup'>(initialMode);

  // Credentials State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');

  // Feedback State
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSwitchMode = (targetMode: 'signin' | 'signup') => {
    setError(null);
    setCurrentMode(targetMode);
    if (onSwitchMode) onSwitchMode(targetMode);
  };

  // Direct Account Creation: Username, Password, OpenRouter Key, Tavily Key
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const uName = username.trim();
    const pwd = password.trim();
    const orKey = openrouterKey.trim();
    const tvKey = tavilyKey.trim();

    if (!uName || !pwd || !orKey || !tvKey) {
      setError('All fields (Username, Password, OpenRouter Key, Tavily Key) are mandatory.');
      return;
    }

    if (pwd.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const existingUsers = getLocalProfiles();

      // Check global username uniqueness locally
      const usernameTaken = existingUsers.some(
        (u) => u.username.toLowerCase() === uName.toLowerCase()
      );
      if (usernameTaken) {
        throw new Error('Username is already taken. Please choose another username.');
      }

      // Check remote Supabase table uniqueness if connected
      if (isSupabaseConfigured && supabase) {
        const { data: remoteUsers, error: sbCheckErr } = await supabase
          .from('user_profiles')
          .select('username')
          .ilike('username', uName);

        if (!sbCheckErr && remoteUsers && remoteUsers.length > 0) {
          throw new Error('Username is already registered globally. Please choose another.');
        }
      }

      const salt = generateSalt();
      // Derive client-side zero-knowledge key from password and salt
      const cryptoKey = await deriveKeyFromPassword(pwd, salt);

      // {Zero-Knowledge credential encryption: encrypt API keys before storing in Supabase so developer cannot read them} [Commented by: Google AI Studio on 16/10/2026 10:55 PM]
      const encryptedOpenRouterKey = await encryptText(orKey, cryptoKey, salt);
      const encryptedTavilyKey = await encryptText(tvKey, cryptoKey, salt);

      const generatedUserId = 'usr_' + Date.now();
      const internalEmail = `${uName.toLowerCase().replace(/[^a-z0-9_-]/g, '')}@nanobot.internal`;

      // Memory/local profile keeps decrypted keys for client-side chat execution
      const newUser: UserProfile = {
        id: generatedUserId,
        email: internalEmail,
        username: uName,
        openrouter_key: orKey,
        tavily_key: tvKey,
        ai_instructions: '',
        model_training: true,
        plugins_connected: {
          google_drive: false,
          gmail: false,
          google_docs: false,
          notion: false,
          firecrawl: false,
          tavily: false
        },
        salt
      };

      existingUsers.push(newUser);
      saveLocalProfiles(existingUsers);

      // Save encrypted profile to remote Supabase user_profiles (stored as ciphertexts, unreadable by admin)
      if (isSupabaseConfigured && supabase) {
        const { error: insertErr } = await supabase.from('user_profiles').insert([
          {
            email: internalEmail,
            username: uName,
            openrouter_key: encryptedOpenRouterKey,
            tavily_key: encryptedTavilyKey,
            ai_instructions: '',
            model_training: true,
            plugins_connected: newUser.plugins_connected,
            salt: newUser.salt
          }
        ]);

        if (insertErr) {
          console.warn('Supabase remote profile notice:', insertErr.message);
        }
      }

      onSuccess(newUser, pwd);
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Error creating account.');
    } finally {
      setLoading(false);
    }
  };

  // Sign In Handler: Username + Password only
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const uName = username.trim();
    const pwd = password.trim();

    if (!uName || !pwd) {
      setError('Please provide both username and password.');
      return;
    }

    setLoading(true);
    try {
      let matched: UserProfile | null = null;

      // 1. Query remote Supabase user_profiles
      if (isSupabaseConfigured && supabase) {
        const { data, error: sbErr } = await supabase
          .from('user_profiles')
          .select('*')
          .ilike('username', uName)
          .maybeSingle();

        if (data && !sbErr) {
          matched = data as UserProfile;
        }
      }

      // 2. Query local profile store as fallback
      if (!matched) {
        const localUsers = getLocalProfiles();
        matched = localUsers.find((u) => u.username.toLowerCase() === uName.toLowerCase()) || null;
      }

      if (!matched) {
        throw new Error('No account found with this username. Please check your credentials or Sign Up.');
      }

      // {Zero-Knowledge credential decryption: decrypt encrypted API keys locally in the browser} [Commented by: Google AI Studio on 16/10/2026 10:55 PM]
      const derivedKey = await deriveKeyFromPassword(pwd, matched.salt || 'default_nanobot_salt');
      const decryptedOr = await decryptText(matched.openrouter_key, derivedKey);
      const decryptedTv = await decryptText(matched.tavily_key, derivedKey);
      const decryptedInstructions = await decryptText(matched.ai_instructions || '', derivedKey);

      matched.openrouter_key = decryptedOr;
      matched.tavily_key = decryptedTv;
      matched.ai_instructions = decryptedInstructions;

      onSuccess(matched, pwd);
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Sign in failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-[#0a0a0a] border border-[#333] rounded-2xl p-6 sm:p-8 text-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white text-xl p-1"
          aria-label="Close"
        >
          ✕
        </button>

        {currentMode === 'signup' ? (
          <div>
            <h2 className="text-2xl font-bold font-serif mb-2 text-center text-white">
              Register to nanobot
            </h2>
            <p className="text-xs text-neutral-400 text-center mb-6">
              Enter your username, password, and personal API keys. No email required.
            </p>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter unique username"
                  className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter secure password (min 6 chars)"
                  className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] transition-colors"
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
                  type="text"
                  required
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] transition-colors"
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
                  type="text"
                  required
                  value={tavilyKey}
                  onChange={(e) => setTavilyKey(e.target.value)}
                  placeholder="tvly-..."
                  className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] transition-colors"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signin')}
                  className="text-xs text-neutral-400 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  Already have an account? <span className="underline font-medium">Sign In</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold font-serif mb-2 text-center text-white">
              Sign In to nanobot
            </h2>
            <p className="text-xs text-neutral-400 text-center mb-6">
              Enter your username and password to load your zero-knowledge encrypted chats.
            </p>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] transition-colors"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signup')}
                  className="text-xs text-neutral-400 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  Don't have an account? <span className="underline font-medium">Sign Up</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
