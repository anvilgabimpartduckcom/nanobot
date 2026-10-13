// {Created AuthModal supporting two-stage signup with custom email confirmation, uniqueness validation, and signin} [Commented by: Sonic on 10/12/2026 10:55 AM]

import React, { useState } from 'react';
import { supabase, isSupabaseConfigured, getLocalProfiles, saveLocalProfiles, UserProfile } from '../lib/supabase';
import { generateSalt } from '../lib/crypto';

interface AuthModalProps {
  mode: 'signin' | 'signup';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile, passwordSecret: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ mode, isOpen, onClose, onSuccess }) => {
  // Signup State
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [confirmLink, setConfirmLink] = useState('');

  // Credentials State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');

  // Feedback State
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Step 1: Send confirmation email
  const handleSendEmailConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      // Check if email already taken
      const existing = getLocalProfiles();
      if (existing.some((u) => u.email.toLowerCase() === trimmedEmail)) {
        throw new Error('This email address is already registered. Please sign in instead.');
      }

      if (isSupabaseConfigured && supabase) {
        const { error: signUpErr } = await supabase.auth.signInWithOtp({
          email: trimmedEmail,
          options: {
            emailRedirectTo: window.location.origin
          }
        });
        if (signUpErr) {
          console.warn('Supabase OTP notice:', signUpErr.message);
        }
      }

      // Generate verification link token for the custom email specification
      const token = Math.random().toString(36).substring(2, 15);
      const generatedLink = `${window.location.origin}#verify=${token}`;
      setConfirmLink(generatedLink);
      setEmailSent(true);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to initiate registration.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Create Account with global uniqueness check
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

    setLoading(true);
    try {
      const existingUsers = getLocalProfiles();

      // Check global uniqueness for all 4 parameters
      const emailTaken = existingUsers.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      const usernameTaken = existingUsers.some((u) => u.username.toLowerCase() === uName.toLowerCase());
      const orTaken = existingUsers.some((u) => u.openrouter_key === orKey);
      const tvTaken = existingUsers.some((u) => u.tavily_key === tvKey);

      if (emailTaken) throw new Error('Email is already registered.');
      if (usernameTaken) throw new Error('Username is already taken globally. Please choose another username.');
      if (orTaken) throw new Error('This OpenRouter API Key is already registered to another account.');
      if (tvTaken) throw new Error('This Tavily API Key is already registered to another account.');

      // Check Supabase if configured
      if (isSupabaseConfigured && supabase) {
        const { data: remoteUsers } = await supabase
          .from('user_profiles')
          .select('username, openrouter_key, tavily_key');

        if (remoteUsers) {
          if (remoteUsers.some((u) => u.username.toLowerCase() === uName.toLowerCase())) {
            throw new Error('Username is already registered globally.');
          }
          if (remoteUsers.some((u) => u.openrouter_key === orKey)) {
            throw new Error('This OpenRouter API Key is already in use.');
          }
          if (remoteUsers.some((u) => u.tavily_key === tvKey)) {
            throw new Error('This Tavily API Key is already in use.');
          }
        }
      }

      const salt = generateSalt();
      const newUser: UserProfile = {
        id: 'usr_' + Date.now(),
        email: email.trim().toLowerCase(),
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

      if (isSupabaseConfigured && supabase) {
        await supabase.from('user_profiles').insert([
          {
            email: newUser.email,
            username: newUser.username,
            openrouter_key: newUser.openrouter_key,
            tavily_key: newUser.tavily_key,
            ai_instructions: '',
            model_training: true,
            plugins_connected: newUser.plugins_connected
          }
        ]);
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

  // Sign In Handler
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
      const localUsers = getLocalProfiles();
      const matched = localUsers.find((u) => u.username.toLowerCase() === uName.toLowerCase());

      if (!matched) {
        throw new Error('No account found with this username. Please check your credentials or Sign Up.');
      }

      onSuccess(matched, pwd);
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Sign in failed.');
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

        {mode === 'signup' ? (
          <div>
            <h2 className="text-2xl font-bold font-serif mb-6 text-center text-white">
              Register to nanobot
            </h2>

            {signupStep === 1 ? (
              <div>
                {!emailSent ? (
                  <form onSubmit={handleSendEmailConfirm} className="space-y-4">
                    <div>
                      <label className="block text-sm text-neutral-300 mb-2 font-medium">
                        Enter Email Id
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14] transition-colors"
                      />
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors cursor-pointer"
                    >
                      {loading ? 'Sending...' : 'Confirm'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-[#111] border border-neutral-800 rounded-xl p-4 text-xs font-mono text-neutral-300 leading-relaxed">
                      <div className="font-bold text-neutral-200 border-b border-neutral-800 pb-2 mb-2">
                        Subject: Confirm Registering to nanobot
                      </div>
                      <p>Hey {email},</p>
                      <p className="my-2">
                        Thank You creating an account in nanobot. Please confirm below so that you can continue with the process and create your account:
                      </p>
                      <p className="my-2 text-emerald-400 break-all underline">
                        {confirmLink}
                      </p>
                      <p className="my-2">If this isn&#39;t you, you can safely ignore.</p>
                      <p className="mt-2 font-semibold">Regards, Sonic.</p>
                    </div>

                    <p className="text-xs text-neutral-400 text-center">
                      Email dispatch simulated. Click below to continue registration after confirmation.
                    </p>

                    <button
                      onClick={() => setSignupStep(2)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors cursor-pointer"
                    >
                      Proceed to Account Setup →
                    </button>
                  </div>
                )}
              </div>
            ) : (
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
                    className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14]"
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
                    placeholder="Enter secure password"
                    className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14]"
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
                    required
                    value={openrouterKey}
                    onChange={(e) => setOpenrouterKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14]"
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
                    required
                    value={tavilyKey}
                    onChange={(e) => setTavilyKey(e.target.value)}
                    placeholder="tvly-..."
                    className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14]"
                  />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  {loading ? 'Validating Uniqueness...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold font-serif mb-6 text-center text-white">
              Sign In to nanobot
            </h2>

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
                  className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14]"
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
                  className="w-full bg-[#141414] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#39ff14]"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors cursor-pointer"
              >
                {loading ? 'Checking...' : 'Confirm'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
