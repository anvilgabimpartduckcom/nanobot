// Removed email id login concept completely for direct username, password, and API keys entry on Sign Up, and implemented zero-knowledge client-side encryption for credentials saved to Supabase [Commented by: Google AI Studio on 16/10/2026 10:55 PM]

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

  // Visibility toggles for masked fields [Commented by: Google AI Studio on 30/10/2026 10:49 AM]
  const [showPassword, setShowPassword] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usernameTakenError, setUsernameTakenError] = useState(false);
  const [passwordTakenError, setPasswordTakenError] = useState(false);

  // Enabled copying from masked and credential inputs on Ctrl+C [Commented by: Google AI Studio on 30/10/2026 10:49 AM]
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

  if (!isOpen) return null;

  const handleSwitchMode = (targetMode: 'signin' | 'signup') => {
    setError(null);
    setUsernameTakenError(false);
    setPasswordTakenError(false);
    setCurrentMode(targetMode);
    if (onSwitchMode) onSwitchMode(targetMode);
  };

  // Direct Account Creation: Username, Password, OpenRouter Key, Tavily Key
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUsernameTakenError(false);
    setPasswordTakenError(false);

    const uName = username.trim();
    const pwd = password.trim();
    const orKey = openrouterKey.trim();
    const tvKey = tavilyKey.trim();

    if (!uName || !pwd || !orKey || !tvKey) {
      setError('All fields (Username, Password, OpenRouter Key, Tavily Key) are mandatory.');
      return;
    }

    setLoading(true);
    try {
      const existingUsers = getLocalProfiles();

      // Check username uniqueness locally and in Supabase; mark usernameTakenError if duplicate [Commented by: Google AI Studio on 22/10/2026 04:48 AM]
      let isUsernameTaken = existingUsers.some(
        (u) => u.username.toLowerCase() === uName.toLowerCase()
      );

      if (!isUsernameTaken && isSupabaseConfigured && supabase) {
        const { data: remoteUsers, error: sbCheckErr } = await supabase
          .from('user_profiles')
          .select('username')
          .ilike('username', uName);

        if (!sbCheckErr && remoteUsers && remoteUsers.length > 0) {
          isUsernameTaken = true;
        }
      }

      // Check password uniqueness using deterministic SHA-256 credential hashing; mark passwordTakenError if duplicate [Commented by: Google AI Studio on 22/10/2026 04:48 AM]
      const pwdBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode('nanobot_pass_salt_' + pwd)
      );
      const pwdHash = Array.from(new Uint8Array(pwdBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const registeredPwdHashes: string[] = JSON.parse(
        localStorage.getItem('nanobot_registered_password_hashes') || '[]'
      );
      let isPasswordTaken = registeredPwdHashes.includes(pwdHash);

      if (!isPasswordTaken && isSupabaseConfigured && supabase) {
        try {
          const { data: remotePwds } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('salt', pwdHash);
          if (remotePwds && remotePwds.length > 0) {
            isPasswordTaken = true;
          }
        } catch {
          // Ignore remote schema difference if column is absent
        }
      }

      if (isUsernameTaken || isPasswordTaken) {
        if (isUsernameTaken) setUsernameTakenError(true);
        if (isPasswordTaken) setPasswordTakenError(true);
        setLoading(false);
        return;
      }

      const salt = generateSalt();
      // Derive client-side zero-knowledge key from password and salt
      const cryptoKey = await deriveKeyFromPassword(pwd, salt);

      // Zero-Knowledge credential encryption: encrypt API keys before storing in Supabase so developer cannot read them [Commented by: Google AI Studio on 16/10/2026 10:55 PM]
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
          firecrawl: false
        },
        salt,
        // Set default theme to Neon Black for newly registered user [Commented by: Google AI Studio on 20/10/2026 11:47 AM]
        theme: 'Neon Black'
      };

      existingUsers.push(newUser);
      saveLocalProfiles(existingUsers);
      // Saved unique password hash to local registry ensuring passwords cannot be reused across accounts [Commented by: Google AI Studio on 22/10/2026 04:48 AM]
      registeredPwdHashes.push(pwdHash);
      localStorage.setItem('nanobot_registered_password_hashes', JSON.stringify(registeredPwdHashes));

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
            salt: newUser.salt,
            // Saved default theme alongside other user provided data in Supabase [Commented by: Google AI Studio on 20/10/2026 11:47 AM]
            theme: 'Neon Black'
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

      // Zero-Knowledge credential decryption: decrypt encrypted API keys locally in the browser [Commented by: Google AI Studio on 16/10/2026 10:55 PM]
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
            {/* Updated register subtitle to 'Enter your username, password, and API keys.' [Commented by: Google AI Studio on 22/10/2026 04:48 AM] */}
            <p className="text-xs text-neutral-400 text-center mb-6">
              Enter your username, password, and API keys.
            </p>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                {/* Rendered Username label with red 'Username already taken' error indicator beside it  [Commented by: Google AI Studio on 22/10/2026 04:48 AM] */}
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs uppercase tracking-wider text-neutral-400">
                    Username
                  </label>
                  {usernameTakenError && (
                    <span className="text-xs font-semibold text-red-500">
                      Username already taken
                    </span>
                  )}
                </div>
                {/* Updated username placeholder to 'Enter username'  [Commented by: Google AI Studio on 22/10/2026 04:48 AM] */}
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (usernameTakenError) setUsernameTakenError(false);
                  }}
                  placeholder="Enter username"
                  className={`w-full bg-[#141414] border ${usernameTakenError ? 'border-red-500 focus:border-red-500' : 'border-[#333] focus:border-[#39ff14]'} rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none transition-colors`}
                />
              </div>

              <div>
                {/* Rendered Password label with red 'Password already taken' error indicator beside it  [Commented by: Google AI Studio on 22/10/2026 04:48 AM] */}
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs uppercase tracking-wider text-neutral-400">
                    Password
                  </label>
                  {passwordTakenError && (
                    <span className="text-xs font-semibold text-red-500">
                      Password already taken
                    </span>
                  )}
                </div>
                {/* Masked by default with eye visibility toggle and copy support [Commented by: Google AI Studio on 30/10/2026 10:49 AM] */}
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordTakenError) setPasswordTakenError(false);
                    }}
                    onKeyDown={handleCredentialKeyDown}
                    placeholder="Enter password"
                    className={`w-full bg-[#141414] border ${passwordTakenError ? 'border-red-500 focus:border-red-500' : 'border-[#333] focus:border-[#39ff14]'} rounded-xl pl-4 pr-10 py-2.5 text-white placeholder-neutral-500 focus:outline-none transition-colors select-text`}
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
                <div className="relative flex items-center">
                  <input
                    type={showOpenRouterKey ? 'text' : 'password'}
                    required
                    value={openrouterKey}
                    onChange={(e) => setOpenrouterKey(e.target.value)}
                    onKeyDown={handleCredentialKeyDown}
                    placeholder="sk-or-v1-..."
                    className="w-full bg-[#141414] border border-[#333] rounded-xl pl-4 pr-10 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] transition-colors select-text"
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
                <div className="relative flex items-center">
                  <input
                    type={showTavilyKey ? 'text' : 'password'}
                    required
                    value={tavilyKey}
                    onChange={(e) => setTavilyKey(e.target.value)}
                    onKeyDown={handleCredentialKeyDown}
                    placeholder="tvly-..."
                    className="w-full bg-[#141414] border border-[#333] rounded-xl pl-4 pr-10 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] transition-colors select-text"
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

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>

              <div className="text-center pt-2 space-y-2">
                <div>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('signin')}
                    className="text-xs text-neutral-400 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    Already have an account? <span className="underline font-medium">Sign In</span>
                  </button>
                </div>
                {/* Updated help text to 'Need Help with creating account? Visit here' with lowercase 'a'  [Commented by: Google AI Studio on 22/10/2026 05:36 AM] */}
                <div>
                  <span className="text-xs text-neutral-400">
                    Need Help with creating account?{' '}
                    <a
                      href="https://tropical-chime-8c1.notion.site/How-to-set-up-nanobot-3fab104092f3801db298e6c12617a2be"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                    >
                      Visit here
                    </a>
                  </span>
                </div>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold font-serif mb-2 text-center text-white">
              Sign In to nanobot
            </h2>
            {/* Updated Sign In heading text per user instruction [Commented by: Google AI Studio on 30/10/2026 10:49 AM] */}
            <p className="text-xs text-neutral-400 text-center mb-6">
              Enter your username and password
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
                  onKeyDown={handleCredentialKeyDown}
                  placeholder="Enter username"
                  className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] transition-colors select-text"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showSignInPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleCredentialKeyDown}
                    placeholder="Enter password"
                    className="w-full bg-[#141414] border border-[#333] rounded-xl pl-4 pr-10 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] transition-colors select-text"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPassword((prev) => !prev)}
                    className="absolute right-3 text-neutral-400 hover:text-white transition-colors cursor-pointer p-1"
                    title={showSignInPassword ? 'Hide password' : 'Show password'}
                    aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                  >
                    {showSignInPassword ? (
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
