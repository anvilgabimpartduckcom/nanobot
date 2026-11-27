// Created two-column SettingsModal with Account, AI Configuration, live MCP Add-ons, and About nanobot [Commented by: Google AI Studio on 31/10/2026 10:31 PM]

import React, { useState, useEffect } from 'react';
// Replaced localStorage profile cache helpers with legacy cache cleanup and encrypted Supabase updates; added signOutSupabase import [Commented by: Google AI Studio at 23/11/2026 22:53]
import {
  UserProfile,
  supabase,
  isSupabaseConfigured,
  clearLegacyLocalProfileCache,
  signOutSupabase,
  deleteUserAccountFromSupabase,
  updateAccountPasswordInSupabase,
  updateUserProfileInSupabase
} from '../lib/supabase';
import { MCP_PLUGINS, PluginDefinition } from '../lib/plugins';
import { deriveKeyFromPassword, encryptText, decryptText } from '../lib/crypto';
import { workerClient, WORKER_BASE_URL, McpConnection, McpTool, AdminUserRecord } from '../lib/workerClient';


// Added theme toggle support between Neon Black and Minimalist Light themes in SettingsModal [Commented by: Google AI Studio on 20/10/2026 11:28 PM]
export type AppTheme = 'Neon Black' | 'Minimalist Light';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  currentPasswordSecret: string;
  onUpdateUser: (updatedUser: UserProfile, newPasswordSecret?: string) => void;
  // Added onLogout callback prop for clean session termination [Commented by: Google AI Studio at 23/11/2026 22:53]
  onLogout: () => void;
  onDeleteAccount: () => void;
  theme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
}

type TabType = 'account' | 'ai_config' | 'plugins' | 'admin' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  currentPasswordSecret,
  onUpdateUser,
  onLogout,
  onDeleteAccount,
  theme,
  onThemeChange
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(
    () => theme || (user.theme as AppTheme) || (localStorage.getItem('nanobot_theme') as AppTheme) || 'Neon Black'
  );

  const isLight = currentTheme === 'Minimalist Light';

  // Stored theme strictly in browser localStorage without syncing to remote backend [Commented by: Google AI Studio on 30/10/2026 11:00 PM]
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

  // Visibility toggles for masked fields in Account Settings [Commented by: Google AI Studio on 30/10/2026 10:50 PM]
  const [showPassword, setShowPassword] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);

  // Enabled copying from masked and credential inputs on Ctrl+C [Commented by: Google AI Studio on 30/10/2026 10:50 PM]
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

  // Genuine live MCP connection state backed by Cloudflare Worker REST API [Commented by: Google AI Studio on 31/10/2026 11:05 PM]
  const [liveMcpConnections, setLiveMcpConnections] = useState<Record<string, McpConnection>>({});
  const [isLoadingMcp, setIsLoadingMcp] = useState<boolean>(false);
  const [disconnectingPluginId, setDisconnectingPluginId] = useState<string | null>(null);
  const [testingPluginId, setTestingPluginId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: string; toolsCount?: number; error?: string | null }>>({});

  const [authorizingPlugin, setAuthorizingPlugin] = useState<PluginDefinition | null>(null);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [pendingOAuthFlow, setPendingOAuthFlow] = useState<{
    plugin: PluginDefinition;
    authorizationUrl: string;
    prevUpdatedAt: string;
  } | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authAccount, setAuthAccount] = useState('');
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [expandedToolsPluginId, setExpandedToolsPluginId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'connected' | 'available'>('all');

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Server-verified administrator session state (never cached in localStorage or UserProfile) [Commented by: Google AI Studio at 27/11/2026 21:10]
  const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [adminTotalCount, setAdminTotalCount] = useState<number>(0);
  const [isLoadingAdminUsers, setIsLoadingAdminUsers] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccessMessage, setAdminSuccessMessage] = useState<string | null>(null);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<AdminUserRecord | null>(null);
  const [isDeletingAdminUser, setIsDeletingAdminUser] = useState(false);
  const [deleteTargetError, setDeleteTargetError] = useState<string | null>(null);

  const fetchLiveMcpConnections = async () => {
    setIsLoadingMcp(true);
    try {
      const res = await workerClient.getMcpTools();
      if (res.success && res.data?.connections) {
        const map: Record<string, McpConnection> = {};
        res.data.connections.forEach((c) => {
          map[c.providerId] = c;
        });
        setLiveMcpConnections(map);
      }
    } catch (e) {
      console.warn('Failed to fetch live MCP tools:', e);
    } finally {
      setIsLoadingMcp(false);
    }
  };

  // Clear stale admin list and status banners on fetch error or refresh [Commented by: Google AI Studio at 27/11/2026 21:17]
  const fetchAdminUsers = async (searchOverride?: string) => {
    setIsLoadingAdminUsers(true);
    setAdminError(null);
    setAdminSuccessMessage(null);
    try {
      const res = await workerClient.listAdminUsers(searchOverride);
      if (res.success && res.data) {
        setAdminUsers(Array.isArray(res.data.users) ? res.data.users : []);
        setAdminTotalCount(typeof res.data.total === 'number' ? res.data.total : 0);
      } else {
        setAdminUsers([]);
        setAdminTotalCount(0);
        setAdminError(res.error || 'Unable to load registered users.');
      }
    } catch (e: unknown) {
      const err = e as Error;
      setAdminUsers([]);
      setAdminTotalCount(0);
      setAdminError(err.message || 'Failed to retrieve registered users.');
    } finally {
      setIsLoadingAdminUsers(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !user?.id) {
      setIsVerifiedAdmin(false);
      setAdminUsers([]);
      setAdminTotalCount(0);
      setAdminSearchQuery('');
      setAdminError(null);
      setAdminSuccessMessage(null);
      setPendingDeleteTarget(null);
      setDeleteTargetError(null);
      setActiveTab((prev) => (prev === 'admin' ? 'account' : prev));
      return;
    }

    let cancelled = false;
    workerClient
      .checkAdminStatus()
      .then((res) => {
        if (cancelled) return;
        const verified = Boolean(res.success && res.data?.isAdmin === true);
        setIsVerifiedAdmin(verified);
        if (!verified) {
          setActiveTab((prev) => (prev === 'admin' ? 'account' : prev));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsVerifiedAdmin(false);
          setActiveTab((prev) => (prev === 'admin' ? 'account' : prev));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (isOpen && isVerifiedAdmin && activeTab === 'admin') {
      void fetchAdminUsers();
    }
  }, [isOpen, isVerifiedAdmin, activeTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'plugins') {
      fetchLiveMcpConnections();
    }
  }, [isOpen, activeTab]);

  // Listen for backend MCP OAuth callback completion with fail-closed origin and payload validation [Commented by: Google AI Studio at 23/11/2026 23:06]
  useEffect(() => {
    let expectedWorkerOrigin = '';
    try {
      if (WORKER_BASE_URL) {
        const parsedWorkerUrl = new URL(WORKER_BASE_URL);
        const isLocalHttp =
          parsedWorkerUrl.protocol === 'http:' &&
          (parsedWorkerUrl.hostname === 'localhost' || parsedWorkerUrl.hostname === '127.0.0.1');
        if ((parsedWorkerUrl.protocol === 'https:' || isLocalHttp) && parsedWorkerUrl.origin !== 'null') {
          expectedWorkerOrigin = parsedWorkerUrl.origin;
        }
      }
    } catch {
      expectedWorkerOrigin = '';
    }

    // Never register a message listener when the expected Worker origin cannot be established
    if (!expectedWorkerOrigin) {
      return;
    }

    const handleOAuthCallback = async (event: MessageEvent) => {
      if (!event.origin || event.origin === 'null' || event.origin !== expectedWorkerOrigin) {
        return;
      }

      const payload = event.data as Record<string, unknown> | null;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return;
      }
      if (payload.type !== 'MCP_OAUTH_COMPLETE' || typeof payload.success !== 'boolean') {
        return;
      }
      if (typeof payload.providerId !== 'string') {
        return;
      }

      const providerId = payload.providerId.trim();
      if (providerId !== '' && !MCP_PLUGINS.some((p) => p.id === providerId)) {
        return;
      }
      if (pendingOAuthFlow && providerId !== '' && providerId !== pendingOAuthFlow.plugin.id) {
        return;
      }
      if (
        payload.toolsCount !== undefined &&
        (typeof payload.toolsCount !== 'number' || !Number.isFinite(payload.toolsCount) || payload.toolsCount < 0)
      ) {
        return;
      }
      if (payload.error !== undefined && typeof payload.error !== 'string') {
        return;
      }

      const targetPlugin =
        MCP_PLUGINS.find((p) => p.id === providerId) || pendingOAuthFlow?.plugin || authorizingPlugin;
      const pluginLabel = targetPlugin?.name || (providerId || 'Plugin');

      setPendingOAuthFlow(null);
      setInstallingPluginId(null);

      if (payload.success) {
        const count = typeof payload.toolsCount === 'number' ? payload.toolsCount : 0;
        setStatusMessage(`✓ ${pluginLabel} installed via MCP! ${count} tool${count === 1 ? '' : 's'} ready.`);
        setTimeout(() => setStatusMessage(null), 5000);
        setAuthorizingPlugin(null);
        setAuthAccount('');
        await fetchLiveMcpConnections();
      } else {
        const errorMessage = typeof payload.error === 'string' && payload.error.trim()
          ? payload.error.trim()
          : 'Access was denied or expired.';
        setStatusMessage(`✗ ${pluginLabel} authorization failed: ${errorMessage}`);
        setTimeout(() => setStatusMessage(null), 6000);
      }
    };

    window.addEventListener('message', handleOAuthCallback);
    return () => window.removeEventListener('message', handleOAuthCallback);
  }, [pendingOAuthFlow, authorizingPlugin]);

  useEffect(() => {
    if (!pendingOAuthFlow) return;
    const { plugin, prevUpdatedAt } = pendingOAuthFlow;

    const timer = window.setInterval(async () => {
      try {
        const res = await workerClient.getMcpTools();
        if (res.success && res.data?.connections) {
          const match = res.data.connections.find((c) => c.providerId === plugin.id);
          if (match && match.status === 'connected' && match.updatedAt !== prevUpdatedAt) {
            setPendingOAuthFlow(null);
            setInstallingPluginId(null);
            setAuthorizingPlugin(null);
            const map: Record<string, McpConnection> = {};
            res.data.connections.forEach((c) => {
              map[c.providerId] = c;
            });
            setLiveMcpConnections(map);
            setStatusMessage(
              `✓ ${plugin.name} installed via MCP! ${match.tools.length} tool${match.tools.length === 1 ? '' : 's'} ready.`
            );
            setTimeout(() => setStatusMessage(null), 5000);
          }
        }
      } catch {
        // Ignore transient poll errors while waiting for authorization
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [pendingOAuthFlow]);


  if (!isOpen) return null;

  // Handle Account Save
  // Zero-knowledge encryption for updated API credentials before storing in Supabase; strictly fails closed [Commented by: Google AI Studio on 01/11/2026 04:18 PM]
  const handleSaveAccount = async () => {
    setStatusMessage(null);
    try {
      const secretToUse = password.trim() || currentPasswordSecret;
      const hasPlaintextKeys =
        (openrouterKey.trim() !== '' && !openrouterKey.trim().startsWith('enc:')) ||
        (tavilyKey.trim() !== '' && !tavilyKey.trim().startsWith('enc:')) ||
        (customInstructions.trim() !== '' && !customInstructions.trim().startsWith('enc:'));

      if (hasPlaintextKeys && !secretToUse) {
        setStatusMessage('Error: Password is required to encrypt your credentials before saving.');
        return;
      }

      let encryptedOr = openrouterKey.trim();
      let encryptedTv = tavilyKey.trim();
      let encryptedInst = customInstructions.trim();

      if (secretToUse) {
        try {
          const key = await deriveKeyFromPassword(secretToUse, user.salt || 'default_nanobot_salt');
          if (encryptedOr && !encryptedOr.startsWith('enc:')) {
            encryptedOr = await encryptText(encryptedOr, key, user.salt || 'salt');
          }
          if (encryptedTv && !encryptedTv.startsWith('enc:')) {
            encryptedTv = await encryptText(encryptedTv, key, user.salt || 'salt');
          }
          if (encryptedInst && !encryptedInst.startsWith('enc:')) {
            encryptedInst = await encryptText(encryptedInst, key, user.salt || 'salt');
          }
        } catch (encErr) {
          console.error('Failed to encrypt credentials on save; failing closed:', encErr);
          setStatusMessage('Encryption failed: Credentials could not be encrypted and were not saved.');
          return;
        }
      }

      // Preserve in-memory decrypted credentials while sending only encrypted values to Supabase [Commented by: Google AI Studio at 23/11/2026 22:30]
      const updated: UserProfile = {
        ...user,
        username: username.trim(),
        openrouter_key: openrouterKey.trim(),
        tavily_key: tavilyKey.trim(),
        model_training: modelTraining,
        ai_instructions: customInstructions.trim(),
        plugins_connected: connectedPlugins as UserProfile['plugins_connected'],
        theme: currentTheme
      };

      // Update Supabase Auth password only when explicitly changed during an unlocked session, never touching internal auth_email [Commented by: Google AI Studio at 22/11/2026 14:33]
      if (
        isSupabaseConfigured &&
        supabase &&
        currentPasswordSecret &&
        password.trim() &&
        password.trim() !== currentPasswordSecret
      ) {
        await updateAccountPasswordInSupabase(password.trim());
      }

      // Update Supabase if configured (encrypt secrets so developer cannot see them)
      if (isSupabaseConfigured && supabase) {
        const { error: updateErr } = await supabase
          .from('user_profiles')
          .update({
            username: updated.username,
            openrouter_key: encryptedOr,
            tavily_key: encryptedTv,
            model_training: updated.model_training,
            ai_instructions: encryptedInst,
            plugins_connected: updated.plugins_connected,
            theme: currentTheme,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateErr) {
          console.error('Supabase profile update failed:', updateErr.message);
          setStatusMessage(`Error saving to database: ${updateErr.message}`);
          return;
        }
      }

      clearLegacyLocalProfileCache();
      onUpdateUser(updated, secretToUse);
      setStatusMessage('✓ Account settings saved securely.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      const e = err as Error;
      console.warn('Account update warning:', e);
      setStatusMessage(`Error: ${e.message}`);
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

  // Sign out of Supabase Auth, purge legacy cache, and clear in-memory session state [Commented by: Google AI Studio at 23/11/2026 22:53]
  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setStatusMessage(null);
    try {
      await signOutSupabase();
      clearLegacyLocalProfileCache();
      onLogout();
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setStatusMessage(`Failed to sign out: ${e.message}`);
    } finally {
      setIsSigningOut(false);
    }
  };

  // Handle Delete Account safely with database cleanup [Commented by: Google AI Studio on 01/11/2026 04:18 PM]
  const handleDeleteAccount = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await deleteUserAccountFromSupabase(user.id);
      } else {
        clearLegacyLocalProfileCache();
      }

      onDeleteAccount();
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setStatusMessage(`Failed to delete account: ${e.message}`);
    }
  };

  // Confirm and execute admin-triggered deletion of another user's account via protected Worker endpoint [Commented by: Google AI Studio at 27/11/2026 21:10]
  const handleConfirmDeleteAdminUser = async () => {
    if (!pendingDeleteTarget || isDeletingAdminUser) return;

    if (pendingDeleteTarget.isCurrentAdmin || pendingDeleteTarget.id === user.id) {
      setDeleteTargetError('You cannot delete your own administrator account from User Management.');
      return;
    }

    setIsDeletingAdminUser(true);
    setDeleteTargetError(null);
    setAdminSuccessMessage(null);

    try {
      const res = await workerClient.deleteAdminUser(pendingDeleteTarget.id);
      if (res.success && res.data) {
        const removedId = pendingDeleteTarget.id;
        const removedName = pendingDeleteTarget.username;
        setAdminUsers((prev) => prev.filter((u) => u.id !== removedId));
        setAdminTotalCount((prev) => Math.max(0, prev - 1));
        setPendingDeleteTarget(null);
        setAdminSuccessMessage(
          res.data.message || `Deleted account "${removedName}" and all associated user data.`
        );
      } else {
        setDeleteTargetError(
          res.error || 'Account deletion failed. No confirmation was received from the server.'
        );
      }
    } catch (err: unknown) {
      const e = err as Error;
      setDeleteTargetError(e.message || 'Network error while deleting user account.');
    } finally {
      setIsDeletingAdminUser(false);
    }
  };

  // Keep custom instructions in memory and encrypt before persisting to Supabase, never writing to localStorage [Commented by: Google AI Studio at 23/11/2026 22:30]
  const handleInstructionsKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const secretToUse = password.trim() || currentPasswordSecret;
      if (customInstructions.trim() !== '' && !customInstructions.trim().startsWith('enc:') && !secretToUse) {
        setStatusMessage('Error: Password is required to encrypt your custom instructions before saving.');
        return;
      }

      if (isSupabaseConfigured && supabase) {
        try {
          const ok = await updateUserProfileInSupabase(
            user.id,
            { ai_instructions: customInstructions },
            secretToUse,
            user.salt || 'default_nanobot_salt'
          );
          if (!ok) {
            setStatusMessage('Error saving custom instructions to database.');
            return;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to encrypt custom instructions.';
          setStatusMessage(`Error: ${msg}`);
          return;
        }
      }

      const updated: UserProfile = {
        ...user,
        ai_instructions: customInstructions
      };
      onUpdateUser(updated);

      setInstructionsSavedNotice(true);
      setTimeout(() => setInstructionsSavedNotice(false), 2500);
    }
  };

  // Handle Model Training toggle without localStorage profile caching [Commented by: Google AI Studio at 23/11/2026 22:30]
  const handleToggleTraining = async () => {
    const nextVal = !modelTraining;
    setModelTraining(nextVal);
    const updated: UserProfile = {
      ...user,
      model_training: nextVal
    };
    onUpdateUser(updated);

    if (isSupabaseConfigured && supabase) {
      supabase.from('user_profiles').update({ model_training: nextVal }).eq('id', user.id);
    }
  };

  const persistPlugins = (nextPlugins: Record<string, boolean>) => {
    const updated: UserProfile = {
      ...user,
      plugins_connected: nextPlugins as UserProfile['plugins_connected']
    };
    onUpdateUser(updated);

    if (isSupabaseConfigured && supabase) {
      supabase.from('user_profiles').update({ plugins_connected: nextPlugins }).eq('id', user.id);
    }
  };

  // Start ChatGPT-style backend-managed MCP OAuth 2.1 + PKCE installation flow in a new tab [Commented by: Google AI Studio at 22/11/2026 11:51]
  const handleInstallPlugin = async (plugin: PluginDefinition) => {
    setInstallingPluginId(plugin.id);
    setAuthError(null);
    setStatusMessage(null);

    try {
      const res = await workerClient.startMcpOAuth(plugin.id, window.location.origin);
      if (res.success && res.data?.authorizationUrl) {
        const prevUpdatedAt = liveMcpConnections[plugin.id]?.updatedAt || '';
        setAuthorizingPlugin(null);
        setPendingOAuthFlow({
          plugin,
          authorizationUrl: res.data.authorizationUrl,
          prevUpdatedAt,
        });
        window.open(res.data.authorizationUrl, '_blank');
        return;
      }

      // If remote provider does not expose DCR/CIMD and no static OAuth client is configured, offer guided token fallback
      setInstallingPluginId(null);
      setAuthorizingPlugin(plugin);
      setAuthAccount('');
      setShowAuthToken(false);
      setAuthError(res.data?.error || res.error || null);
    } catch (err: unknown) {
      const e = err as Error;
      setInstallingPluginId(null);
      setAuthorizingPlugin(plugin);
      setAuthAccount('');
      setShowAuthToken(false);
      setAuthError(`Failed to start MCP OAuth flow: ${e.message}`);
    }
  };

  // Safe clipboard paste handler for credentials [Commented by: Google AI Studio on 31/10/2026 10:53 PM]
  const handlePasteCredential = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setAuthAccount(text.trim());
        setAuthError(null);
      }
    } catch {
      // Browser clipboard permission rejected or ungranted
    }
  };

  // Live MCP server handshake, validation, and encrypted backend persistence [Commented by: Google AI Studio on 31/10/2026 10:53 PM]
  // Live MCP server handshake, validation, and encrypted backend persistence [Commented by: Google AI Studio on 31/10/2026 11:05 PM]
  const handleGrantAuthorization = async () => {
    if (!authorizingPlugin) return;
    if (!authAccount.trim()) {
      setAuthError(`Please enter your ${authorizingPlugin.credentialLabel} to connect.`);
      return;
    }
    setIsAuthorizing(true);
    setAuthError(null);

    try {
      // Strictly use verified provider endpoint from trusted application configuration
      const endpoint = authorizingPlugin.mcpEndpoint || '';

      const res = await workerClient.connectMcpProvider(
        authorizingPlugin.id,
        { token: authAccount.trim() },
        authorizingPlugin.authType,
        endpoint
      );

      if (!res.success) {
        setAuthError(res.error || 'Connection verification failed. Please verify your credentials.');
        setIsAuthorizing(false);
        return;
      }

      const discoveredCount = res.data?.tools?.length || 0;
      setStatusMessage(`✓ ${authorizingPlugin.name} connected successfully! Discovered ${discoveredCount} live tool${discoveredCount !== 1 ? 's' : ''}.`);
      setTimeout(() => setStatusMessage(null), 5000);
      setAuthorizingPlugin(null);
      setAuthAccount('');
      setShowAuthToken(false);
      await fetchLiveMcpConnections();
    } catch (err: unknown) {
      const e = err as Error;
      setAuthError(`Connection error: ${e.message}`);
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Run live backend verification test for a connected provider [Commented by: Google AI Studio on 31/10/2026 11:05 PM]
  const handleTestPlugin = async (pluginId: string, pluginName: string) => {
    setTestingPluginId(pluginId);
    try {
      const res = await workerClient.testMcpConnection(pluginId);
      if (res.success && res.data) {
        setTestResults((prev) => ({
          ...prev,
          [pluginId]: {
            status: res.data!.status,
            toolsCount: res.data!.toolsCount,
            error: res.data!.error || null,
          },
        }));
        if (res.data.status === 'Connection successful') {
          setStatusMessage(`✓ ${pluginName} connection verified successfully! (${res.data.toolsCount || 0} live tools ready)`);
        } else {
          setStatusMessage(`⚠ ${pluginName}: ${res.data.status}${res.data.error ? ` - ${res.data.error}` : ''}`);
        }
        setTimeout(() => setStatusMessage(null), 5000);
        await fetchLiveMcpConnections();
      } else {
        const status = res.isAuthError ? 'Authentication failed' : (res.data?.status || 'Provider unavailable');
        setTestResults((prev) => ({
          ...prev,
          [pluginId]: {
            status,
            error: res.error || 'Connection test failed',
          },
        }));
        setStatusMessage(`✗ ${pluginName}: ${res.error || 'Connection test failed'}`);
        setTimeout(() => setStatusMessage(null), 5000);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setTestResults((prev) => ({
        ...prev,
        [pluginId]: {
          status: 'Provider unavailable',
          error: e.message,
        },
      }));
      setStatusMessage(`Error: ${e.message}`);
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      setTestingPluginId(null);
    }
  };

  // Disconnect provider and revoke credentials on the backend
  const handleDisconnectPlugin = async (pluginId: string, pluginName: string) => {
    setDisconnectingPluginId(pluginId);
    try {
      const res = await workerClient.disconnectMcpProvider(pluginId);
      if (res.success) {
        setStatusMessage(`Disconnected ${pluginName} successfully.`);
        setTimeout(() => setStatusMessage(null), 3000);
        await fetchLiveMcpConnections();
      } else {
        setStatusMessage(`Failed to disconnect: ${res.error}`);
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setDisconnectingPluginId(null);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* Themed container supporting both Neon Black and Minimalist Light themes  [Commented by: Google AI Studio on 20/10/2026 11:29 PM] */}
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

          {/* Configured Add-ons navigation tab in SettingsModal [Commented by: Google AI Studio on 28/10/2026 04:26 PM] */}
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

          {/* Render User Management tab exclusively when server verification confirms admin privileges [Commented by: Google AI Studio at 27/11/2026 21:10] */}
          {isVerifiedAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'admin'
                  ? isLight
                    ? 'bg-white text-neutral-900 font-semibold shadow-xs border border-neutral-200'
                    : 'bg-[#1a1a1a] text-white font-semibold'
                  : isLight
                  ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                  : 'text-neutral-400 hover:text-white hover:bg-[#121212]'
              }`}
            >
              User Management
            </button>
          )}

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
              {/* Removed Supabase/Netlify status indicator pill per user instruction [Commented by: Google AI Studio on 23/10/2026 07:38 PM] */}
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
                {/* Masked by default with eye visibility toggle and copy support [Commented by: Google AI Studio on 30/10/2026 10:50 PM] */}
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

              {((openrouterKey && openrouterKey.startsWith('enc:')) || (tavilyKey && tavilyKey.startsWith('enc:'))) && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                  <span className="text-base leading-none">🔒</span>
                  <div>
                    <p className="font-semibold">Session Restored: Credentials Encrypted</p>
                    <p className="text-amber-200/80 mt-0.5">
                      Your API keys are zero-knowledge encrypted. Enter your account password above to unlock or update credentials for this session.
                    </p>
                  </div>
                </div>
              )}

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

              {/* Theme toggle in Account Settings for switching between Neon Black and Minimalist Light  [Commented by: Google AI Studio on 20/10/2026 11:29 PM] */}
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

              {/* Render account status and sign-out error feedback on the Account tab [Commented by: Google AI Studio at 25/11/2026 22:57] */}
              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium border ${
                    statusMessage.startsWith('Error') || statusMessage.startsWith('Failed')
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {statusMessage}
                </div>
              )}

              {/* Sign Out & Delete Account [Commented by: Google AI Studio at 23/11/2026 22:53] */}
              <div className="pt-4 space-y-3">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isSigningOut}
                  className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer border disabled:opacity-50 ${
                    isLight
                      ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-900'
                      : 'bg-[#1a1a1a] hover:bg-[#242424] border-[#333] text-white'
                  }`}
                >
                  {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                </button>

                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="w-full bg-red-800 hover:bg-red-900 text-white py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Delete Account
                </button>
                {/* Clarify server-side deletion vs browser-local data scope [Commented by: Google AI Studio at 27/11/2026 21:27] */}
                <p className={`text-[11px] leading-relaxed ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                  Deleting your account permanently removes your server-side identity and account data across Supabase and Cloudflare D1, and clears cached data in this browser. Any browser-local IndexedDB file uploads or local archives stored on other browsers or devices cannot be remotely erased and must be cleared locally in those browsers.
                </p>
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

          {/* TAB 3: ADD-ONS & INTEGRATIONS */}
          {/* Consumer-grade Model Context Protocol (MCP) authorization interface [Commented by: Google AI Studio on 31/10/2026 10:54 PM] */}
          {activeTab === 'plugins' && (() => {
            const connectedCount = MCP_PLUGINS.filter((p) => liveMcpConnections[p.id]?.status === 'connected').length;
            const availableCount = MCP_PLUGINS.length - connectedCount;
            const displayedPlugins = MCP_PLUGINS.filter((plugin) => {
              const isConn = liveMcpConnections[plugin.id]?.status === 'connected';
              if (filterTab === 'connected') return isConn;
              if (filterTab === 'available') return !isConn;
              return true;
            });

            return (
              <div className="space-y-4 max-w-xl">
                {/* Header & Subtitle */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold font-serif mb-1">Add-ons & Integrations</h2>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Connect your accounts to give nanobot live capabilities. nanobot accesses only the permissions you authorize, and all credentials are encrypted on the server.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchLiveMcpConnections}
                    disabled={isLoadingMcp}
                    title="Refresh connection statuses"
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#141414] hover:bg-[#1f1f1f] border border-[#2b2b2b] text-neutral-300 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className={isLoadingMcp ? 'animate-spin' : ''}>↻</span>
                    <span>{isLoadingMcp ? 'Checking...' : 'Refresh'}</span>
                  </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 pt-1 border-b border-[#222] pb-2">
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      filterTab === 'all'
                        ? 'bg-neutral-800 text-white font-semibold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    All ({MCP_PLUGINS.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('connected')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                      filterTab === 'connected'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-semibold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Connected ({connectedCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('available')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      filterTab === 'available'
                        ? 'bg-neutral-800 text-white font-semibold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Available ({availableCount})
                  </button>
                </div>

                {statusMessage && (
                  <div className="bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs px-3 py-2 rounded-lg font-mono">
                    {statusMessage}
                  </div>
                )}

                {/* Pending backend OAuth authorization banner with direct new-tab fallback link [Commented by: Google AI Studio at 22/11/2026 11:51] */}
                {pendingOAuthFlow && (
                  <div className="bg-[#0e1711] border border-emerald-500/50 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0"></span>
                        <div>
                          <div className="text-xs font-semibold text-white">
                            Waiting for {pendingOAuthFlow.plugin.name} authorization...
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">
                            Complete authorization in the new tab. Token exchange and storage run securely on the backend.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingOAuthFlow(null);
                          setInstallingPluginId(null);
                        }}
                        className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded bg-[#181818] border border-[#2c2c2c] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={pendingOAuthFlow.authorizationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                      >
                        <span>Open Authorization Window</span>
                        <span>↗</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Plugin Cards List */}
                <div className="space-y-3 pt-1">
                  {displayedPlugins.map((plugin) => {
                    const liveConn = liveMcpConnections[plugin.id];
                    const isConnected = liveConn && liveConn.status === 'connected';
                    const isError = liveConn && liveConn.status === 'error';
                    const activeTools = isConnected ? liveConn.tools : plugin.tools;
                    const isExpanded = expandedToolsPluginId === plugin.id;
                    const isDisconnecting = disconnectingPluginId === plugin.id;

                    return (
                      <div
                        key={plugin.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isConnected
                            ? 'bg-[#0e1711] border-emerald-500/40 shadow-xs'
                            : isError
                            ? 'bg-[#180e11] border-rose-500/40'
                            : 'bg-[#131313] border-[#242424] hover:border-[#333]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <img
                              src={plugin.iconUrl}
                              alt={plugin.name}
                              className="w-8 h-8 object-contain rounded-lg mt-0.5 shrink-0 bg-black/40 p-0.5 border border-[#2b2b2b]"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div>
                              <div className="text-sm font-semibold text-white flex items-center gap-2">
                                {plugin.name}
                                {isConnected ? (
                                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/50 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Connected
                                  </span>
                                ) : isError ? (
                                  <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-500/50 px-2 py-0.5 rounded-full font-medium">
                                    Reauthorization Required
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-neutral-900 text-neutral-400 border border-neutral-800 px-2 py-0.5 rounded-full font-medium">
                                    Not connected
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-neutral-400 mt-1 leading-snug">
                                {plugin.description}
                              </div>
                              <div className="text-[11px] text-neutral-500 mt-1.5 flex items-center gap-2">
                                {isConnected ? (
                                  <span className="text-emerald-400/90 font-medium">
                                    ✓ {activeTools.length} live capabilities active
                                  </span>
                                ) : (
                                  <span>
                                    {plugin.tools.length} available capabilities
                                  </span>
                                )}
                              </div>
                              {isError && liveConn.errorMessage && (
                                <div className="text-[11px] text-rose-400 mt-1 font-mono">
                                  {liveConn.errorMessage}
                                </div>
                              )}
                              {/* Truthful Connection Test Outcome Badge [Commented by: Google AI Studio on 31/10/2026 11:05 PM] */}
                              {testResults[plugin.id] && (
                                <div
                                  className={`text-[11px] mt-2 px-2.5 py-1.5 rounded-lg font-medium flex items-center justify-between gap-2 border transition-all ${
                                    testResults[plugin.id].status === 'Connection successful'
                                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                                      : testResults[plugin.id].status === 'Authentication failed' || testResults[plugin.id].status === 'Provider unavailable'
                                      ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                                      : 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold">
                                      {testResults[plugin.id].status === 'Connection successful' ? '✓' : testResults[plugin.id].status === 'Configuration required' ? 'ℹ' : '✗'}
                                    </span>
                                    <span>{testResults[plugin.id].status}</span>
                                    {testResults[plugin.id].status === 'Connection successful' && testResults[plugin.id].toolsCount !== undefined && (
                                      <span className="text-[10px] opacity-80">({testResults[plugin.id].toolsCount} tools live)</span>
                                    )}
                                  </div>
                                  {testResults[plugin.id].error && (
                                    <span className="text-[10px] opacity-80 truncate max-w-[180px] font-mono" title={testResults[plugin.id].error || ''}>
                                      {testResults[plugin.id].error}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isConnected ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleTestPlugin(plugin.id, plugin.name)}
                                  disabled={testingPluginId === plugin.id}
                                  className="px-2.5 py-1.5 rounded-lg font-medium text-xs bg-[#161616] hover:bg-[#202020] text-neutral-300 hover:text-white border border-[#2e2e2e] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                  title="Test live backend connection and capabilities"
                                >
                                  {testingPluginId === plugin.id ? (
                                    <>
                                      <span className="w-2.5 h-2.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
                                      <span>Testing...</span>
                                    </>
                                  ) : (
                                    <span>Test Connection</span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDisconnectPlugin(plugin.id, plugin.name)}
                                  disabled={isDisconnecting}
                                  className="px-3 py-1.5 rounded-lg font-medium text-xs bg-neutral-900 hover:bg-rose-950 text-neutral-300 hover:text-rose-200 border border-neutral-800 hover:border-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleInstallPlugin(plugin)}
                                disabled={installingPluginId === plugin.id}
                                className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-60 ${
                                  isError
                                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                    : plugin.oauthProvider === 'google'
                                    ? 'bg-white hover:bg-neutral-100 text-neutral-900 font-bold'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                }`}
                              >
                                {installingPluginId === plugin.id ? (
                                  <>
                                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                    <span>Authorizing...</span>
                                  </>
                                ) : isError ? (
                                  'Reinstall Plugin'
                                ) : plugin.oauthProvider === 'google' ? (
                                  <>
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                    </svg>
                                    <span>Install Plugin</span>
                                  </>
                                ) : (
                                  'Install Plugin'
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Tool Capabilities */}
                        <div className="mt-2.5 pt-2 border-t border-[#1e1e1e] flex items-center justify-between text-[11px]">
                          <button
                            type="button"
                            onClick={() => setExpandedToolsPluginId(isExpanded ? null : plugin.id)}
                            className="text-neutral-400 hover:text-emerald-400 cursor-pointer flex items-center gap-1 transition-colors"
                          >
                            <span>{isExpanded ? '▼ Hide' : '▶ View'} {activeTools.length} {isConnected ? 'active' : 'available'} capabilities</span>
                          </button>
                          <span className="text-neutral-500 text-[10.5px]">
                            {plugin.oauthSupported ? 'MCP OAuth 2.1 + PKCE' : plugin.authType === 'oauth' ? 'OAuth 2.0' : 'Secure API Token'}
                          </span>
                        </div>

                        {isExpanded && (
                          <div className="mt-2 bg-[#0c0c0c] border border-[#222] rounded-lg p-2.5 space-y-1.5 text-xs">
                            <div className="text-neutral-400 font-medium text-[11px] mb-1 flex items-center justify-between">
                              <span>
                                {isConnected
                                  ? 'Active capabilities in this conversation:'
                                  : 'Capabilities available once connected:'}
                              </span>
                              {isConnected && (
                                <span className="text-emerald-400 font-mono text-[10px]">Verified</span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 gap-1 max-h-44 overflow-y-auto pr-1">
                              {activeTools.map((tool) => (
                                <div key={tool.name} className="flex flex-col gap-0.5 text-[11px] text-neutral-300 bg-[#141414] p-1.5 rounded border border-[#202020]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-emerald-400 font-mono font-medium">⚡ {tool.name}</span>
                                  </div>
                                  <div className="text-neutral-400 text-[10.5px]">{tool.description}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>


                {/* Consumer-Grade Authorization Modal Dialog */}
                {authorizingPlugin && (
                  <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
                    <div className="w-full max-w-md bg-[#111] border border-[#2d2d2d] rounded-2xl p-6 text-white shadow-2xl space-y-5">
                      {/* Modal Header */}
                      <div className="flex items-center gap-3 pb-3 border-b border-[#222]">
                        <img
                          src={authorizingPlugin.iconUrl}
                          alt={authorizingPlugin.name}
                          className="w-9 h-9 object-contain rounded-lg p-0.5 bg-black/50 border border-[#2d2d2d]"
                        />
                        <div>
                          <h3 className="font-bold text-base text-white">
                            Connect {authorizingPlugin.name}
                          </h3>
                          <p className="text-xs text-neutral-400">
                            Authorize nanobot to access your account
                          </p>
                        </div>
                      </div>

                      {/* Plain-Language Capabilities & Permissions Summary */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                          What nanobot will be able to do:
                        </div>
                        <div className="bg-[#161616] border border-[#262626] rounded-xl p-3.5 space-y-2 text-xs text-neutral-300 max-h-36 overflow-y-auto">
                          {authorizingPlugin.permissions.map((perm, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="text-emerald-400 font-bold shrink-0">✓</span>
                              <span className="leading-tight">{perm}</span>
                            </div>
                          ))}
                          <div className="pt-1.5 border-t border-[#222] text-[11px] text-neutral-400 flex items-center gap-1.5">
                            <span className="text-blue-400">🔒</span>
                            <span>Tokens are encrypted with AES-GCM and never shared or exposed.</span>
                          </div>
                        </div>
                      </div>

                      {/* Backend MCP OAuth Retry Button inside fallback modal [Commented by: Google AI Studio at 22/11/2026 11:51] */}
                      {authorizingPlugin.oauthSupported && (
                        <div className="space-y-2.5">
                          <button
                            type="button"
                            onClick={() => handleInstallPlugin(authorizingPlugin)}
                            disabled={isAuthorizing || installingPluginId === authorizingPlugin.id}
                            className="w-full py-2.5 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm bg-[#1a1a1a] hover:bg-[#242424] text-white border border-[#3a3a3a]"
                          >
                            <span>Authorize in New Tab (MCP OAuth)</span>
                          </button>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 justify-center">
                            <span>or connect directly with authorization token</span>
                          </div>
                        </div>
                      )}

                      {/* Plain-Language Credential Guidance & Input */}
                      <div className="space-y-2">
                        {authorizingPlugin.whyTokenText && (
                          <div className="bg-[#141414] border border-[#222] p-2.5 rounded-lg text-xs text-neutral-400 leading-relaxed">
                            {authorizingPlugin.whyTokenText}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <label className="block text-xs font-semibold text-neutral-300">
                            {authorizingPlugin.credentialLabel}:
                          </label>
                          {authorizingPlugin.helpUrl && (
                            <a
                              href={authorizingPlugin.helpUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                            >
                              <span>{authorizingPlugin.helpActionText || 'Open Token Dashboard'}</span>
                              <span>↗</span>
                            </a>
                          )}
                        </div>

                        <div className="relative">
                          <input
                            type={showAuthToken ? 'text' : 'password'}
                            value={authAccount}
                            onChange={(e) => {
                              setAuthAccount(e.target.value);
                              if (authError) setAuthError(null);
                            }}
                            onKeyDown={handleCredentialKeyDown}
                            placeholder={authorizingPlugin.credentialPlaceholder}
                            className="w-full bg-[#181818] border border-[#333] rounded-lg pl-3 pr-20 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono"
                          />
                          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={handlePasteCredential}
                              title="Paste from clipboard"
                              className="px-2 py-0.5 text-[10px] font-medium rounded bg-[#252525] hover:bg-[#333] text-neutral-300 transition-colors cursor-pointer"
                            >
                              Paste
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAuthToken(!showAuthToken)}
                              title={showAuthToken ? 'Hide token' : 'Show token'}
                              className="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                            >
                              {showAuthToken ? (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>

                        {authError && (
                          <div className="bg-rose-950/70 border border-rose-500/60 text-rose-300 text-xs p-2.5 rounded-lg leading-relaxed">
                            {authError}
                          </div>
                        )}
                      </div>

                      {/* Modal Actions */}
                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#222]">
                        <button
                          type="button"
                          onClick={() => {
                            setAuthorizingPlugin(null);
                            setAuthError(null);
                            setShowAuthToken(false);
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
                              <span>Connecting & Verifying...</span>
                            </>
                          ) : (
                            <span>Connect & Verify</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}


          {/* TAB 4: ADMIN USER MANAGEMENT (Server-Verified Exclusively) [Commented by: Google AI Studio at 27/11/2026 21:10] */}
          {activeTab === 'admin' && isVerifiedAdmin && (() => {
            const normalizedSearch = adminSearchQuery.trim().toLowerCase();
            const filteredAdminUsers = normalizedSearch
              ? adminUsers.filter((u) => u.username.toLowerCase().includes(normalizedSearch))
              : adminUsers;

            const formatUserCreatedAt = (iso: string | null) => {
              if (!iso) return 'Unavailable';
              const parsed = Date.parse(iso);
              if (Number.isNaN(parsed)) return 'Unavailable';
              return new Date(parsed).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
            };

            const getStatusBadgeClasses = (status: AdminUserRecord['status']) => {
              switch (status) {
                case 'active':
                  return isLight
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                case 'disabled':
                case 'deleted':
                  return isLight
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-red-500/10 text-red-400 border-red-500/30';
                case 'pending':
                  return isLight
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                default:
                  return isLight
                    ? 'bg-neutral-100 text-neutral-600 border-neutral-300'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700';
              }
            };

            return (
              <div className="space-y-4 max-w-2xl">
                <div className={`pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  isLight ? 'border-neutral-200' : 'border-neutral-800'
                }`}>
                  <div>
                    <h2 className="text-xl font-bold font-serif">User Management</h2>
                    <p className={`text-xs mt-0.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      Administrator directory showing only usernames, creation dates, and account status.
                    </p>
                  </div>
                  <div className={`text-xs font-medium px-2.5 py-1 rounded-lg border self-start sm:self-auto ${
                    isLight ? 'bg-neutral-50 border-neutral-200 text-neutral-600' : 'bg-[#141414] border-[#2b2b2b] text-neutral-300'
                  }`}>
                    {adminTotalCount} {adminTotalCount === 1 ? 'account' : 'accounts'}
                  </div>
                </div>

                {/* Search & Refresh Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={adminSearchQuery}
                      onChange={(e) => setAdminSearchQuery(e.target.value)}
                      placeholder="Search by username..."
                      aria-label="Search users by username"
                      className={`w-full rounded-xl px-3.5 py-2 pr-8 text-sm focus:outline-none border transition-colors ${
                        isLight
                          ? 'bg-neutral-50 border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-emerald-600'
                          : 'bg-[#141414] border-[#2d2d2d] text-white placeholder-neutral-500 focus:border-[#39ff14]'
                      }`}
                    />
                    {adminSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAdminSearchQuery('')}
                        aria-label="Clear username search"
                        className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs cursor-pointer ${
                          isLight ? 'text-neutral-400 hover:text-neutral-700' : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void fetchAdminUsers()}
                    disabled={isLoadingAdminUsers}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
                      isLight
                        ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800'
                        : 'bg-[#161616] hover:bg-[#222] border-[#2d2d2d] text-neutral-200'
                    }`}
                  >
                    {isLoadingAdminUsers ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>

                {adminError && (
                  <div className="p-3 rounded-xl text-xs font-medium border bg-red-500/10 border-red-500/30 text-red-400">
                    {adminError}
                  </div>
                )}

                {adminSuccessMessage && (
                  <div className="p-3 rounded-xl text-xs font-medium border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                    {adminSuccessMessage}
                  </div>
                )}

                {isLoadingAdminUsers ? (
                  <div className={`p-8 rounded-xl border text-center text-xs ${
                    isLight ? 'bg-neutral-50 border-neutral-200 text-neutral-500' : 'bg-[#111] border-[#242424] text-neutral-400'
                  }`}>
                    Loading registered users...
                  </div>
                ) : !adminError && filteredAdminUsers.length === 0 ? (
                  <div className={`p-8 rounded-xl border text-center space-y-2 ${
                    isLight ? 'bg-neutral-50 border-neutral-200 text-neutral-600' : 'bg-[#111] border-[#242424] text-neutral-400'
                  }`}>
                    <p className="text-sm font-medium">
                      {adminUsers.length === 0
                        ? 'No registered user accounts found.'
                        : `No users match "${adminSearchQuery.trim()}".`}
                    </p>
                    {adminUsers.length > 0 && adminSearchQuery.trim() !== '' && (
                      <button
                        type="button"
                        onClick={() => setAdminSearchQuery('')}
                        className="text-xs font-semibold text-emerald-500 hover:text-emerald-400 underline cursor-pointer"
                      >
                        Clear search filter
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAdminUsers.map((entry) => {
                      const isSelf = Boolean(entry.isCurrentAdmin || entry.id === user.id);
                      return (
                        <div
                          key={entry.id}
                          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isLight
                              ? 'bg-neutral-50 border-neutral-200'
                              : 'bg-[#121212] border-[#262626]'
                          }`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold truncate">{entry.username}</span>
                              <span
                                className={`text-[11px] font-medium px-2 py-0.5 rounded-md border capitalize ${getStatusBadgeClasses(
                                  entry.status
                                )}`}
                              >
                                {entry.status}
                              </span>
                              {isSelf && (
                                <span
                                  className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                                    isLight
                                      ? 'bg-neutral-200 text-neutral-700 border-neutral-300'
                                      : 'bg-[#1f1f1f] text-neutral-300 border-[#383838]'
                                  }`}
                                >
                                  Current Admin
                                </span>
                              )}
                            </div>
                            <div className={`text-xs ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                              Created {formatUserCreatedAt(entry.created_at)}
                            </div>
                          </div>

                          <div className="shrink-0">
                            <button
                              type="button"
                              disabled={isSelf}
                              title={
                                isSelf
                                  ? 'Administrators cannot delete their own account through User Management'
                                  : `Delete user ${entry.username}`
                              }
                              onClick={() => {
                                if (isSelf) return;
                                setDeleteTargetError(null);
                                setPendingDeleteTarget(entry);
                              }}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                isSelf
                                  ? isLight
                                    ? 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed'
                                    : 'bg-[#181818] border-[#2a2a2a] text-neutral-600 cursor-not-allowed'
                                  : 'bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border-red-500/30 cursor-pointer'
                              }`}
                            >
                              {isSelf ? 'Self-Deletion Blocked' : 'Delete User'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Explicit Confirmation Dialog for Admin User Account Deletion */}
                {pendingDeleteTarget && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="admin-delete-user-title"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                  >
                    <div
                      className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border space-y-4 ${
                        isLight
                          ? 'bg-white border-neutral-300 text-neutral-900'
                          : 'bg-[#121212] border-[#2b2b2b] text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-inherit">
                        <h3 id="admin-delete-user-title" className="text-base font-bold font-serif text-red-500">
                          Delete User Account?
                        </h3>
                        <button
                          type="button"
                          disabled={isDeletingAdminUser}
                          onClick={() => {
                            setPendingDeleteTarget(null);
                            setDeleteTargetError(null);
                          }}
                          aria-label="Close user deletion confirmation"
                          className="text-neutral-400 hover:text-neutral-200 cursor-pointer text-sm disabled:opacity-50"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Explicit server-side vs browser-local data-retention disclosure in admin confirmation [Commented by: Google AI Studio at 27/11/2026 21:27] */}
                      <p className={`text-xs leading-relaxed ${isLight ? 'text-neutral-600' : 'text-neutral-300'}`}>
                        You are about to permanently delete the account for{' '}
                        <span className={`font-bold ${isLight ? 'text-neutral-900' : 'text-white'}`}>
                          {pendingDeleteTarget.username}
                        </span>
                        . This removes the Supabase Auth identity and purges server-side account data across Supabase and Cloudflare D1 (profile, conversations, messages, file outputs, add-on connections, OAuth states, and shared links). This action cannot be undone.
                      </p>

                      <p className={`text-[11px] leading-relaxed p-2.5 rounded-lg border ${
                        isLight
                          ? 'bg-neutral-50 border-neutral-200 text-neutral-600'
                          : 'bg-[#171717] border-[#2a2a2a] text-neutral-400'
                      }`}>
                        Note: Browser-local IndexedDB file uploads and local archives stored on the user&apos;s own browser or devices cannot be remotely erased by an administrator; the user must clear browser-local data themselves where applicable.
                      </p>

                      {deleteTargetError && (
                        <div className="p-3 rounded-xl text-xs font-medium border bg-red-500/10 border-red-500/30 text-red-400">
                          {deleteTargetError}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          disabled={isDeletingAdminUser}
                          onClick={() => {
                            setPendingDeleteTarget(null);
                            setDeleteTargetError(null);
                          }}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer disabled:opacity-50 ${
                            isLight
                              ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-700'
                              : 'bg-[#1a1a1a] hover:bg-[#242424] border-[#2d2d2d] text-neutral-300'
                          }`}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isDeletingAdminUser}
                          onClick={handleConfirmDeleteAdminUser}
                          className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white cursor-pointer transition-colors disabled:opacity-50"
                        >
                          {isDeletingAdminUser ? 'Deleting Account...' : 'Confirm Permanent Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}


          {/* TAB 5: ABOUT NANOBOT */}
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
                {/* Updated description to state 'source available AI chatbot' [Commented by: Google AI Studio on 29/10/2026 09:00 PM] */}
                <p className="text-sm leading-relaxed">
                  Everyone should get to use AI, and that too without giving away their data. So I created nanobot, a source available AI chatbot which respects your privacy, and is free to use. Users bring their own API keys, which helps in further keeping nanobot completely free to use.
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
                {/* Updated developer contact section to include GitHub discussions link and preserved email box per user specification  [Commented by: Google AI Studio on 22/10/2026 04:47 PM] */}
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
                    Special thanks to {sortedServices.join(', ')}. The features provided by these services have helped me code, develop, host, build the backend for, and maintain nanobot.
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    All terms and conditions are under these services.
                  </p>
                  {/* Added centered 'Made in INDIA 🇮🇳 ❤️' statement under terms and conditions  [Commented by: Google AI Studio on 22/10/2026 05:36 PM] */}
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
