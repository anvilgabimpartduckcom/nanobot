// Nanobot AuthModal: Genuine Supabase Auth, Strict Username Identification, Zero-Knowledge Credential Encryption, and PostgREST RLS Security [Commented by: Google AI Studio on 01/11/2026 01:55 PM]

import React, { useState } from 'react';
import { UserProfile, signUpWithUsername, signInWithUsername, checkUsernameAvailable } from '../lib/supabase';

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
  onSwitchMode,
}) => {
  const [currentMode, setCurrentMode] = useState<'signin' | 'signup'>(initialMode);

  // Credentials State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');

  // Visibility toggles for masked fields
  const [showPassword, setShowPassword] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usernameTakenError, setUsernameTakenError] = useState(false);

  // Enabled copying from masked and credential inputs on Ctrl+C / Cmd+C [Commented by: Google AI Studio on 01/11/2026 01:55 PM]
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
    setCurrentMode(targetMode);
    if (onSwitchMode) onSwitchMode(targetMode);
  };

  // Direct Account Creation: Username, Password, OpenRouter Key, Tavily Key via genuine Supabase Auth [Commented by: Google AI Studio on 01/11/2026 01:55 PM]
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUsernameTakenError(false);

    const uName = username.trim();
    const pwd = password.trim();
    const orKey = openrouterKey.trim();
    const tvKey = tavilyKey.trim();

    if (!uName || !pwd || !orKey || !tvKey) {
      setError('All fields (Username, Password, OpenRouter Key, Tavily Key) are mandatory.');
      return;
    }

    if (pwd.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      // Pre-check username availability
      const isAvailable = await checkUsernameAvailable(uName);
      if (!isAvailable) {
        setUsernameTakenError(true);
        setLoading(false);
        return;
      }

      const { user } = await signUpWithUsername(uName, pwd, orKey, tvKey);
      onSuccess(user, pwd);
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      if (e.message && e.message.toLowerCase().includes('already taken')) {
        setUsernameTakenError(true);
      } else {
        setError(e.message || 'Error creating account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sign In Handler: Username + Password via genuine Supabase Auth session [Commented by: Google AI Studio on 01/11/2026 01:55 PM]
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
      const { user } = await signInWithUsername(uName, pwd);
      onSuccess(user, pwd);
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
          className="absolute top-4 right-4 text-neutral-400 hover:text-white text-xl p-1 cursor-pointer"
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
              Enter your username, password, and API keys.
            </p>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
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
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (usernameTakenError) setUsernameTakenError(false);
                  }}
                  onKeyDown={handleCredentialKeyDown}
                  placeholder="Enter username"
                  className={`w-full bg-[#141414] border ${
                    usernameTakenError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-[#333] focus:border-[#39ff14]'
                  } rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none transition-colors select-text`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs uppercase tracking-wider text-neutral-400">
                    Password
                  </label>
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleCredentialKeyDown}
                    placeholder="Enter password (min. 6 characters)"
                    className="w-full bg-[#141414] border border-[#333] rounded-xl pl-4 pr-10 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] transition-colors select-text"
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
