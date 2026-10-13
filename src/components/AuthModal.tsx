// {Replaced simulated email card with real Supabase Auth inbox confirmation and auth state detection} [Commented by: Sonic on 10/13/2026 10:44 AM]

import React, { useState, useEffect } from 'react';
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

  // Credentials State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');

  // Feedback State
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-detect when the user confirms their email in their inbox and returns to the app
  useEffect(() => {
    if (!supabase) return;

    // Check if the current URL hash or session contains a verified user from an email confirmation link
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        setSignupStep(2);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session?.user?.email) {
          setEmail(session.user.email);
          setSignupStep(2);
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  if (!isOpen) return null;

  // Step 1: Send real confirmation email using Supabase Auth
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
      // Check if email is already registered locally
      const existing = getLocalProfiles();
      if (existing.some((u) => u.email.toLowerCase() === trimmedEmail)) {
        throw new Error('This email address is already registered. Please sign in instead.');
      }

      // Dispatch real confirmation email via Supabase Auth
      if (isSupabaseConfigured && supabase) {
        const { error: signUpErr } = await supabase.auth.signInWithOtp({
          email: trimmedEmail,
          options: {
            emailRedirectTo: window.location.origin
          }
        });
        if (signUpErr) {
          throw new Error(`Supabase Auth: ${signUpErr.message}`);
        }
      }

      setEmailSent(true);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to dispatch confirmation email.');
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Handler
  const handleGoogleOAuth = async () => {
    setError(null);
    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase is not configured yet. Please check Netlify environment variables.');
      return;
    }
    setLoading(true);
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (oauthErr) {
        throw new Error(`Google OAuth: ${oauthErr.message}`);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Google OAuth failed.');
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

      // Check remote Supabase table uniqueness if configured
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
        // Also check remote Supabase user_profiles if available
        if (isSupabaseConfigured && supabase) {
          const { data } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('username', uName)
            .single();

          if (data) {
            onSuccess(data as UserProfile, pwd);
            onClose();
            return;
          }
        }
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
                      {loading ? 'Sending confirmation email...' : 'Confirm'}
                    </button>

                    {/* Google OAuth Option */}
                    <div className="pt-3 border-t border-neutral-800">
                      <button
                        type="button"
                        onClick={handleGoogleOAuth}
                        disabled={loading}
                        className="w-full bg-[#141414] hover:bg-[#1f1f1f] border border-[#333] text-neutral-300 py-2.5 px-4 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path
                            fill="#EA4335"
                            d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z"
                          />
                          <path
                            fill="#4285F4"
                            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7s.2-2 .4-2.7L1.9 6.4C.7 8.8 0 10.3 0 12s.7 3.2 1.9 5.6l3.7-2.9z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.2 7.5 23 12 23z"
                          />
                        </svg>
                        <span>Continue with Google OAuth</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4 text-center">
                    <div className="w-16 h-16 bg-[#141414] border border-[#333] rounded-2xl flex items-center justify-center mx-auto text-3xl">
                      ✉️
                    </div>

                    <h3 className="text-lg font-semibold text-white">Confirmation Email Dispatched!</h3>

                    <p className="text-sm text-neutral-300 leading-relaxed">
                      A real confirmation email has been dispatched to{' '}
                      <span className="text-emerald-400 font-semibold">{email}</span>.
                    </p>

                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Please check your inbox (and spam/junk folder) and click the confirmation link. You will be automatically returned here to finalize your username and API keys.
                    </p>

                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        onClick={async () => {
                          setLoading(true);
                          if (supabase) {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (session?.user?.email) {
                              setEmail(session.user.email);
                            }
                          }
                          setSignupStep(2);
                          setLoading(false);
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors cursor-pointer"
                      >
                        I&#39;ve Confirmed in My Inbox →
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEmailSent(false);
                          setError(null);
                        }}
                        className="text-xs text-neutral-400 hover:text-white"
                      >
                        ← Resend or change email
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="p-2.5 bg-emerald-950/40 border border-emerald-800 rounded-xl text-xs text-emerald-400 text-center font-medium">
                  ✓ Email confirmed ({email}). Complete your account details:
                </div>

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

              {/* Google OAuth Option */}
              <div className="pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={handleGoogleOAuth}
                  disabled={loading}
                  className="w-full bg-[#141414] hover:bg-[#1f1f1f] border border-[#333] text-neutral-300 py-2.5 px-4 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7s.2-2 .4-2.7L1.9 6.4C.7 8.8 0 10.3 0 12s.7 3.2 1.9 5.6l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.2 7.5 23 12 23z"
                    />
                  </svg>
                  <span>Sign In with Google OAuth</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
