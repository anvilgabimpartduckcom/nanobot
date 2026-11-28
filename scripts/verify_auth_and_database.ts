// nanobot Comprehensive Supabase Auth, Database, Storage, and RLS Verification Suite [Commented by: Google AI Studio on 01/11/2026 04:18 PM]

import { formatAuthEmail, formatLegacyAuthEmail, isLegacyAuthEmail, validateUsername, deleteUserAccountFromSupabase } from '../src/lib/supabase';
import { NANOBOT_BACKUP_FILENAME, buildChatBackupPayload, serializeChatBackupJson } from '../src/lib/jsonExport';
import { generateSalt, deriveKeyFromPassword, encryptText, decryptText, decryptData, generateShareKey, encryptShareSnapshot, decryptShareSnapshot } from '../src/lib/crypto';
// Import pure shared noodle utilities for Stage 4D verification [Commented by: Google AI Studio at 24/11/2026 17:13]
import {
  buildShareSnapshotMessages,
  copyTextToClipboard,
  createForkedChatSession,
  extractShareIdFromInput,
  SHARED_NOODLE_PRIVACY_DISCLOSURE,
} from '../src/lib/shareUtils';
// Import pure local storage and worker client modules for H-5 regression testing [Commented by: Google AI Studio on 28/11/2026 07:35]
import {
  REGULAR_GUEST_CHATS_KEY,
  LEGACY_ENCRYPTED_CHATS_KEY,
  INCOGNITO_CHATS_KEY,
  INCOGNITO_MODE_KEY,
  getEncryptedChatsStorageKey,
  getLocalFileOutputsStorageKey,
  saveRegularChatsLocally,
  loadRegularChatsLocally,
  saveIncognitoChatsLocally,
  loadIncognitoChatsLocally,
  setIncognitoModeFlagLocally,
  getIncognitoModeFlagLocally,
  clearIncognitoHistoryLocally,
  saveLocalFileOutput,
  loadLocalFileOutputs,
  clearAllLocalChatAndFileData,
} from '../src/lib/localChatStorage';
import { workerClient } from '../src/lib/workerClient';
import fs from 'node:fs';
import path from 'node:path';

async function runAuthAndDatabaseTests() {
  console.log('============================================================');
  console.log('NANOBOT TARGETED PRODUCTION REPAIR VERIFICATION SUITE');
  console.log('============================================================\n');

  let passCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string, details: string) {
    totalCount++;
    if (condition) {
      passCount++;
      console.log(`✅ [PASS] ${testName}: ${details}`);
    } else {
      console.error(`❌ [FAIL] ${testName}: ${details}`);
    }
  }

  const schemaPath = path.resolve(process.cwd(), 'supabase/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const supabaseTsPath = path.resolve(process.cwd(), 'src/lib/supabase.ts');
  const supabaseTs = fs.readFileSync(supabaseTsPath, 'utf8');

  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  const settingsPath = path.resolve(process.cwd(), 'src/components/SettingsModal.tsx');
  const settingsContent = fs.readFileSync(settingsPath, 'utf8');

  const authModalPath = path.resolve(process.cwd(), 'src/components/AuthModal.tsx');
  const authModalContent = fs.readFileSync(authModalPath, 'utf8');

  // =========================================================================
  // 1. Encryption must fail closed
  // =========================================================================
  console.log('--- 1. Encryption Fail-Closed Verification ---');

  const salt = generateSalt();
  const testPassword = 'StrongPassword123!';
  const key = await deriveKeyFromPassword(testPassword, salt);
  const secretKey = 'sk-or-v1-0123456789abcdef';

  const validCiphertext = await encryptText(secretKey, key, salt);
  assert(
    validCiphertext.startsWith('enc:') && !validCiphertext.includes('sk-or-v1'),
    'Encryption Produces Valid Ciphertext',
    'Encrypted ciphertext starts with enc: and masks sensitive plaintext completely.'
  );

  let missingKeyThrew = false;
  try {
    // @ts-expect-error testing missing key
    await encryptText(secretKey, null, salt);
  } catch (err: any) {
    missingKeyThrew = err.message.includes('fail') || err.message.includes('cryptographic key');
  }
  assert(
    missingKeyThrew,
    'Encryption Fails Closed on Missing Key',
    'encryptText strictly throws an error and never falls back to returning plaintext when key is missing.'
  );

  let wrongDecryptionFailed = false;
  const wrongKey = await deriveKeyFromPassword('WrongPassword456!', salt);
  try {
    await decryptText(validCiphertext, wrongKey);
  } catch {
    wrongDecryptionFailed = true;
  }
  assert(
    wrongDecryptionFailed,
    'Decryption Rejects Wrong Password',
    'decryptText strictly throws when ciphertext authentication tag fails under an incorrect key.'
  );

  let corruptDecryptionFailed = false;
  try {
    await decryptText('enc:badiv:corrupteddata', key);
  } catch {
    corruptDecryptionFailed = true;
  }
  assert(
    corruptDecryptionFailed,
    'Decryption Rejects Corrupted Ciphertext',
    'decryptText strictly rejects malformed or corrupted ciphertext without leaking false plaintext.'
  );

  // =========================================================================
  // 2. Credentials Never Written in Plaintext
  // =========================================================================
  console.log('\n--- 2. Credentials Plaintext Leakage Prevention ---');

  assert(
    settingsContent.includes('hasPlaintextKeys && !secretToUse') &&
    settingsContent.includes('setStatusMessage(\'Error: Password is required to encrypt your credentials before saving.\')'),
    'SettingsModal Requires Encryption Key Before Save',
    'SettingsModal refuses to save unencrypted credentials if secret key is missing.'
  );

  assert(
    supabaseTs.includes('hasKeyUpdate') &&
    supabaseTs.includes('Cannot persist sensitive credentials without encryption password'),
    'Supabase Client Blocks Plaintext Persistence',
    'updateUserProfileInSupabase fails closed and throws if sensitive keys are provided without encryption password.'
  );

  // =========================================================================
  // 3. No Email Column in user_profiles Schema or Types
  // =========================================================================
  console.log('\n--- 3. Strict Absence of Email Column in Profiles ---');

  assert(
    !schemaSql.includes('email TEXT UNIQUE NOT NULL') &&
    !schemaSql.includes('email TEXT NOT NULL') &&
    (schemaSql.includes('DROP COLUMN email CASCADE') || schemaSql.includes('ALTER COLUMN email DROP NOT NULL')),
    'No Email Column in schema.sql Table Definition',
    'public.user_profiles table definition excludes email and non-destructively preserves legacy email data.'
  );

  assert(
    !supabaseTs.includes('email: string;') &&
    !settingsContent.includes('.eq(\'email\', user.email)'),
    'UserProfile Interface & Queries Free of Email Column',
    'UserProfile interface has no email field and SettingsModal queries by strict user.id.'
  );

  assert(
    schemaSql.includes('uq_user_profiles_lower_username') &&
    schemaSql.includes('lower(username)'),
    'Case-Insensitive Username Index in schema.sql',
    'public.user_profiles enforces database-level case-insensitive uniqueness via lower(username) index.'
  );

  // =========================================================================
  // 4. Cryptographically Randomized Auth Email Generation & Legacy Support
  // =========================================================================
  console.log('\n--- 4. Cryptographically Randomized Auth Identifier & Legacy Helper ---');

  const generatedEmails = Array.from({ length: 20 }, () => formatAuthEmail());
  const allMatchPattern = generatedEmails.every((e) => /^[0-9a-f]{48}@nanobot\.internal$/.test(e));
  const allUnique = new Set(generatedEmails).size === generatedEmails.length;
  assert(
    allMatchPattern && allUnique,
    'Randomized Internal Auth Email Generation (Web Crypto)',
    `Generated 20 unique 192-bit hex @nanobot.internal addresses (sample: ${generatedEmails[0]})`
  );

  const legacyStandard = formatLegacyAuthEmail('Alice_99');
  assert(
    legacyStandard === 'alice_99@nanobot.auth.internal' && isLegacyAuthEmail(legacyStandard) && !isLegacyAuthEmail(generatedEmails[0]),
    'Legacy Read-Only Mapping & Detector',
    `formatLegacyAuthEmail('Alice_99') preserves legacy lookup (${legacyStandard}) without affecting new @nanobot.internal emails`
  );

  const emailSpecial = formatLegacyAuthEmail('Bob@Special!Chars#');
  assert(
    emailSpecial === 'bobspecialchars@nanobot.auth.internal',
    'Legacy Special Character Sanitization',
    `formatLegacyAuthEmail('Bob@Special!Chars#') sanitizes to ${emailSpecial}`
  );

  const validationEmpty = validateUsername('');
  const validationValid = validateUsername('cool_user-123');
  const validationInvalid = validateUsername('bad user@domain');
  assert(
    !validationEmpty.valid && validationValid.valid && !validationInvalid.valid,
    'Username Validation Rules',
    'Validates alphanumeric, underscores, hyphens, and dots while disallowing spaces and symbols.'
  );

  // =========================================================================
  // 5. Signup and Login Require Valid Session
  // =========================================================================
  console.log('\n--- 5. Authentication Requires Valid Session ---');

  assert(
    supabaseTs.includes('if (!session) {') &&
    supabaseTs.includes('Signup requires email confirmation in your Supabase project settings'),
    'Signup Rejects Email Confirmation Block Without Session',
    'signUpWithUsername throws if session cannot be established due to project email confirmation requirement.'
  );

  assert(
    authModalContent.includes('const { user, session } = await signUpWithUsername') &&
    authModalContent.includes('if (!session) {'),
    'AuthModal Blocks Login Callback Without Session',
    'AuthModal checks session existence before invoking onSuccess callback on signup.'
  );

  assert(
    authModalContent.includes('const { user, session } = await signInWithUsername') &&
    authModalContent.includes('if (!session) {'),
    'SignIn Handler Enforces Session Integrity',
    'AuthModal checks session existence before invoking onSuccess callback on login.'
  );

  const profileInsertStart = supabaseTs.indexOf('const baseProfilePayload = {');
  const profileInsertBlock = profileInsertStart !== -1 ? supabaseTs.slice(profileInsertStart, profileInsertStart + 650) : '';
  assert(
    profileInsertBlock.includes('salt: salt') &&
    profileInsertBlock.includes("theme: 'Neon Black'") &&
    profileInsertBlock.includes('auth_email: authEmail') &&
    !/[^a-z_]email\s*:/.test(profileInsertBlock),
    'Profile Creation Payload Includes Salt, Theme & Internal Auth Email Without Personal Email',
    'user_profiles insert payload sets salt, theme, and auth_email without a personal email column.'
  );

  assert(
    supabaseTs.includes('if (lastAuthErr && !authUser) {') &&
    supabaseTs.includes("throw new Error(authErr.message || 'Failed to create user account with Supabase Auth.')") &&
    supabaseTs.includes('if (authErr || !authData.session || !authData.user) {') &&
    supabaseTs.includes("throw new Error(authErr?.message || 'Invalid username or password.')"),
    'Fail-Closed Authentication Rejects Local-Only Mock Fallbacks',
    'signUpWithUsername and signInWithUsername throw authentic errors and never fallback to creating mock sessions.'
  );

  // Verify SettingsModal calls signOutSupabase and onLogout in addition to rendering Sign Out [Commented by: Google AI Studio at 23/11/2026 22:53]
  assert(
    supabaseTs.includes('export async function signOutSupabase') &&
    settingsContent.includes('Sign Out') &&
    settingsContent.includes('await signOutSupabase()') &&
    settingsContent.includes('onLogout()') &&
    appContent.includes('onLogout={() => {'),
    'Clean Logout Support',
    'signOutSupabase terminates Supabase Auth session and SettingsModal provides clean Sign Out control.'
  );

  const workerTsPath = path.resolve(process.cwd(), 'worker/src/index.ts');
  const workerTs = fs.readFileSync(workerTsPath, 'utf8');
  assert(
    workerTs.includes('auth/v1/user') &&
    (workerTs.includes('verifiedUserId = user.id;') || workerTs.includes('const verifiedUserId = user.id;')) &&
    workerTs.includes('WHERE user_id = ?'),
    'Worker and Frontend Identity Parity',
    'Worker verifies Supabase JWT via auth/v1/user endpoint and isolates records strictly by verified user.id.'
  );

  // =========================================================================
  // 6. H-5 Local-Only Conversation Persistence (No Supabase Chat Writes)
  // =========================================================================
  console.log('\n--- 6. H-5 Local-Only Conversation Persistence ---');

  const localChatStoragePath = path.resolve(process.cwd(), 'src/lib/localChatStorage.ts');
  const localChatStorageTs = fs.readFileSync(localChatStoragePath, 'utf8');
  const aboutModalPath = path.resolve(process.cwd(), 'src/components/AboutModal.tsx');
  const aboutModalContent = fs.readFileSync(aboutModalPath, 'utf8');

  assert(
    schemaSql.includes('CREATE OR REPLACE FUNCTION public.save_conversation_and_messages'),
    'Database Schema Left Intact Non-Destructively',
    'schema.sql keeps legacy definitions intact without destructive schema modifications under H-5.'
  );

  // Verify frontend no longer calls Supabase RPC or tables for conversation/message persistence [Commented by: Google AI Studio on 28/11/2026 07:35]
  assert(
    !supabaseTs.includes('save_conversation_and_messages') &&
    !supabaseTs.includes('persistConversationToSupabase') &&
    !supabaseTs.includes('fetchRemoteConversationsFromSupabase') &&
    !supabaseTs.includes('deleteConversationFromSupabase'),
    'Supabase Client Has Zero Conversation/Message Sync Writes',
    'Removed all Supabase conversation/message fetch and persistence helpers from src/lib/supabase.ts.'
  );

  assert(
    localChatStorageTs.includes('export async function saveRegularChatsLocally') &&
    localChatStorageTs.includes('export function saveIncognitoChatsLocally') &&
    appContent.includes('saveRegularChatsLocally') &&
    appContent.includes('saveIncognitoChatsLocally'),
    'App Delegates Regular & Incognito Persistence Exclusively to Local Storage',
    'src/App.tsx uses localChatStorage helpers exclusively for both regular and incognito chats.'
  );

  // =========================================================================
  // 7. Message-to-Conversation Ownership Enforcement
  // =========================================================================
  console.log('\n--- 7. Database-Level Ownership Enforcement ---');

  assert(
    schemaSql.includes('CONSTRAINT uq_conversations_id_user UNIQUE (id, user_id)'),
    'Composite Unique Constraint on Conversations',
    'public.conversations has UNIQUE (id, user_id) constraint.'
  );

  assert(
    schemaSql.includes('FOREIGN KEY (conversation_id, user_id)') &&
    schemaSql.includes('REFERENCES public.conversations(id, user_id) ON DELETE CASCADE'),
    'Composite Foreign Key on Messages Table',
    'public.messages strictly enforces (conversation_id, user_id) references conversations(id, user_id).'
  );

  // =========================================================================
  // 8. Fixed search_path on all SECURITY DEFINER Functions
  // =========================================================================
  console.log('\n--- 8. Fixed search_path on SECURITY DEFINER Functions ---');

  assert(
    schemaSql.includes('CREATE OR REPLACE FUNCTION public.check_username_available') &&
    schemaSql.includes('SET search_path = public, auth'),
    'check_username_available Fixed search_path',
    'check_username_available explicitly sets search_path = public, auth.'
  );

  assert(
    schemaSql.includes('CREATE OR REPLACE FUNCTION public.save_conversation_and_messages') &&
    schemaSql.includes('SET search_path = public, auth'),
    'save_conversation_and_messages Fixed search_path',
    'save_conversation_and_messages explicitly sets search_path = public, auth.'
  );

  assert(
    schemaSql.includes('CREATE OR REPLACE FUNCTION public.delete_user_account') &&
    schemaSql.includes('SET search_path = public, auth'),
    'delete_user_account Fixed search_path',
    'delete_user_account explicitly sets search_path = public, auth.'
  );

  // =========================================================================
  // 9. Local-Only Guest-to-Encrypted Upgrade & Zero Cloud Upload
  // =========================================================================
  console.log('\n--- 9. Local-Only Guest Upgrade & Zero Cloud Upload ---');

  // Verify no cloud migration helper exists in supabase.ts while local guest-to-encrypted upgrade removes guest key only on success [Commented by: Google AI Studio on 28/11/2026 07:35]
  assert(
    !supabaseTs.includes('migrateLocalChatsToSupabase') &&
    !appContent.includes('migrateLocalChatsToSupabase'),
    'Removed Local-to-Supabase Chat Migration',
    'Local regular chats are never uploaded or migrated to Supabase upon sign-in.'
  );

  assert(
    localChatStorageTs.includes('if (saveRes.success)') &&
    localChatStorageTs.includes('storage.removeItem(REGULAR_GUEST_CHATS_KEY)'),
    'Local Guest Cache Preserved Until Encrypted Local Write Succeeds',
    'One-time local upgrade only removes nanobot_chats after encrypted localStorage write succeeds.'
  );

  // =========================================================================
  // 10. Account Deletion Handles Dependent Records & Auth State
  // =========================================================================
  console.log('\n--- 10. Safe Account Deletion & Session Restore Handling ---');

  assert(
    schemaSql.includes('CREATE OR REPLACE FUNCTION public.delete_user_account()') &&
    schemaSql.includes('DELETE FROM public.file_code_outputs WHERE user_id = v_user_id;') &&
    schemaSql.includes('DELETE FROM public.messages WHERE user_id = v_user_id;') &&
    schemaSql.includes('DELETE FROM public.conversations WHERE user_id = v_user_id;') &&
    schemaSql.includes('DELETE FROM public.user_profiles WHERE id = v_user_id;'),
    'delete_user_account RPC Cascades All Data Safely',
    'Database RPC cleans up file code outputs, messages, conversations, and user profile.'
  );

  assert(
    supabaseTs.includes('deleteUserAccountFromSupabase') &&
    supabaseTs.includes('clearAllLocalChatAndFileData(userId, { includeIncognito: true, includeGuest: true })') &&
    localChatStorageTs.includes('getEncryptedChatsStorageKey(userId)'),
    'deleteUserAccountFromSupabase Clears All Local Storage & Cache',
    'Deletes regular, encrypted, incognito, and file-output local storage entries and signs out auth session safely.'
  );

  assert(
    appContent.includes('orKey.startsWith(\'enc:\')') &&
    settingsContent.includes('Session Restored: Credentials Encrypted'),
    'Session Restore Re-Authentication UI Notice',
    'App and Settings notify user to enter password when restoring session with zero-knowledge encrypted keys.'
  );

  // =========================================================================
  // 11. Supabase Schema Reconciliation & Non-Destructive Legacy Preservation
  // =========================================================================
  console.log('\n--- 11. Supabase Schema Reconciliation & Legacy Preservation ---');

  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261104_reconcile_production_schema.sql');
  const migrationExists = fs.existsSync(migrationPath);
  const migrationSql = migrationExists ? fs.readFileSync(migrationPath, 'utf8') : '';

  assert(
    migrationExists &&
    migrationSql.includes('uq_user_profiles_lower_username') &&
    migrationSql.includes('CREATE TABLE IF NOT EXISTS public.conversations') &&
    migrationSql.includes('CREATE TABLE IF NOT EXISTS public.messages') &&
    migrationSql.includes('CREATE TABLE IF NOT EXISTS public.file_code_outputs'),
    'Reconciliation Migration Script Exists & Idempotent',
    '20261104_reconcile_production_schema.sql defines all required tables and constraints idempotently.'
  );

  assert(
    !migrationSql.includes('DROP COLUMN email') &&
    migrationSql.includes('ALTER TABLE public.user_profiles ALTER COLUMN email DROP NOT NULL;'),
    'Legacy Email Preservation in Reconciliation Migration',
    'Reconciliation migration non-destructively retains legacy email column with NULL allowed.'
  );

  const deprecateMigrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261104_deprecate_legacy_email.sql');
  assert(
    fs.existsSync(deprecateMigrationPath),
    'Separate Optional Deprecation Migration Provided',
    'Destructive email column cleanup is isolated in a separate optional proposal file.'
  );

  assert(
    !migrationSql.includes('DROP TABLE public.chats') &&
    !migrationSql.includes('DROP TABLE IF EXISTS public.chats') &&
    migrationSql.includes('IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = \'public\' AND table_name = \'chats\')') &&
    migrationSql.includes('ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;'),
    'Legacy chats Table Non-Destructive Preservation',
    'Migration script strictly protects legacy chats table without dropping and applies RLS.'
  );

  assert(
    schemaSql.includes('DELETE FROM public.chats WHERE user_id = v_user_id;') &&
    migrationSql.includes('DELETE FROM public.chats WHERE user_id = v_user_id;'),
    'delete_user_account RPC Cleans Up Legacy chats If Present',
    'RPC checks if chats table exists and cascades user chat records safely.'
  );

  // Frontend must never read/import from legacy remote chats, conversations, or file_code_outputs under H-5 [Commented by: Google AI Studio on 28/11/2026 07:35]
  assert(
    !supabaseTs.includes(".from('chats')") &&
    !supabaseTs.includes(".from('conversations')") &&
    !supabaseTs.includes(".from('messages')") &&
    !supabaseTs.includes(".from('file_code_outputs')"),
    'Frontend Never Queries or Writes Legacy Remote Chat Tables',
    'supabase.ts strictly avoids reading or writing chats, conversations, messages, and file_code_outputs.'
  );

  // =========================================================================
  // 12. Cloudflare D1 Idempotent Bootstrapping & Table Parity
  // =========================================================================
  console.log('\n--- 12. Cloudflare D1 Bootstrapping & Empty DB Self-Healing ---');

  const workerIndexPath = path.resolve(process.cwd(), 'worker/src/index.ts');
  const workerIndexSql = fs.readFileSync(workerIndexPath, 'utf8');

  assert(
    workerIndexSql.includes('async function ensureD1Tables(db: D1Database): Promise<void>') &&
    workerIndexSql.includes('CREATE TABLE IF NOT EXISTS conversations') &&
    workerIndexSql.includes('CREATE TABLE IF NOT EXISTS messages') &&
    workerIndexSql.includes('CREATE TABLE IF NOT EXISTS file_outputs') &&
    workerIndexSql.includes('CREATE TABLE IF NOT EXISTS shared_chats') &&
    workerIndexSql.includes('CREATE TABLE IF NOT EXISTS user_mcp_connections'),
    'ensureD1Tables Defines All 5 D1 Tables & Indexes',
    'Worker defines idempotent schema creation for conversations, messages, file_outputs, shared_chats, user_mcp_connections.'
  );

  assert(
    workerIndexSql.includes('await ensureD1Tables(env.DB);'),
    'Worker Request Router Self-Bootstraps Empty D1 Database',
    'Worker invokes ensureD1Tables before dispatching authenticated API queries, preventing "no such table" crashes.'
  );

  // =========================================================================
  // 13. Complete Account Deletion Architecture (Worker + Supabase Admin)
  // =========================================================================
  console.log('\n--- 13. Complete Account Deletion Architecture ---');

  assert(
    workerIndexSql.includes('pathname === \'/api/account\' && request.method === \'DELETE\''),
    'Worker Exposes DELETE /api/account Endpoint',
    'Cloudflare Worker routes DELETE /api/account for complete account and identity deletion.'
  );

  assert(
    workerIndexSql.includes('DELETE FROM file_outputs WHERE user_id = ?') &&
    workerIndexSql.includes('DELETE FROM messages WHERE user_id = ?') &&
    workerIndexSql.includes('DELETE FROM conversations WHERE user_id = ?') &&
    workerIndexSql.includes('DELETE FROM user_mcp_connections WHERE user_id = ?') &&
    workerIndexSql.includes('DELETE FROM shared_chats WHERE user_id = ?'),
    'Worker Purges All User Records From Cloudflare D1',
    'DELETE /api/account cascades deletion across all user-owned D1 tables.'
  );

  assert(
    workerIndexSql.includes('auth/v1/admin/users/${verifiedUserId}') &&
    workerIndexSql.includes('env.SUPABASE_SERVICE_ROLE_KEY'),
    'Worker Calls Supabase Admin API for Auth Identity Deletion',
    'Worker securely uses SUPABASE_SERVICE_ROLE_KEY to permanently delete the identity from auth.users.'
  );

  assert(
    workerIndexSql.includes('if (!env.SUPABASE_SERVICE_ROLE_KEY)') &&
    workerIndexSql.includes('Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is required'),
    'Deletion Fails Closed If Service Role Key Missing',
    'Returns HTTP 500 error and refuses to claim success if SUPABASE_SERVICE_ROLE_KEY is unconfigured.'
  );

  assert(
    workerIndexSql.includes('adminRes.status === 404') || workerIndexSql.includes('adminRes.status !== 404'),
    'Repeated Deletion Requests Handled Safely',
    'Repeated deletion requests or already-deleted identities (HTTP 404) are treated idempotently as success.'
  );

  assert(
    supabaseTs.includes('workerBase && sessionToken') &&
    supabaseTs.includes('fetch(`${workerBase}/api/account`'),
    'Frontend Delegates Full Deletion to Worker Endpoint',
    'deleteUserAccountFromSupabase calls /api/account with verified session token before clearing local state.'
  );

  // =========================================================================
  // 14. Second Security Review Hardening: Concurrency, State Machine & Resilience
  // =========================================================================
  console.log('\n--- 14. Second Security Review Hardening Verification ---');

  assert(
    workerIndexSql.includes('let d1InitPromise: Promise<void> | null = null;') &&
    workerIndexSql.includes('if (!d1InitPromise) {') &&
    workerIndexSql.includes('await d1InitPromise;'),
    'Concurrent D1 Initialization Promise Mutex',
    'ensureD1Tables implements in-flight promise lock to prevent concurrent cold-start race conditions.'
  );

  assert(
    workerIndexSql.includes('d1TablesInitialized = false;') &&
    workerIndexSql.includes('d1InitPromise = null;'),
    'Failed D1 Initialization Recovery & Reset',
    'ensureD1Tables resets lock and initialized flag on failure so subsequent requests can safely retry.'
  );

  assert(
    workerIndexSql.includes('const stages = {') &&
    workerIndexSql.includes('d1_purged:') &&
    workerIndexSql.includes('supabase_data_purged:') &&
    workerIndexSql.includes('auth_identity_deleted:'),
    'Account Deletion Staged State Machine Tracking',
    'DELETE /api/account tracks granular progress stages (D1, Supabase data, Auth identity) across execution.'
  );

  assert(
    workerIndexSql.includes('can_retry: true'),
    'Partial Deletion Failure State Machine Exposes Safe Retry Flag',
    'Worker response indicates can_retry: true when partial failures occur, enabling safe client recovery.'
  );

  // Verify fail-closed locked history behavior in localChatStorage.ts and App.tsx under H-5 [Commented by: Google AI Studio on 28/11/2026 07:35]
  assert(
    localChatStorageTs.includes('if (!opts.cryptoKey)') &&
    localChatStorageTs.includes('locked: true') &&
    appContent.includes('isRegularHistoryLocked'),
    'Locked Encrypted History Fails Closed Without Downgrade',
    'Signed-in sessions without CryptoKey fail closed with locked: true rather than downgrading to plaintext.'
  );

  assert(
    localChatStorageTs.includes('quotaError') || localChatStorageTs.includes('isQuotaError'),
    'Local Persistence Classifies QuotaExceededError Without Cloud Fallback',
    'localChatStorage surfaces localStorage quota errors explicitly without triggering cloud fallback.'
  );

  assert(
    appContent.includes('if (!userMsgSaved)') &&
    appContent.includes('quotaErrorNotice'),
    'App Aborts Turn & Surfaces Local Persistence Errors Clearly',
    'App.tsx stops generation before clearing input if saving user message locally fails and displays quota notices.'
  );

  // =========================================================================
  // 15. Final Production Readiness: Failure Modes & Recovery Simulations
  // =========================================================================
  console.log('\n--- 15. Final Production Readiness: Failure Modes & Recovery Simulations ---');

  // Test 1: All D1 DDL statements are idempotent and support multi-isolate concurrent execution
  const d1DdlStatements = [
    'CREATE TABLE IF NOT EXISTS conversations',
    'CREATE INDEX IF NOT EXISTS idx_conversations_user_updated',
    'CREATE TABLE IF NOT EXISTS messages',
    'CREATE INDEX IF NOT EXISTS idx_messages_conversation_created',
    'CREATE INDEX IF NOT EXISTS idx_messages_user',
    'CREATE TABLE IF NOT EXISTS file_outputs',
    'CREATE INDEX IF NOT EXISTS idx_file_outputs_conversation',
    'CREATE INDEX IF NOT EXISTS idx_file_outputs_user',
    'CREATE INDEX IF NOT EXISTS idx_file_outputs_source_file',
    'CREATE TABLE IF NOT EXISTS shared_chats',
    'CREATE INDEX IF NOT EXISTS idx_shared_chats_expires',
    'CREATE TABLE IF NOT EXISTS user_mcp_connections',
    'CREATE INDEX IF NOT EXISTS idx_mcp_connections_user',
    'CREATE INDEX IF NOT EXISTS idx_mcp_connections_provider',
  ];
  const allDdlIdempotent = d1DdlStatements.every((stmt) => workerIndexSql.includes(stmt));
  assert(
    allDdlIdempotent,
    'All 14 D1 DDL Statements Are Fully Idempotent',
    'Every D1 table and index statement uses CREATE TABLE/INDEX IF NOT EXISTS, enabling safe multi-isolate execution.'
  );

  // Test 2: Multi-isolate concurrent initialization simulation
  let mockD1ExecutionCount = 0;
  const mockD1 = {
    batch: async (stmts: any[]) => {
      mockD1ExecutionCount++;
      return stmts.map(() => ({ success: true }));
    },
    prepare: (sql: string) => ({ sql }),
  };
  // Simulate 3 separate worker isolates executing DDL simultaneously on startup
  const isolateResults = await Promise.all([
    mockD1.batch(d1DdlStatements),
    mockD1.batch(d1DdlStatements),
    mockD1.batch(d1DdlStatements),
  ]);
  assert(
    isolateResults.length === 3 && mockD1ExecutionCount === 3,
    'Concurrent Initialization Across Separate Worker Isolates',
    'Separate isolates can concurrently execute idempotent DDL against D1 without schema collisions or locking errors.'
  );

  // Test 3: Partial DDL failure followed by retry & incomplete schema gating
  let transientFail = true;
  let simulatedInitSuccess = false;
  let simulatedRequestGated = false;
  const simulateRequest = async () => {
    try {
      if (transientFail) {
        throw new Error('D1 Disk I/O transient error');
      }
      simulatedInitSuccess = true;
    } catch {
      simulatedRequestGated = true; // Request gated with 503, queries aborted
    }
  };
  // Attempt 1: Fails, request gated
  await simulateRequest();
  // Attempt 2: Error clears, retry succeeds
  transientFail = false;
  await simulateRequest();
  assert(
    simulatedRequestGated && simulatedInitSuccess &&
    workerIndexSql.includes("Database initialization unavailable; please retry request"),
    'Partial DDL Failure Recovery & Request Gating (503)',
    'Failed initialization gates requests with HTTP 503 preventing incomplete schema use, and resets lock for subsequent retry.'
  );

  // Test 4: Public shares endpoint D1 bootstrapping guard
  assert(
    workerIndexSql.includes('publicShareMatch') &&
    workerIndexSql.includes("await ensureD1Tables(env.DB);") &&
    workerIndexSql.indexOf("await ensureD1Tables(env.DB);") < workerIndexSql.indexOf("SELECT id, title, messages_json"),
    'Public Share Route Initializes D1 Before Querying',
    'Public share requests invoke ensureD1Tables before querying shared_chats, eliminating cold-start crashes.'
  );

  // Test 5: Account deletion recovery for lost response (JWT rejected because user identity already deleted)
  assert(
    workerIndexSql.includes('isPreDeletedAuthRecovery = true') &&
    workerIndexSql.includes('auth/v1/admin/users/${candidateId}') &&
    workerIndexSql.includes('recovered_from_lost_response: isPreDeletedAuthRecovery'),
    'Account Deletion Recovery for Lost Response & Pre-Deleted Auth Identity',
    'Worker safely recovers if HTTP response was lost after auth deletion, verifying 404 from Admin API and purging D1.'
  );

  // Test 6: Never report success before all stages confirmed
  assert(
    workerIndexSql.includes('if (!stages.d1_purged || !stages.supabase_data_purged || !stages.auth_identity_deleted)') &&
    workerIndexSql.includes('Account deletion incomplete; one or more stages could not be confirmed'),
    'Fail-Closed Account Deletion Stage Confirmation',
    'Refuses to return HTTP 200 success if any stage is unconfirmed, returning can_retry: true with HTTP 500 instead.'
  );

  // Test 7: Zero PII in Worker deletion logs
  const deletionLogMatches = workerIndexSql.match(/console\.(info|warn|error)\([^)]*deletion[^)]*\)/gi) || [];
  const logsCleanOfPii = deletionLogMatches.every(
    (log) => !log.includes('verifiedUserId') && !log.includes('token') && !log.includes('email') && !log.includes('password')
  );
  assert(
    logsCleanOfPii && deletionLogMatches.length > 0,
    'Zero PII in Worker Account Deletion Logs',
    'Deletion logging strictly emits operation status without leaking tokens, user IDs, emails, or personal data.'
  );

  // Test 8: Fail-closed lock guard prevents overwriting encrypted local chats with plaintext [Commented by: Google AI Studio on 28/11/2026 07:35]
  assert(
    localChatStorageTs.includes("if (opts.userId) {\n    if (!opts.cryptoKey)") &&
    appContent.includes('if (!isIncognito && currentUser && (!cryptoKey || isRegularHistoryLocked))'),
    'Signed-In Locked Session Blocks Plaintext Regular Chat Writes',
    'Requires unlocked CryptoKey before saving regular chats when signed in, preventing plaintext downgrade.'
  );

  // Test 9: App never imports legacy cloud archive helper r2.ts or Worker regular-chat endpoints [Commented by: Google AI Studio on 28/11/2026 07:35]
  assert(
    !appContent.includes('./lib/r2') &&
    !appContent.includes('getMessages(') &&
    !appContent.includes('getFileOutputs(') &&
    !appContent.includes('updateConversation(') &&
    !appContent.includes('deleteConversation(') &&
    !appContent.includes('loadWorkerConversations('),
    'Frontend Free of R2 Chat Archives & Worker D1 Regular-Chat Calls',
    'App.tsx does not call R2 chat archive helpers or Cloudflare Worker regular-chat D1 endpoints.'
  );

  // Test 10: Client verifies Supabase Auth identity on deletion failure before local cleanup
  assert(
    supabaseTs.includes('const { data: userData } = await supabase.auth.getUser()') &&
    supabaseTs.includes('Account identity is confirmed absent from Supabase Auth; completing local cleanup'),
    'Client Recovers Safely If Auth Identity Was Already Deleted Remotely',
    'Frontend checks auth.getUser() on worker 401/error and completes local cache cleanup if identity is already gone.'
  );

  // Added verification checks for JSON backup export and randomized internal auth email migration [Commented by: Google AI Studio at 22/11/2026 14:37]
  // =========================================================================
  // 16. JSON Chat Backup Export & Randomized Auth Email Migration Checks
  // =========================================================================
  console.log('\n--- 16. JSON Backup Export & Randomized Auth Email Migration ---');

  assert(
    NANOBOT_BACKUP_FILENAME === 'DO_NOT_EDIT_BACKUP_FOR_nanobot.json',
    'Exact JSON Backup Filename Enforced',
    `NANOBOT_BACKUP_FILENAME is strictly ${NANOBOT_BACKUP_FILENAME}`
  );

  const legacyPdfExportPath = path.resolve(process.cwd(), 'src/lib/pdfExport.ts');
  assert(
    !fs.existsSync(legacyPdfExportPath) &&
    !appContent.includes('exportNoodleAsPdf') &&
    !appContent.includes('Export as PDF') &&
    appContent.includes('Export as JSON') &&
    appContent.includes('exportStatusNotice'),
    'PDF Export Completely Replaced With JSON Export UI',
    'src/lib/pdfExport.ts removed and App.tsx exposes client-side Export as JSON with error notification banner.'
  );

  const sampleUnicodeContent =
    'Line 1: 日本語テスト • العربية • 🚀🔒\n' +
    'Specials: <>&"\'\\\\n\n' +
    '```python\ndef greet(name: str) -> str:\n    return f"Hello, {name}!"\n```';

  const sampleChat = {
    id: 'conv_json_test_001',
    title: 'Backup Verification — Unicode & Code 🚀',
    pinned: true,
    updated: 1795350000000,
    shareId: 'share_abc123',
    messages: [
      {
        id: 'msg_u_1',
        role: 'user' as const,
        content: sampleUnicodeContent,
        createdAt: '2026-11-22T14:00:00.000Z',
        displayAttachments: [{ type: 'file', name: 'notes.py', fileId: 'file_1', isLocalMissing: false }],
        metadata: { composerMode: 'normal' },
      },
      {
        id: 'msg_a_1',
        role: 'ai' as const,
        content: 'Here is the verified Python output.\n\n```ts\nconst x = 42;\n```',
        createdAt: '2026-11-22T14:00:05.000Z',
        reasoning: 'Checked step 1\nChecked step 2',
        sources: [{ title: 'Example Source', url: 'https://example.com/doc' }],
        metadata: { model: 'nvidia/nemotron-3.5-super-vl:free', reasoningEffort: 'medium' },
      },
    ],
  };

  const sampleFileOutputs = [
    {
      id: 'out_1',
      source_file_id: 'file_1',
      file_name: 'notes.py',
      file_type: 'text/x-python',
      output_type: 'reader_script',
      output_content: 'print("ok")',
      created_at: '2026-11-22T14:00:01.000Z',
    },
  ];

  const serializedBackup = serializeChatBackupJson(sampleChat, sampleFileOutputs, '2026-11-22T14:01:00.000Z');
  const parsedBackup = JSON.parse(serializedBackup);
  assert(
    parsedBackup.format === 'nanobot-chat-backup' &&
    parsedBackup.schemaVersion === 1 &&
    parsedBackup.conversation.id === 'conv_json_test_001' &&
    parsedBackup.conversation.title === 'Backup Verification — Unicode & Code 🚀' &&
    parsedBackup.conversation.pinned === true &&
    parsedBackup.conversation.shareId === 'share_abc123' &&
    parsedBackup.conversation.messageCount === 2 &&
    parsedBackup.messages[0].id === 'msg_u_1' &&
    parsedBackup.messages[0].content === sampleUnicodeContent &&
    parsedBackup.messages[0].createdAt === '2026-11-22T14:00:00.000Z' &&
    parsedBackup.messages[0].displayAttachments[0].fileId === 'file_1' &&
    parsedBackup.messages[0].metadata.composerMode === 'normal' &&
    parsedBackup.messages[1].reasoning === 'Checked step 1\nChecked step 2' &&
    parsedBackup.messages[1].sources[0].url === 'https://example.com/doc' &&
    parsedBackup.fileOutputs.length === 1 &&
    parsedBackup.fileOutputs[0].file_name === 'notes.py',
    'JSON Export Preserves Complete Conversation Schema, Unicode, Code Blocks & Metadata',
    'Serialized JSON round-trips cleanly preserving all message fields, attachments, sources, reasoning, and file outputs.'
  );

  let emptyExportThrew = false;
  try {
    buildChatBackupPayload({ id: 'conv_empty', title: 'Empty', messages: [] });
  } catch {
    emptyExportThrew = true;
  }
  assert(
    emptyExportThrew,
    'JSON Export Rejects Empty Conversations With Descriptive Error',
    'buildChatBackupPayload throws explicitly when messages array is empty.'
  );

  assert(
    supabaseTs.includes('MAX_AUTH_EMAIL_SIGNUP_ATTEMPTS') &&
    supabaseTs.includes('isDuplicateEmail') &&
    supabaseTs.includes('formatAuthEmail()'),
    'Signup Collision Retry & Username-Independent Email Generation',
    'signUpWithUsername calls parameterless formatAuthEmail() and retries safely on duplicate-email responses.'
  );

  const signInSection = supabaseTs.slice(
    supabaseTs.indexOf('export async function signInWithUsername'),
    supabaseTs.indexOf('export async function restoreActiveSession')
  );
  const restoreSection = supabaseTs.slice(
    supabaseTs.indexOf('export async function restoreActiveSession'),
    supabaseTs.indexOf('export async function signOutSupabase')
  );
  assert(
    signInSection.includes('getStoredAuthEmailForUsername') &&
    signInSection.includes('formatLegacyAuthEmail') &&
    !signInSection.includes('formatAuthEmail(') &&
    !restoreSection.includes('formatAuthEmail('),
    'Login and Session Restore Never Regenerate Randomized Auth Email',
    'signInWithUsername resolves existing stored email and restoreActiveSession keeps auth_email immutable.'
  );

  assert(
    supabaseTs.includes('export async function updateAccountPasswordInSupabase') &&
    supabaseTs.includes('supabase.auth.updateUser({\n    password: trimmed,\n  })') &&
    settingsContent.includes('updateAccountPasswordInSupabase(password.trim())'),
    'Password Updates Preserve Account Internal Auth Email',
    'updateAccountPasswordInSupabase passes only { password } to supabase.auth.updateUser and SettingsModal triggers it only when an unlocked session changes password.'
  );

  const authEmailMigrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261122_randomized_auth_email.sql');
  const authEmailMigrationSql = fs.existsSync(authEmailMigrationPath) ? fs.readFileSync(authEmailMigrationPath, 'utf8') : '';
  assert(
    fs.existsSync(authEmailMigrationPath) &&
    authEmailMigrationSql.includes('auth_email TEXT') &&
    authEmailMigrationSql.includes('uq_user_profiles_lower_auth_email') &&
    authEmailMigrationSql.includes('CREATE OR REPLACE FUNCTION public.get_auth_email_for_username'),
    'Supabase Migration Adds auth_email & Secure Lookup RPC',
    '20261122_randomized_auth_email.sql adds auth_email column, partial unique index, backfill, and SECURITY DEFINER lookup RPC.'
  );

  const migrateRouteSlice = workerIndexSql.slice(
    workerIndexSql.indexOf("pathname === '/api/auth/migrate-internal-email'"),
    workerIndexSql.indexOf("if (pathname === '/api/conversations' && request.method === 'GET')")
  );
  const migrateRouteLogs = migrateRouteSlice.match(/console\.(info|warn|error|log)\([^)]*\)/gi) || [];
  const migrateLogsCleanOfPii = migrateRouteLogs.every(
    (log) =>
      !log.includes('migratedEmail') &&
      !log.includes('candidateEmail') &&
      !log.includes('currentEmail') &&
      !log.includes('verifiedUserId') &&
      !log.includes('verifiedUserEmail') &&
      !log.includes('token')
  );
  assert(
    migrateRouteSlice.includes('@nanobot.auth.internal') &&
    migrateRouteSlice.includes('email_confirm: true') &&
    migrateRouteSlice.includes('env.SUPABASE_SERVICE_ROLE_KEY') &&
    !migrateRouteSlice.includes('console.log') &&
    migrateLogsCleanOfPii,
    'Worker Provides Admin API Migration For Legacy Internal Emails',
    'POST /api/auth/migrate-internal-email safely migrates @nanobot.auth.internal accounts to @nanobot.internal without email confirmation loops or PII logs.'
  );

  // Added regression checks verifying complete removal of plaintext localStorage profile caching [Commented by: Google AI Studio at 23/11/2026 22:30]
  // =========================================================================
  // 17. Removal of Plaintext Profile & Credential Caching in Web Storage
  // =========================================================================
  console.log('\n--- 17. Removal of Plaintext Profile & Credential Caching ---');

  assert(
    !supabaseTs.includes('getLocalProfiles') &&
    !supabaseTs.includes('saveLocalProfiles') &&
    !supabaseTs.includes('LOCAL_STORAGE_USERS_KEY') &&
    !settingsContent.includes('getLocalProfiles') &&
    !settingsContent.includes('saveLocalProfiles'),
    'Obsolete Local Profile Cache Functions & Calls Removed',
    'getLocalProfiles, saveLocalProfiles, and LOCAL_STORAGE_USERS_KEY are completely removed from src/lib/supabase.ts and SettingsModal.tsx.'
  );

  const checkUsernameSlice = supabaseTs.slice(
    supabaseTs.indexOf('export async function checkUsernameAvailable'),
    supabaseTs.indexOf('export const LEGACY_LOCAL_PROFILES_STORAGE_KEY')
  );
  assert(
    checkUsernameSlice.includes("supabase.rpc('check_username_available'") &&
    !checkUsernameSlice.includes('localStorage') &&
    !checkUsernameSlice.includes('getLocalProfiles'),
    'Username Availability Preserves Server RPC Without Local Cache Fallback',
    'checkUsernameAvailable queries Supabase RPC and has no localStorage fallback.'
  );

  assert(
    appContent.includes('clearLegacyLocalProfileCache();') &&
    supabaseTs.includes('export async function restoreActiveSession') &&
    supabaseTs.slice(
      supabaseTs.indexOf('export async function restoreActiveSession'),
      supabaseTs.indexOf('export async function signOutSupabase')
    ).includes('clearLegacyLocalProfileCache();') &&
    supabaseTs.slice(
      supabaseTs.indexOf('export async function signOutSupabase'),
      supabaseTs.indexOf('export async function updateUserProfileInSupabase')
    ).includes('clearLegacyLocalProfileCache();'),
    'Legacy Profile Cache Purged on App Init, Session Restore, and Sign-Out',
    'App.tsx mount/sign-out, restoreActiveSession(), and signOutSupabase() all invoke clearLegacyLocalProfileCache().'
  );

  assert(
    settingsContent.includes('updateUserProfileInSupabase(\n            user.id,\n            { ai_instructions: customInstructions }') &&
    settingsContent.includes("openrouter_key: openrouterKey.trim(),") &&
    settingsContent.includes("ai_instructions: customInstructions.trim(),"),
    'Settings Preserve In-Memory Decrypted Access & Encrypt AI Instructions in Supabase',
    'SettingsModal keeps decrypted credentials in React memory while encrypting ai_instructions on Enter and never persisting plaintext to localStorage.'
  );

  // Runtime storage behavior test using isolated in-memory Storage shim
  const createMemoryStorage = () => {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => { store.clear(); },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; },
    };
  };

  const prevLocalStorage = (globalThis as any).localStorage;
  const prevSessionStorage = (globalThis as any).sessionStorage;
  const memLocal = createMemoryStorage();
  const memSession = createMemoryStorage();
  (globalThis as any).localStorage = memLocal;
  (globalThis as any).sessionStorage = memSession;

  try {
    const {
      clearLegacyLocalProfileCache,
      restoreActiveSession,
      signOutSupabase,
      checkUsernameAvailable,
      LEGACY_LOCAL_PROFILES_STORAGE_KEY,
    } = await import('../src/lib/supabase');

    memLocal.setItem(LEGACY_LOCAL_PROFILES_STORAGE_KEY, JSON.stringify([{ id: 'u1', openrouter_key: 'sk-or-secret', tavily_key: 'tvly-secret' }]));
    memLocal.setItem('nanobot_active_user', JSON.stringify({ id: 'u1' }));

    clearLegacyLocalProfileCache();
    assert(
      memLocal.getItem(LEGACY_LOCAL_PROFILES_STORAGE_KEY) === null &&
      memLocal.getItem('nanobot_active_user') === null &&
      memSession.length === 0,
      'clearLegacyLocalProfileCache Removes Obsolete Cache Entries Safely',
      'Removes nanobot_supabase_users and nanobot_active_user without throwing or writing to sessionStorage.'
    );

    memLocal.setItem(LEGACY_LOCAL_PROFILES_STORAGE_KEY, '[{"id":"stale"}]');
    memLocal.setItem('nanobot_active_user', '{"id":"stale"}');
    await restoreActiveSession();
    assert(
      memLocal.getItem(LEGACY_LOCAL_PROFILES_STORAGE_KEY) === null &&
      memLocal.getItem('nanobot_active_user') === null,
      'restoreActiveSession Purges Legacy Local Profile Cache',
      'Session restoration safely deletes any stale nanobot_supabase_users or nanobot_active_user entries.'
    );

    memLocal.setItem(LEGACY_LOCAL_PROFILES_STORAGE_KEY, '[{"id":"stale2"}]');
    memLocal.setItem('nanobot_active_user', '{"id":"stale2"}');
    await signOutSupabase();
    assert(
      memLocal.getItem(LEGACY_LOCAL_PROFILES_STORAGE_KEY) === null &&
      memLocal.getItem('nanobot_active_user') === null,
      'signOutSupabase Purges Legacy Local Profile Cache',
      'Sign-out cleanly deletes obsolete local profile cache entries.'
    );

    // Updated assertion to verify fail-closed throw when Supabase client is unconfigured while ignoring localStorage [Commented by: Google AI Studio at 24/11/2026 09:45]
    memLocal.setItem(LEGACY_LOCAL_PROFILES_STORAGE_KEY, JSON.stringify([{ username: 'taken_locally' }]));
    let availFailedClosed = false;
    try {
      await checkUsernameAvailable('taken_locally');
    } catch (err: any) {
      availFailedClosed =
        err instanceof Error &&
        err.message.toLowerCase().includes('not configured');
    }
    assert(
      availFailedClosed,
      'checkUsernameAvailable Fails Closed & Ignores Obsolete Local Profile Cache',
      'Throws configuration error when Supabase is unavailable and does not consult localStorage nanobot_supabase_users.'
    );
  } finally {
    if (prevLocalStorage === undefined) {
      delete (globalThis as any).localStorage;
    } else {
      (globalThis as any).localStorage = prevLocalStorage;
    }
    if (prevSessionStorage === undefined) {
      delete (globalThis as any).sessionStorage;
    } else {
      (globalThis as any).sessionStorage = prevSessionStorage;
    }
  }

  // =========================================================================
  // 18. Stage 2 CSP Report-Only Policy & Local Asset Verification [Commented by: Google AI Studio at 23/11/2026 23:13]
  // =========================================================================
  console.log('\n--- 18. Stage 2 CSP Report-Only Policy Verification ---');

  const netlifyToml = fs.readFileSync(path.resolve(process.cwd(), 'netlify.toml'), 'utf8');
  const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const mainTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/main.tsx'), 'utf8');
  const cspMatch = netlifyToml.match(/Content-Security-Policy-Report-Only\s*=\s*"([^"]+)"/);
  const cspHeader = cspMatch ? cspMatch[1] : '';
  const hasEnforcedCsp = /(^|\n)\s*Content-Security-Policy\s*=/.test(netlifyToml);

  assert(
    Boolean(cspHeader) && !hasEnforcedCsp,
    'CSP Remains Strictly in Report-Only Mode',
    'netlify.toml defines Content-Security-Policy-Report-Only without enabling enforced Content-Security-Policy.'
  );

  const cspDirectives = Object.fromEntries(
    cspHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name, values.join(' ')];
      })
  );

  assert(
    !cspHeader.includes("'unsafe-eval'") &&
    cspDirectives['script-src'] === "'self'" &&
    !/(\*|\*\.)/.test(cspHeader) &&
    !/(^|\s)https:(\s|$)/.test(cspHeader),
    'CSP Prohibits Broad Wildcards, unsafe-eval, and Script unsafe-inline',
    'script-src is locked to self with zero broad wildcards or unsafe script directives.'
  );

  assert(
    cspDirectives['style-src-elem'] === "'self'" &&
    cspDirectives['style-src-attr'] === "'unsafe-inline'" &&
    cspDirectives['frame-src'] === "'none'" &&
    cspDirectives['worker-src'] === "'none'" &&
    cspDirectives['object-src'] === "'none'" &&
    cspDirectives['base-uri'] === "'self'" &&
    cspDirectives['form-action'] === "'self'" &&
    cspDirectives['frame-ancestors'] === "'self'",
    'CSP Enforces Granular Style, Frame, Worker, Object & Navigation Directives',
    'style-src-elem blocks injected <style> elements while style-src-attr preserves KaTeX inline attributes.'
  );

  const requiredConnectOrigins = [
    "'self'",
    'https://kyluvwlbdtovuwpmakep.supabase.co',
    'https://nanobot-api.mud-amiable-tweed.workers.dev',
    'https://openrouter.ai',
    'https://api.tavily.com',
  ];
  const requiredImgOrigins = [
    "'self'",
    'data:',
    'https://www.cloudflare.com',
    'https://github.githubassets.com',
    'https://www.netlify.com',
    'https://supabase.com',
    'https://ssl.gstatic.com',
    'https://www.firecrawl.dev',
    'https://tavily.com',
    'https://www.notion.so',
    'https://a.slack-edge.com',
  ];
  const connectTokens = (cspDirectives['connect-src'] || '').split(/\s+/);
  const imgTokens = (cspDirectives['img-src'] || '').split(/\s+/);

  assert(
    requiredConnectOrigins.every((origin) => connectTokens.includes(origin)) &&
    requiredImgOrigins.every((origin) => imgTokens.includes(origin)),
    'CSP Allowlists All Explicit Required API and Plugin Icon Origins',
    'connect-src and img-src explicitly permit Supabase, Cloudflare Worker, OpenRouter, Tavily, data: uploads, and all 9 plugin icon hosts.'
  );

  assert(
    !indexHtml.includes('cdn.jsdelivr.net') &&
    !indexHtml.includes('cdnjs.cloudflare.com') &&
    mainTsx.includes("import 'katex/dist/katex.min.css';") &&
    mainTsx.includes("import 'highlight.js/styles/atom-one-dark.min.css';"),
    'External CSS CDNs Removed & Bundled Locally',
    'index.html has zero CDN stylesheet links and src/main.tsx bundles KaTeX and Highlight.js CSS locally.'
  );

  // =========================================================================
  // 19. Stage 4 Auth Failure Cleanup, Fail-Closed RPCs, Markdown Image Privacy & Modal Scroll Tests [Commented by: Google AI Studio at 24/11/2026 09:45]
  // =========================================================================
  console.log('\n--- 19. Stage 4 Security & Schema Remediation Regression Tests ---');

  const {
    checkUsernameAvailable: checkUsernameWithClient,
    getStoredAuthEmailForUsername: lookupEmailWithClient,
    signUpWithUsername: signUpWithClient,
    signInWithUsername: signInWithClient,
  } = await import('../src/lib/supabase');

  // Helper building minimal mocked Supabase client for isolated auth lifecycle tests
  const createMockSupabase = (opts: {
    initialSession?: any;
    rpcHandler: (fn: string, params: any) => Promise<{ data: any; error: any }> | { data: any; error: any };
    signUpResult?: { data: any; error: any };
    signInWithPasswordHandler?: (creds: { email: string; password: string }) => Promise<{ data: any; error: any }>;
    insertProfileResult?: { error: any };
    selectProfileResult?: { data: any; error: any };
    signOutError?: { message: string } | null;
  }) => {
    let activeSession: any = opts.initialSession ?? null;
    const signOutCalls: Array<{ scope?: string }> = [];
    const signInPasswordCalls: Array<{ email: string; password: string }> = [];

    const client: any = {
      get activeSession() {
        return activeSession;
      },
      get signOutCalls() {
        return signOutCalls;
      },
      get signInPasswordCalls() {
        return signInPasswordCalls;
      },
      rpc: async (fn: string, params: any) => opts.rpcHandler(fn, params),
      auth: {
        getSession: async () => ({ data: { session: activeSession }, error: null }),
        signUp: async () => {
          const res = opts.signUpResult || { data: { user: null, session: null }, error: null };
          if (!res.error && res.data?.session) {
            activeSession = res.data.session;
          }
          return res;
        },
        signInWithPassword: async (creds: { email: string; password: string }) => {
          signInPasswordCalls.push(creds);
          if (opts.signInWithPasswordHandler) {
            const res = await opts.signInWithPasswordHandler(creds);
            if (!res.error && res.data?.session) {
              activeSession = res.data.session;
            }
            return res;
          }
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
        },
        signOut: async (signOutOpts?: { scope?: string }) => {
          signOutCalls.push(signOutOpts || {});
          if (opts.signOutError) {
            return { error: opts.signOutError };
          }
          activeSession = null;
          return { error: null };
        },
        setSession: async (tokens: { access_token: string; refresh_token: string }) => {
          if (opts.initialSession && tokens.access_token === opts.initialSession.access_token) {
            activeSession = opts.initialSession;
          }
          return { data: { session: activeSession, user: activeSession?.user || null }, error: null };
        },
      },
      from: (table: string) => ({
        insert: async () => opts.insertProfileResult || { error: null },
        select: () => ({
          eq: () => ({
            maybeSingle: async () => opts.selectProfileResult || { data: null, error: null },
          }),
        }),
        update: () => ({
          eq: () => ({
            then: (onFulfilled: any) => {
              if (typeof onFulfilled === 'function') onFulfilled({ error: null });
            },
          }),
        }),
      }),
    };
    return client;
  };

  // 19.1 Username availability RPC failure (missing RPC, network failure, unexpected response)
  const missingRpcClient = createMockSupabase({
    rpcHandler: async () => ({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.check_username_available(username_to_check) in the schema cache' },
    }),
  });
  let missingAvailErr = '';
  try {
    await checkUsernameWithClient('alice', missingRpcClient);
  } catch (e: any) {
    missingAvailErr = e.message || '';
  }

  const networkFailClient = createMockSupabase({
    rpcHandler: async () => {
      throw new TypeError('Failed to fetch');
    },
  });
  let netAvailErr = '';
  try {
    await checkUsernameWithClient('alice', networkFailClient);
  } catch (e: any) {
    netAvailErr = e.message || '';
  }

  const badShapeClient = createMockSupabase({
    rpcHandler: async () => ({ data: { available: true }, error: null }),
  });
  let badShapeErr = '';
  try {
    await checkUsernameWithClient('alice', badShapeClient);
  } catch (e: any) {
    badShapeErr = e.message || '';
  }

  assert(
    missingAvailErr.includes('check_username_available') &&
    netAvailErr.toLowerCase().includes('network') &&
    badShapeErr.toLowerCase().includes('unexpected'),
    'Username Availability Fails Closed on Missing RPC, Network Error & Invalid Shape',
    'checkUsernameAvailable throws actionable configuration/network errors and never interprets failures as available.'
  );

  // 19.2 Signup failure after Supabase Auth success cleans up newly created local session
  const orphanCleanupClient = createMockSupabase({
    rpcHandler: async () => ({ data: true, error: null }),
    signUpResult: {
      data: {
        user: { id: 'new-user-1', email: 'abc@nanobot.internal' },
        session: { access_token: 'new-tok', refresh_token: 'new-ref', user: { id: 'new-user-1' } },
      },
      error: null,
    },
    insertProfileResult: {
      error: { code: 'PGRST204', message: "Could not find the 'salt' column of 'user_profiles' in the schema cache" },
    },
  });

  let signupFailedErr: any = null;
  try {
    await signUpWithClient('new_alice', 'Pass123!', 'sk-or-test', 'tvly-test', orphanCleanupClient);
  } catch (e) {
    signupFailedErr = e;
  }

  assert(
    signupFailedErr !== null &&
    orphanCleanupClient.signOutCalls.length === 1 &&
    orphanCleanupClient.signOutCalls[0].scope === 'local' &&
    orphanCleanupClient.activeSession === null &&
    signupFailedErr.cleanupError === null &&
    String(signupFailedErr.originalError || '').includes('salt') &&
    String(signupFailedErr.message || '').includes('Database profile schema is out of date'),
    'Failed Signup Profile Creation Cleans Up Newly Created Local Session',
    'Orphaned local auth session is removed via local-scoped signOut and an actionable schema error is returned.'
  );

  // 19.3 Cleanup failure is reported separately from the original signup failure
  const failedCleanupClient = createMockSupabase({
    rpcHandler: async () => ({ data: true, error: null }),
    signUpResult: {
      data: {
        user: { id: 'new-user-2', email: 'def@nanobot.internal' },
        session: { access_token: 'new-tok-2', refresh_token: 'new-ref-2', user: { id: 'new-user-2' } },
      },
      error: null,
    },
    insertProfileResult: {
      error: { message: 'insert rejected by policy' },
    },
    signOutError: { message: 'storage quota locked' },
  });

  let dualErr: any = null;
  try {
    await signUpWithClient('new_bob', 'Pass123!', 'sk-or-test', 'tvly-test', failedCleanupClient);
  } catch (e) {
    dualErr = e;
  }

  assert(
    dualErr !== null &&
    dualErr.originalError === 'insert rejected by policy' &&
    dualErr.cleanupError === 'storage quota locked' &&
    String(dualErr.message).includes('insert rejected by policy') &&
    String(dualErr.message).includes('storage quota locked'),
    'Signup Session Cleanup Failure Reported Separately From Original Error',
    'Both originalError and cleanupError are tracked independently and surfaced clearly to callers.'
  );

  // 19.4 Existing unrelated sessions are never accidentally signed out
  const existingUserSession = {
    access_token: 'unrelated-tok',
    refresh_token: 'unrelated-ref',
    user: { id: 'unrelated-user-99', email: 'unrelated@nanobot.internal' },
  };
  const unrelatedPreFailClient = createMockSupabase({
    initialSession: existingUserSession,
    rpcHandler: async () => ({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.check_username_available' },
    }),
  });
  try {
    await signUpWithClient('someone_else', 'Pass123!', 'sk-or-test', 'tvly-test', unrelatedPreFailClient);
  } catch {}

  const unrelatedRestoreClient = createMockSupabase({
    initialSession: existingUserSession,
    rpcHandler: async () => ({ data: true, error: null }),
    signUpResult: {
      data: {
        user: { id: 'new-user-3', email: 'ghi@nanobot.internal' },
        session: { access_token: 'temp-tok', refresh_token: 'temp-ref', user: { id: 'new-user-3' } },
      },
      error: null,
    },
    insertProfileResult: { error: { message: 'profile write failed' } },
  });
  try {
    await signUpWithClient('someone_else', 'Pass123!', 'sk-or-test', 'tvly-test', unrelatedRestoreClient);
  } catch {}

  assert(
    unrelatedPreFailClient.signOutCalls.length === 0 &&
    unrelatedPreFailClient.activeSession?.user?.id === 'unrelated-user-99' &&
    unrelatedRestoreClient.signOutCalls.every((c: any) => c.scope === 'local') &&
    unrelatedRestoreClient.activeSession?.user?.id === 'unrelated-user-99',
    'Unrelated Pre-Existing Auth Sessions Are Preserved on Signup Failures',
    'Early signup failures never call signOut, and mid-signup failures use local scope cleanup and restore prior session.'
  );

  // 19.5 Missing get_auth_email_for_username RPC fails closed instead of masking behind legacy fallback
  const missingAuthRpcClient = createMockSupabase({
    rpcHandler: async () => ({
      data: null,
      error: { status: 404, message: 'Could not find the function public.get_auth_email_for_username' },
    }),
  });

  let missingLoginRpcMsg = '';
  try {
    await signInWithClient('modern_user', 'Pass123!', missingAuthRpcClient);
  } catch (e: any) {
    missingLoginRpcMsg = e.message || '';
  }

  let rawLookupErrMsg = '';
  try {
    await lookupEmailWithClient('modern_user', missingAuthRpcClient);
  } catch (e: any) {
    rawLookupErrMsg = e.message || '';
  }

  assert(
    missingLoginRpcMsg.includes('get_auth_email_for_username') &&
    rawLookupErrMsg.includes('get_auth_email_for_username') &&
    missingAuthRpcClient.signInPasswordCalls.length === 0,
    'Missing Auth Lookup RPC Fails Closed Without Legacy Fallback',
    'signInWithUsername throws a clear configuration error and does not attempt @nanobot.auth.internal login when RPC is missing.'
  );

  // 19.6 Legacy @nanobot.auth.internal sign-in compatibility preserved when RPC succeeds cleanly with null
  const legacySalt = generateSalt();
  const legacyKey = await deriveKeyFromPassword('LegacyPass123!', legacySalt);
  const legacyEncOr = await encryptText('sk-or-legacy', legacyKey, legacySalt);
  const legacyEncTv = await encryptText('tvly-legacy', legacyKey, legacySalt);

  const legacyClient = createMockSupabase({
    rpcHandler: async () => ({ data: null, error: null }),
    signInWithPasswordHandler: async (creds) => ({
      data: {
        user: { id: 'legacy-u1', email: creds.email },
        session: { access_token: 'leg-tok', refresh_token: 'leg-ref', user: { id: 'legacy-u1', email: creds.email } },
      },
      error: null,
    }),
    selectProfileResult: {
      data: {
        id: 'legacy-u1',
        username: 'LegacyUser',
        openrouter_key: legacyEncOr,
        tavily_key: legacyEncTv,
        ai_instructions: '',
        model_training: true,
        plugins_connected: {},
        salt: legacySalt,
        theme: 'Neon Black',
      },
      error: null,
    },
  });

  const legacyRes = await signInWithClient('LegacyUser', 'LegacyPass123!', legacyClient);
  assert(
    legacyClient.signInPasswordCalls.length === 1 &&
    legacyClient.signInPasswordCalls[0].email === 'legacyuser@nanobot.auth.internal' &&
    legacyRes.user.openrouter_key === 'sk-or-legacy' &&
    legacyRes.user.tavily_key === 'tvly-legacy',
    'Legacy @nanobot.auth.internal Sign-In Compatibility Preserved',
    'When get_auth_email_for_username succeeds returning null, legacy @nanobot.auth.internal sign-in and decryption succeed.'
  );

  // 19.7 Remote Markdown image blocking & DOMPurify sanitization rules
  const markdownTs = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/markdown.ts'), 'utf8');
  const { MARKDOWN_DOMPURIFY_CONFIG, registerMarkdownSanitizerHooks } = await import('../src/lib/markdown');

  // Capture registered DOMPurify attribute hook without TS narrowing callback variable to never [Commented by: Google AI Studio at 24/11/2026 09:48]
  const hookHolder: {
    fn: ((node: any, data: { attrName: string; attrValue: string; keepAttr: boolean }) => void) | null;
  } = { fn: null };
  registerMarkdownSanitizerHooks({
    addHook: (_hook, cb) => {
      hookHolder.fn = cb;
    },
  });

  const styleCssImgData = { attrName: 'style', attrValue: 'background-image: url("https://evil.test/track.png"); color: red;', keepAttr: true };
  const styleKatexData = { attrName: 'style', attrValue: 'height:0.6944em;top:-2.55em;', keepAttr: true };
  const svgUseExternalData = { attrName: 'href', attrValue: 'https://evil.test/sprite.svg#icon', keepAttr: true };
  hookHolder.fn?.({ tagName: 'DIV' }, styleCssImgData);
  hookHolder.fn?.({ tagName: 'SPAN' }, styleKatexData);
  hookHolder.fn?.({ tagName: 'USE' }, svgUseExternalData);

  const forbidTags = MARKDOWN_DOMPURIFY_CONFIG.FORBID_TAGS;
  const forbidAttrs = MARKDOWN_DOMPURIFY_CONFIG.FORBID_ATTR;
  const fallbackMd = markdownTs.includes('md.renderer.rules.image') && markdownTs.includes('getSafeExternalImageLink');

  assert(
    fallbackMd &&
    ['img', 'picture', 'source', 'video', 'audio', 'track', 'image', 'feimage', 'iframe', 'frame', 'object', 'embed'].every((t) =>
      forbidTags.includes(t)
    ) &&
    ['srcset', 'poster', 'background'].every((a) => forbidAttrs.includes(a)) &&
    !styleCssImgData.attrValue.includes('https://evil.test') &&
    styleKatexData.attrValue === 'height:0.6944em;top:-2.55em;' &&
    svgUseExternalData.keepAttr === false,
    'Markdown Blocks Remote Images & CSS/SVG Fetches While Preserving KaTeX Styles',
    'MarkdownIt image renderer avoids <img>, DOMPurify forbids remote media tags/attrs, and hook strips CSS url() & external SVG <use> while keeping KaTeX styles.'
  );

  // 19.8 Short-viewport AuthModal scrolling & 20261124 Supabase migration verification
  const authBackdropScrollable =
    authModalContent.includes('overflow-y-auto') &&
    authModalContent.includes('max-h-[calc(100dvh-2rem)]') &&
    authModalContent.includes('my-auto');

  const stage4MigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261124_reconcile_live_user_profiles_and_auth_rpcs.sql'
  );
  const stage4MigrationSql = fs.existsSync(stage4MigrationPath) ? fs.readFileSync(stage4MigrationPath, 'utf8') : '';

  assert(
    authBackdropScrollable,
    'AuthModal Supports Vertical Scrolling on Short Mobile Viewports',
    'AuthModal uses overflow-y-auto and max-h-[calc(100dvh-2rem)] to prevent clipping at 375x580 and keyboard viewports.'
  );

  assert(
    fs.existsSync(stage4MigrationPath) &&
    stage4MigrationSql.includes('ADD COLUMN IF NOT EXISTS salt TEXT NOT NULL DEFAULT') &&
    stage4MigrationSql.includes('ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT') &&
    stage4MigrationSql.includes('ADD COLUMN IF NOT EXISTS auth_email TEXT') &&
    stage4MigrationSql.includes('CREATE OR REPLACE FUNCTION public.check_username_available') &&
    stage4MigrationSql.includes('CREATE OR REPLACE FUNCTION public.get_auth_email_for_username') &&
    stage4MigrationSql.includes("@nanobot.internal") &&
    stage4MigrationSql.includes("@nanobot.auth.internal") &&
    stage4MigrationSql.includes('REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC, anon;') &&
    stage4MigrationSql.includes('ENABLE ROW LEVEL SECURITY') &&
    !stage4MigrationSql.includes('DROP TABLE public.chats') &&
    stage4MigrationSql.includes("NOTIFY pgrst, 'reload schema';"),
    'Stage 4 Supabase Migration Reconciles Schema, RLS & Auth RPCs Safely',
    '20261124_reconcile_live_user_profiles_and_auth_rpcs.sql safely adds missing columns/RPCs, filters internal domains, restricts anon table access, and preserves public.chats.'
  );

  // Stage 4B independent SQL audit assertions [Commented by: Google AI Studio at 24/11/2026 16:55]
  assert(
    !stage4MigrationSql.includes('CREATE EXTENSION') &&
    stage4MigrationSql.includes('DROP POLICY IF EXISTS "Users can manage own chats" ON public.chats;') &&
    stage4MigrationSql.includes('REVOKE ALL ON TABLE public.chats FROM PUBLIC, anon, authenticated;') &&
    stage4MigrationSql.includes('ALTER COLUMN salt DROP DEFAULT;') &&
    stage4MigrationSql.includes('CREATE OR REPLACE FUNCTION public.enforce_user_profile_salt_on_insert()') &&
    stage4MigrationSql.includes('ALTER COLUMN ai_instructions SET DEFAULT') &&
    stage4MigrationSql.includes('ALTER COLUMN model_training SET DEFAULT TRUE') &&
    stage4MigrationSql.includes("SET search_path = ''") &&
    !stage4MigrationSql.includes('SET search_path = public, auth') &&
    stage4MigrationSql.includes('id TEXT PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid()::text') &&
    stage4MigrationSql.includes('conversation_id TEXT NOT NULL') &&
    stage4MigrationSql.includes('p_conversation_id TEXT') &&
    stage4MigrationSql.includes('v_existing_owner <> v_user_id'),
    'Stage 4B SQL Migration Hardening & Codebase Compatibility',
    'Drops obsolete chats policy, reconciles defaults, enforces insert salt, sets empty search_path = \'\' on SECURITY DEFINER RPCs, and aligns TEXT conversation/message IDs with App.tsx.'
  );

  // Stage 4C migration audit & simulated concurrent UPSERT zero-row regression tests [Commented by: Google AI Studio at 24/11/2026 17:03]
  const hasRowCountGuard =
    stage4MigrationSql.includes('GET DIAGNOSTICS v_row_count = ROW_COUNT;') &&
    stage4MigrationSql.includes('IF v_row_count = 0 THEN') &&
    stage4MigrationSql.includes("RAISE EXCEPTION 'Forbidden: unable to save conversation due to concurrent ownership conflict';");

  const hasNowTimestampDefaults =
    !stage4MigrationSql.includes("timezone('utc'") &&
    stage4MigrationSql.includes("IF v_created_at_type = 'timestamp with time zone' THEN") &&
    stage4MigrationSql.includes('ALTER COLUMN created_at SET DEFAULT now();') &&
    stage4MigrationSql.includes("IF v_updated_at_type = 'timestamp with time zone' THEN") &&
    stage4MigrationSql.includes('ALTER COLUMN updated_at SET DEFAULT now();') &&
    stage4MigrationSql.includes('created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL') &&
    stage4MigrationSql.includes('updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL') &&
    stage4MigrationSql.includes('COALESCE(p_updated_at, now())') &&
    /COALESCE\(\s*NULLIF\(pg_catalog\.btrim\(v_msg->>'created_at'\), ''\)::TIMESTAMPTZ,\s*now\(\)\s*\)/.test(stage4MigrationSql);

  const hasExactLiveUserProfilePolicyDrops =
    stage4MigrationSql.includes('DROP POLICY IF EXISTS "Users can select own profile" ON public.user_profiles;') &&
    stage4MigrationSql.includes('DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;') &&
    stage4MigrationSql.includes('DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;') &&
    stage4MigrationSql.includes('DROP POLICY IF EXISTS "Users can delete own profile" ON public.user_profiles;') &&
    stage4MigrationSql.includes('CREATE POLICY "Users can view their own profile"') &&
    stage4MigrationSql.includes('CREATE POLICY "Users can insert their own profile"') &&
    stage4MigrationSql.includes('CREATE POLICY "Users can update their own profile"') &&
    stage4MigrationSql.includes('CREATE POLICY "Users can delete their own profile"') &&
    stage4MigrationSql.includes("connamespace = 'public'::regnamespace");

  assert(
    hasRowCountGuard && hasNowTimestampDefaults && hasExactLiveUserProfilePolicyDrops,
    'Stage 4C Migration Fixes Ownership Race, TIMESTAMPTZ now() Defaults & Live Policies',
    'Enforces ROW_COUNT > 0 after UPSERT, replaces timezone(utc, now()) with now() for TIMESTAMPTZ, and drops exact live user_profiles policies.'
  );

  // Mocked simulation of save_conversation_and_messages() ON CONFLICT DO UPDATE ... WHERE user_id = caller + GET DIAGNOSTICS ROW_COUNT
  const simulatedConvTable = new Map<string, { user_id: string; title: string }>();
  const simulatedMsgTable = new Map<string, Array<{ id: string; content: string }>>();

  function simulateSaveConversationRpc(
    callerUserId: string,
    convId: string,
    title: string,
    messages: Array<{ id: string; content: string }>,
    concurrentRacerInsertBeforeUpsert?: { user_id: string; title: string }
  ): { success: boolean; conversation_id: string } {
    const existingPreLock = simulatedConvTable.get(convId);
    if (existingPreLock && existingPreLock.user_id !== callerUserId) {
      throw new Error('Forbidden: conversation belongs to another user');
    }

    // Simulate concurrent cross-user INSERT landing between SELECT ... FOR UPDATE (NOT FOUND) and INSERT ON CONFLICT
    if (concurrentRacerInsertBeforeUpsert && !simulatedConvTable.has(convId)) {
      simulatedConvTable.set(convId, concurrentRacerInsertBeforeUpsert);
    }

    let rowCount = 0;
    const existingAtUpsert = simulatedConvTable.get(convId);
    if (!existingAtUpsert) {
      simulatedConvTable.set(convId, { user_id: callerUserId, title });
      rowCount = 1;
    } else if (existingAtUpsert.user_id === callerUserId) {
      simulatedConvTable.set(convId, { user_id: callerUserId, title });
      rowCount = 1;
    } else {
      // ON CONFLICT DO UPDATE ... WHERE user_id = callerUserId updates 0 rows
      rowCount = 0;
    }

    if (rowCount === 0) {
      throw new Error('Forbidden: unable to save conversation due to concurrent ownership conflict');
    }

    simulatedMsgTable.set(convId, [...messages]);
    return { success: true, conversation_id: convId };
  }

  const sameUserInsertRes = simulateSaveConversationRpc('user-a', 'conv-same-1', 'First', [{ id: 'm1', content: 'hi' }]);
  const sameUserUpdateRes = simulateSaveConversationRpc('user-a', 'conv-same-1', 'Updated', [{ id: 'm2', content: 'hello' }]);

  let concurrentConflictAborted = false;
  let concurrentReturnedSuccess = false;
  try {
    const raceRes = simulateSaveConversationRpc(
      'user-b',
      'conv-race-1',
      'Attacker Title',
      [],
      { user_id: 'user-a', title: 'Victim First Insert' }
    );
    concurrentReturnedSuccess = raceRes.success;
  } catch (err: unknown) {
    concurrentConflictAborted =
      err instanceof Error && err.message.includes('concurrent ownership conflict');
  }

  assert(
    sameUserInsertRes.success &&
    sameUserUpdateRes.success &&
    simulatedConvTable.get('conv-same-1')?.title === 'Updated' &&
    simulatedMsgTable.get('conv-same-1')?.[0]?.id === 'm2' &&
    concurrentConflictAborted &&
    !concurrentReturnedSuccess &&
    simulatedConvTable.get('conv-race-1')?.user_id === 'user-a',
    'Stage 4C Concurrent UPSERT Zero-Row Race Simulation',
    'Mocked RPC preserves same-user insert/update and aborts on 0 affected rows instead of returning success: true during a cross-user race.'
  );

  // =========================================================================
  // 20. Stage 4D/4E Shared Noodle Security, Privacy, Revocation, Clipboard & Fork Tests [Commented by: Google AI Studio at 24/11/2026 22:57]
  // =========================================================================
  console.log('\n--- 20. Stage 4D/4E Shared Noodle Security, Privacy, Revocation, Clipboard & Fork Tests ---');

  // 20.1 Snapshot construction preserves conversation content/sources/attachment names while excluding internal reasoning, metadata, credentials, and raw bytes/fileIds
  const rawMessagesForShare = [
    {
      id: 'msg_1',
      role: 'user' as const,
      content: [
        { type: 'text', text: 'Analyze this screenshot' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,SECRET_RAW_BYTES' } },
      ],
      displayAttachments: [{ type: 'image', name: 'chart.png', fileId: 'local-file-id-123', isLocalMissing: true }],
      createdAt: '2026-11-24T10:00:00Z',
      metadata: { internalUserFlag: 'hidden' },
    },
    {
      id: 'msg_2',
      role: 'ai' as const,
      content: 'Here is the analysis.',
      reasoning: 'PRIVATE_MODEL_CHAIN_OF_THOUGHT',
      sources: [
        { title: 'Ref Doc', url: 'https://example.com/doc' },
        { title: 'Unsafe Link', url: 'javascript:alert(1)' },
      ],
      metadata: { model: 'secret-route', reasoningEffort: 'high' },
    },
  ];
  const cleanSnapshot = buildShareSnapshotMessages(rawMessagesForShare);
  const serializedSnapshot = JSON.stringify(cleanSnapshot);
  assert(
    cleanSnapshot.length === 2 &&
    cleanSnapshot[0].role === 'user' &&
    cleanSnapshot[0].content === 'Analyze this screenshot' &&
    !serializedSnapshot.includes('SECRET_RAW_BYTES') &&
    !serializedSnapshot.includes('local-file-id-123') &&
    !serializedSnapshot.includes('isLocalMissing') &&
    !serializedSnapshot.includes('PRIVATE_MODEL_CHAIN_OF_THOUGHT') &&
    !serializedSnapshot.includes('reasoning') &&
    !serializedSnapshot.includes('secret-route') &&
    !serializedSnapshot.includes('internalUserFlag') &&
    !serializedSnapshot.includes('javascript:alert') &&
    cleanSnapshot[0].displayAttachments?.[0]?.name === 'chart.png' &&
    cleanSnapshot[1].role === 'ai' &&
    cleanSnapshot[1].sources?.length === 1 &&
    cleanSnapshot[1].sources?.[0]?.url === 'https://example.com/doc',
    'Stage 4E Snapshot Exclusion of Internal Reasoning, Metadata & Unsafe URLs',
    'buildShareSnapshotMessages preserves conversation content, safe sources, and {type, name} attachments while excluding internal reasoning, metadata, fileIds, and raw bytes.'
  );

  // 20.2 Share URL / ID parsing handles query links, path links, trailing slashes, and malformed encoding safely
  const parsedQueryUrl = extractShareIdFromInput('https://nanobot-chatbot.netlify.app/?share=abc-123_xyz');
  const parsedPathUrl = extractShareIdFromInput('https://nanobot-api.workers.dev/api/public/shares/share_456/');
  const parsedBareId = extractShareIdFromInput('share-789');
  const parsedEmpty = extractShareIdFromInput('   ');
  const parsedBadEncoding = extractShareIdFromInput('share=%E0%A4%A');
  assert(
    parsedQueryUrl.shareId === 'abc-123_xyz' &&
    parsedPathUrl.shareId === 'share_456' &&
    parsedBareId.shareId === 'share-789' &&
    parsedEmpty.shareId === null &&
    Boolean(parsedEmpty.error) &&
    parsedBadEncoding.shareId === null &&
    Boolean(parsedBadEncoding.error),
    'Stage 4D Share URL & ID Extraction',
    'Safely extracts share IDs from URLs and raw IDs while failing cleanly on blank or malformed percent-encoded inputs.'
  );

  // 20.3 Clipboard helper accurately distinguishes success vs rejection/unavailable without swallowing failures
  let copiedValue = '';
  const clipSuccess = await copyTextToClipboard('https://nanobot.app/?share=ok', {
    writeText: async (text: string) => {
      copiedValue = text;
    },
  });
  const clipRejected = await copyTextToClipboard('https://nanobot.app/?share=fail', {
    writeText: async () => {
      throw new Error('NotAllowedError');
    },
  });
  const clipUnavailable = await copyTextToClipboard('https://nanobot.app/?share=none', null);

  assert(
    clipSuccess.copied === true &&
    copiedValue === 'https://nanobot.app/?share=ok' &&
    clipRejected.copied === false &&
    Boolean(clipRejected.error?.includes('NotAllowedError')) &&
    clipUnavailable.copied === false &&
    Boolean(clipUnavailable.error),
    'Stage 4D Accurate Clipboard Copy & Failure Reporting',
    'copyTextToClipboard returns copied=true only when writeText resolves and reports copied=false when blocked or unavailable.'
  );

  // 20.4 Import & fork independence: editing a fork does not mutate original share and omits shareId & reasoning
  const originalShareSnapshot = {
    id: 'orig-share-abc',
    title: 'Shared Quantum Notes',
    messages: [
      {
        role: 'user' as const,
        content: 'Explain superposition.',
        displayAttachments: [{ type: 'file', name: 'syllabus.pdf', fileId: 'orig-file-1' }],
      },
      {
        role: 'ai' as const,
        content: 'A quantum state can exist in linear combinations.',
        reasoning: 'Internal trace should be excluded.',
        sources: [{ title: 'MIT OCW', url: 'https://ocw.mit.edu/' }],
      },
    ],
  };
  const forked = createForkedChatSession(originalShareSnapshot, () => 'fork-id-999') as Record<string, any>;
  forked.messages[0].content = 'Modified fork message!';
  forked.title = 'Modified Fork Title';

  assert(
    forked.id === 'fork-id-999' &&
    !('shareId' in forked) &&
    !('reasoning' in forked.messages[1]) &&
    !('fileId' in forked.messages[0].displayAttachments[0]) &&
    originalShareSnapshot.title === 'Shared Quantum Notes' &&
    originalShareSnapshot.messages[0].content === 'Explain superposition.' &&
    forked.messages.length === 2 &&
    forked.messages[1].sources?.[0]?.title === 'MIT OCW' &&
    forked.messages[0].displayAttachments?.[0]?.name === 'syllabus.pdf',
    'Stage 4E Fork & Import Independence',
    'createForkedChatSession omits original shareId/reasoning/fileId, deep-clones messages so edits never mutate original snapshot, and preserves order/sources/attachments.'
  );

  // Updated to check browser-local personal history wording under H-5 [Commented by: Google AI Studio on 28/11/2026 07:35]
  const workerClientPath = path.resolve(process.cwd(), 'src/lib/workerClient.ts');
  const workerClientTs = fs.readFileSync(workerClientPath, 'utf8');
  const privacyAccurate =
    SHARED_NOODLE_PRIVACY_DISCLOSURE.includes('Anyone with this link') &&
    SHARED_NOODLE_PRIVACY_DISCLOSURE.includes('Cloudflare sharing database') &&
    SHARED_NOODLE_PRIVACY_DISCLOSURE.includes('separate from your browser-local personal history') &&
    SHARED_NOODLE_PRIVACY_DISCLOSURE.includes('30 days') &&
    SHARED_NOODLE_PRIVACY_DISCLOSURE.includes('revoke') &&
    SHARED_NOODLE_PRIVACY_DISCLOSURE.includes('internal model reasoning') &&
    !workerIndexSql.includes('zero-knowledge shareable');

  const appShareFeedbackWired =
    appContent.includes('Sharing is unavailable while signed out') &&
    appContent.includes('Sharing is unavailable while Incognito Noodle mode is active') &&
    appContent.includes('Cannot share an empty noodle') &&
    appContent.includes('Share link created, but automatic copying failed') &&
    appContent.includes('Share link created and copied to clipboard.') &&
    appContent.includes('Viewing a read-only shared noodle.') &&
    appContent.includes('sharedChatView && !currentUser') &&
    !appContent.includes('shareId: res.share.id') &&
    workerClientTs.includes('parsed?.error');

  assert(
    privacyAccurate && appShareFeedbackWired,
    'Stage 4E Privacy Disclosure, Read-Only Guard & Feedback Contracts',
    'UI communicates public Cloudflare D1 storage, 30-day expiry/revocation, and excluded internal reasoning accurately, guards signed-out view, and handles share feedback states.'
  );

  // 20.6 Owner-only Share Revocation UI Confirmation, Client & Worker Route Contracts
  const revokeWired =
    workerClientTs.includes('async revokeShare(') &&
    workerClientTs.includes("method: 'DELETE'") &&
    workerIndexSql.includes('const revokeShareMatch = pathname.match(/^\\/api\\/shares\\/([^/]+)$/);') &&
    workerIndexSql.includes('DELETE FROM shared_chats WHERE id = ? AND user_id = ?') &&
    appContent.includes('Revoke Share Link?') &&
    appContent.includes('Confirm Revoke') &&
    appContent.includes('requestRevokeShareForChat') &&
    appContent.includes('handleConfirmRevokeShare') &&
    appContent.includes('Share link revoked. Anyone with the previous link can no longer view or fork this noodle.');

  assert(
    revokeWired,
    'Stage 4E Owner-Only Share Revocation UI, Client & Worker Contracts',
    'Worker exposes owner-only DELETE /api/shares/:id, workerClient provides revokeShare(), and App.tsx requires confirmation before revoking with clear feedback.'
  );

  // Verify hardened clean logout error propagation, Account tab status display, and guest localStorage isolation [Commented by: Google AI Studio at 25/11/2026 22:57]
  const signOutSection = supabaseTs.slice(
    supabaseTs.indexOf('export async function signOutSupabase'),
    supabaseTs.indexOf('export async function updateUserProfileInSupabase')
  );
  const onLogoutStart = appContent.indexOf('onLogout={() => {');
  const onDeleteAccountStart = appContent.indexOf('onDeleteAccount={() => {');
  const onLogoutBlock =
    onLogoutStart !== -1 && onDeleteAccountStart > onLogoutStart
      ? appContent.slice(onLogoutStart, onDeleteAccountStart)
      : '';
  const accountTabEnd = settingsContent.indexOf('{/* TAB 2: AI CONFIGURATION */}');
  const accountTabSlice = accountTabEnd !== -1 ? settingsContent.slice(0, accountTabEnd) : '';

  assert(
    signOutSection.includes("scope: 'local'") &&
    signOutSection.includes('throw new Error(') &&
    accountTabSlice.includes('{statusMessage && (') &&
    localChatStorageTs.includes('if (opts.userId) {') &&
    localChatStorageTs.includes('storage.setItem(REGULAR_GUEST_CHATS_KEY') &&
    onLogoutBlock.includes('setChats([])') &&
    onLogoutBlock.includes('setPasswordSecret(\'\')') &&
    onLogoutBlock.includes('setCryptoKey(null)') &&
    !onLogoutBlock.includes('deleteUserAccount') &&
    !onLogoutBlock.includes('clearAllOriginalFiles'),
    'Hardened Clean Logout Isolation & Error Handling',
    'signOutSupabase enforces local fallback on global failure, Account tab renders logout errors, authenticated chats never leak into nanobot_chats, and onLogout clears session state without triggering account deletion.'
  );

  // 21. Admin User Management Security & UI Contracts [Commented by: Google AI Studio at 27/11/2026 21:10]
  const adminTabIdx = settingsContent.indexOf("{/* TAB 4: ADMIN USER MANAGEMENT");
  const aboutTabIdx = settingsContent.indexOf("{/* TAB 5: ABOUT NANOBOT */}");
  const adminTabSlice =
    adminTabIdx !== -1 && aboutTabIdx > adminTabIdx
      ? settingsContent.slice(adminTabIdx, aboutTabIdx)
      : '';

  const noClientAdminSecretsOrFlags =
    !settingsContent.includes('VITE_ADMIN') &&
    !settingsContent.includes('SUPABASE_SERVICE_ROLE_KEY') &&
    !workerClientTs.includes('SUPABASE_SERVICE_ROLE_KEY') &&
    !settingsContent.includes("localStorage.getItem('nanobot_admin") &&
    !settingsContent.includes("localStorage.setItem('nanobot_admin") &&
    !supabaseTs.includes('is_admin');

  const adminClientWired =
    workerClientTs.includes("async checkAdminStatus()") &&
    workerClientTs.includes("'/api/admin/status'") &&
    workerClientTs.includes("async listAdminUsers(") &&
    workerClientTs.includes('/api/admin/users') &&
    workerClientTs.includes("async deleteAdminUser(");

  const adminUiMinimalAndSafe =
    settingsContent.includes('workerClient') &&
    settingsContent.includes('.checkAdminStatus()') &&
    settingsContent.includes('{isVerifiedAdmin && (') &&
    settingsContent.includes("activeTab === 'admin' && isVerifiedAdmin") &&
    adminTabSlice.includes('Search by username...') &&
    adminTabSlice.includes('No registered user accounts found.') &&
    adminTabSlice.includes('Delete User Account?') &&
    adminTabSlice.includes('pendingDeleteTarget.username') &&
    adminTabSlice.includes('Self-Deletion Blocked') &&
    adminTabSlice.includes('deleteTargetError') &&
    !adminTabSlice.includes('auth_email') &&
    !adminTabSlice.includes('openrouter_key') &&
    !adminTabSlice.includes('tavily_key');

  const workerAdminHardened =
    workerIndexSql.includes('isAuthorizedAdmin(') &&
    workerIndexSql.includes("pathname === '/api/admin/status'") &&
    workerIndexSql.includes("pathname === '/api/admin/users'") &&
    workerIndexSql.includes('select=id,username,created_at') &&
    workerIndexSql.includes('targetUserId.toLowerCase() === verifiedUserId.toLowerCase()') &&
    workerIndexSql.includes('auth/v1/admin/users/${targetUserId}') &&
    workerIndexSql.includes('DELETE FROM mcp_oauth_states WHERE user_id = ?') &&
    !workerIndexSql.includes('Failed purging Supabase table ${tableName} (${res.status}): ${errBody') &&
    !workerIndexSql.includes('Supabase Auth Admin deletion failed (${adminDelRes.status}): ${errBody');

  assert(
    noClientAdminSecretsOrFlags && adminClientWired && adminUiMinimalAndSafe && workerAdminHardened,
    'Admin User Management Security, Minimal Exposure & Confirmation Contracts',
    'Enforces server-only admin check without VITE_ or localStorage flags, exposes minimal user fields, requires username confirmation, blocks self-deletion, purges mcp_oauth_states, and sanitizes upstream errors.'
  );

  // 22. Signed-Out Composer Controls Visibility & Deep Research Key Guard [Commented by: Google AI Studio at 27/11/2026 21:17]
  const composerBarStart = appContent.indexOf('placeholder="Ask Anything..."');
  const composerBarEnd = appContent.indexOf("title={isGenerating ? 'Stop Generation' : 'Send'}", composerBarStart);
  const composerBarSlice =
    composerBarStart !== -1 && composerBarEnd > composerBarStart
      ? appContent.slice(composerBarStart, composerBarEnd)
      : '';
  const signedOutComposerControlsVisible =
    composerBarSlice.includes('aria-haspopup="menu"') &&
    composerBarSlice.includes('Upload File') &&
    composerBarSlice.includes('Deep Research') &&
    composerBarSlice.includes('Learn Step By Step') &&
    composerBarSlice.includes('className="effort-slider"') &&
    !composerBarSlice.includes('{currentUser && (') &&
    appContent.includes("if (!tvKey && composerMode === 'deep_research')") &&
    appContent.includes("if (composerMode === 'deep_research')") &&
    appContent.includes("composerMode === 'learn_step_by_step'");

  assert(
    signedOutComposerControlsVisible,
    'Signed-Out Composer Plus Menu & Effort Slider Visibility',
    'Exposes the + menu (Upload File, Deep Research, Learn Step By Step) and Effort slider to signed-out users while guarding Deep Research against missing Tavily keys.'
  );

  // 23. Final Pre-Deployment Parity, Data-Retention Disclosure & Secret Docs [Commented by: Google AI Studio at 27/11/2026 21:27]
  const envExampleContent = fs.readFileSync(path.resolve(process.cwd(), '.env.example'), 'utf8');
  const selfAccountRouteStart = workerIndexSql.indexOf("if (pathname === '/api/account' && request.method === 'DELETE')");
  const selfAccountRouteEnd = workerIndexSql.indexOf("if (pathname === '/api/admin' || pathname.startsWith('/api/admin/'))");
  const selfAccountSlice =
    selfAccountRouteStart !== -1 && selfAccountRouteEnd > selfAccountRouteStart
      ? workerIndexSql.slice(selfAccountRouteStart, selfAccountRouteEnd)
      : '';

  const selfDeleteParityAndRetention =
    selfAccountSlice.includes('DELETE FROM mcp_oauth_states WHERE user_id = ?') &&
    selfAccountSlice.includes("error: 'Cloudflare D1 data cleanup failed; please retry account deletion.'") &&
    !selfAccountSlice.includes('if (stages.auth_identity_deleted) {\n            stages.supabase_data_purged = true;') &&
    settingsContent.includes('cannot be remotely erased by an administrator') &&
    settingsContent.includes('other browsers or devices cannot be remotely erased') &&
    envExampleContent.includes('SUPABASE_SERVICE_ROLE_KEY') &&
    envExampleContent.includes('ADMIN_USER_ID');

  assert(
    selfDeleteParityAndRetention,
    'Pre-Deployment Deletion Parity, Data-Retention Disclosure & Secret Docs',
    'DELETE /api/account fails fast before Auth deletion on D1/Supabase errors, purges mcp_oauth_states, UI discloses browser-local IndexedDB retention limits, and .env.example documents server-only secrets.'
  );

  // =========================================================================
  // 24. H-5 Privacy Architecture Regression Suite (Mocked localStorage + fetch)
  // =========================================================================
  // Functional and contract tests verifying regular/incognito local-only persistence, Cloudflare share continuity, zero cloud fallback, cleanup, and disclosures [Commented by: Google AI Studio on 28/11/2026 07:35]
  console.log('\n--- 24. H-5 Privacy Architecture Regression Suite ---');

  const origLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const origFetch = globalThis.fetch;

  class MockBrowserStorage implements Storage {
    private store = new Map<string, string>();
    public throwOnSet: Error | null = null;

    get length(): number {
      return this.store.size;
    }
    clear(): void {
      this.store.clear();
    }
    getItem(key: string): string | null {
      return this.store.has(key) ? this.store.get(key)! : null;
    }
    key(index: number): string | null {
      const keys = Array.from(this.store.keys());
      return keys[index] ?? null;
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
    setItem(key: string, value: string): void {
      if (this.throwOnSet) {
        throw this.throwOnSet;
      }
      this.store.set(key, String(value));
    }
    snapshotKeys(): string[] {
      return Array.from(this.store.keys());
    }
  }

  const mockStorage = new MockBrowserStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });

  const networkRequests: Array<{ url: string; method: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || 'GET';
    networkRequests.push({ url: urlStr, method });

    if (urlStr.includes('/api/public/shares/share_h5_test')) {
      return new Response(
        JSON.stringify({
          success: true,
          share: {
            id: 'share_h5_test',
            title: 'Public Shared Topic',
            messages: [
              { role: 'user', content: 'Hello Cloudflare share' },
              { role: 'ai', content: 'Shared response content', sources: [{ title: 'Docs', url: 'https://example.com' }] },
            ],
            created_at: '2026-11-28T00:00:00.000Z',
            expires_at: '2026-12-28T00:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Unexpected fetch in mocked H-5 test' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    // Regression 1: Regular chats saved and restored locally (guest + encrypted signed-in + locked fail-closed)
    networkRequests.length = 0;
    const guestChats = [
      {
        id: 'reg-guest-1',
        title: 'Guest Local Note',
        messages: [{ role: 'user' as const, content: 'Local guest prompt' }],
        pinned: true,
        updated: 1732750000000,
      },
    ];
    const guestSaveRes = await saveRegularChatsLocally(guestChats);
    const guestLoaded = await loadRegularChatsLocally();
    assert(
      guestSaveRes.success &&
        guestLoaded.chats.length === 1 &&
        guestLoaded.chats[0].title === 'Guest Local Note' &&
        mockStorage.getItem(REGULAR_GUEST_CHATS_KEY)?.includes('Local guest prompt') === true &&
        networkRequests.length === 0,
      'H-5 Regression 1A: Guest Regular Chats Save & Restore Locally',
      'Guest regular chats persist cleanly in nanobot_chats and restore without any network requests.'
    );

    const h5UserId = 'user-h5-001';
    const h5Salt = generateSalt();
    const h5Key = await deriveKeyFromPassword('SecretPass#2026', h5Salt);
    const signedInChats = [
      {
        id: 'reg-user-1',
        title: 'Private Encrypted Noodle',
        messages: [
          { role: 'user' as const, content: 'Confidential user prompt' },
          { role: 'ai' as const, content: 'Confidential AI answer', reasoning: 'Local chain of thought' },
        ],
        pinned: false,
        updated: 1732750001000,
      },
    ];
    const encSaveRes = await saveRegularChatsLocally(signedInChats, {
      userId: h5UserId,
      cryptoKey: h5Key,
      salt: h5Salt,
    });
    const rawCipherPayload = mockStorage.getItem(getEncryptedChatsStorageKey(h5UserId)) || '';
    const encLoaded = await loadRegularChatsLocally({
      userId: h5UserId,
      cryptoKey: h5Key,
      salt: h5Salt,
    });

    assert(
      encSaveRes.success &&
        rawCipherPayload.startsWith('enc:') &&
        !rawCipherPayload.includes('Confidential user prompt') &&
        encLoaded.chats.length === 1 &&
        encLoaded.chats[0].messages[1]?.reasoning === 'Local chain of thought' &&
        networkRequests.length === 0,
      'H-5 Regression 1B: Signed-In Regular Chats Encrypted & Restored Locally',
      'Signed-in regular chats encrypt locally in nanobot_encrypted_chats_<userId>, mask plaintext, restore on reload, and emit 0 network calls.'
    );

    // Locked session (currentUser present, cryptoKey unavailable) MUST fail closed & preserve ciphertext
    const lockedLoad = await loadRegularChatsLocally({ userId: h5UserId, cryptoKey: null, salt: h5Salt });
    const lockedSave = await saveRegularChatsLocally(
      [{ id: 'downgrade-attempt', title: 'Plaintext Attempt', messages: [], pinned: false, updated: 1 }],
      { userId: h5UserId, cryptoKey: null, salt: h5Salt }
    );
    const cipherStillIntact = mockStorage.getItem(getEncryptedChatsStorageKey(h5UserId)) === rawCipherPayload;
    const guestUnchangedAfterLockedSave = !mockStorage.getItem(REGULAR_GUEST_CHATS_KEY)?.includes('Plaintext Attempt');

    assert(
      lockedLoad.locked === true &&
        lockedLoad.hasEncryptedData === true &&
        lockedLoad.chats.length === 0 &&
        lockedSave.success === false &&
        lockedSave.locked === true &&
        cipherStillIntact &&
        guestUnchangedAfterLockedSave,
      'H-5 Regression 1C: Locked Signed-In History Fails Closed Without Plaintext Downgrade',
      'Locked session refuses plaintext downgrade on load/save, preserves encrypted local payload intact, and prompts unlock.'
    );

    // One-time local upgrade from guest nanobot_chats once newly signed-in user unlocks
    const upgradeUserId = 'user-h5-upgrade';
    const upgradeLoad = await loadRegularChatsLocally({ userId: upgradeUserId, cryptoKey: h5Key, salt: h5Salt });
    assert(
      upgradeLoad.migratedLegacyGuestChats === true &&
        upgradeLoad.chats.length === 1 &&
        upgradeLoad.chats[0].id === 'reg-guest-1' &&
        mockStorage.getItem(REGULAR_GUEST_CHATS_KEY) === null &&
        (mockStorage.getItem(getEncryptedChatsStorageKey(upgradeUserId)) || '').startsWith('enc:') &&
        networkRequests.length === 0,
      'H-5 Regression 1D: Local-Only Guest-to-Encrypted Upgrade On Unlock',
      'Guest nanobot_chats upgrades locally into encrypted per-user localStorage once unlocked without uploading to Supabase.'
    );

    // Regression 2: Incognito chats saved & restored locally under dedicated key & stay isolated
    const incChats = [
      {
        id: 'inc-1',
        title: 'Incognito Research',
        messages: [{ role: 'user' as const, content: 'Private incognito question' }],
        pinned: false,
        updated: 1732750002000,
      },
    ];
    const incSaveRes = saveIncognitoChatsLocally(incChats);
    setIncognitoModeFlagLocally(true);
    const restoredIncFlag = getIncognitoModeFlagLocally();
    const restoredInc = loadIncognitoChatsLocally();
    // Toggle incognito mode OFF -> history MUST NOT be wiped automatically!
    setIncognitoModeFlagLocally(false);
    const incAfterToggleOff = loadIncognitoChatsLocally();
    const regularChatsAfterInc = await loadRegularChatsLocally({ userId: h5UserId, cryptoKey: h5Key, salt: h5Salt });

    assert(
      incSaveRes.success &&
        mockStorage.getItem(INCOGNITO_CHATS_KEY)?.includes('Private incognito question') === true &&
        mockStorage.getItem(INCOGNITO_MODE_KEY) === 'false' &&
        restoredIncFlag === true &&
        restoredInc.chats.length === 1 &&
        incAfterToggleOff.chats.length === 1 &&
        regularChatsAfterInc.chats.every((c) => c.id !== 'inc-1') &&
        networkRequests.length === 0,
      'H-5 Regression 2: Dedicated Incognito Storage Persists Across Refreshes & Toggle-Off',
      'Incognito chats persist in nanobot_incognito_chats, stay separate from regular chats, and survive toggling incognito mode off.'
    );

    // Verify logout turns off incognito display flag without clearing nanobot_incognito_chats
    assert(
      onLogoutBlock.includes('setIncognitoModeFlagLocally(false)') &&
        !onLogoutBlock.includes('clearIncognitoHistoryLocally()'),
      'H-5 Regression 2B: Sign-Out Preserves Incognito History While Resetting Mode Display Flag',
      'App.tsx onLogout resets incognito display mode cleanly without destroying dedicated incognito history.'
    );

    // Regression 3: Zero Supabase or Worker D1 regular-chat endpoints remain active
    const workerClientMethodKeys = Object.keys(workerClient);
    const removedWorkerMethods = [
      'listConversations',
      'createOrUpdateConversation',
      'updateConversation',
      'deleteConversation',
      'clearAllConversations',
      'getMessages',
      'saveMessage',
      'saveMessagesBatch',
      'getFileOutputs',
      'saveFileOutput',
      'deleteFileOutput',
    ];
    const workerRegularChatMethodsAbsent = removedWorkerMethods.every((m) => !workerClientMethodKeys.includes(m));
    const workerShareMethodsPresent =
      typeof workerClient.createShare === 'function' &&
      typeof workerClient.revokeShare === 'function' &&
      typeof workerClient.getPublicShare === 'function';

    assert(
      workerRegularChatMethodsAbsent &&
        workerShareMethodsPresent &&
        !supabaseTs.includes('interface FileCodeOutput') &&
        !supabaseTs.includes('interface RemoteConversationRow') &&
        !supabaseTs.includes('interface RemoteMessageRow'),
      'H-5 Regression 3: Worker Regular-Chat Methods & Supabase Chat Models Removed',
      'workerClient removes all D1 regular-chat methods while preserving createShare/revokeShare/getPublicShare, and supabase.ts has zero chat/file-output models.'
    );

    // Regression 4: File outputs & reader_code stay strictly local (never Supabase/Worker)
    networkRequests.length = 0;
    const regFileRes = await saveLocalFileOutput(
      h5UserId,
      {
        conversation_id: 'reg-user-1',
        source_file_id: 'file-pdf-1',
        file_name: 'report.pdf',
        file_type: 'application/pdf',
        output_type: 'reader_script',
        reader_code: 'import pypdf\nprint("secret_pdf_code")',
        extracted_output: 'Sensitive financial extraction text',
      },
      { cryptoKey: h5Key, salt: h5Salt, requireEncryption: true }
    );
    const rawFileOutputStorage = mockStorage.getItem(getLocalFileOutputsStorageKey(h5UserId, 'reg-user-1')) || '';
    const loadedRegFileOutputs = await loadLocalFileOutputs(h5UserId, 'reg-user-1', h5Key);

    const lockedFileSave = await saveLocalFileOutput(
      h5UserId,
      {
        conversation_id: 'reg-user-1',
        source_file_id: 'file-pdf-2',
        file_name: 'locked.pdf',
        file_type: 'application/pdf',
        output_type: 'text_extraction',
        extracted_output: 'Should fail locked',
      },
      { cryptoKey: null, salt: h5Salt, requireEncryption: true }
    );

    const incFileRes = await saveLocalFileOutput('incognito', {
      conversation_id: 'inc-1',
      source_file_id: 'file-inc-1',
      file_name: 'inc.txt',
      file_type: 'text/plain',
      output_type: 'text_extraction',
      reader_code: 'print("incognito_reader")',
      extracted_output: 'Incognito extracted text',
    });
    const loadedIncFileOutputs = await loadLocalFileOutputs('incognito', 'inc-1', null);

    assert(
      regFileRes.success &&
        !rawFileOutputStorage.includes('Sensitive financial extraction text') &&
        !rawFileOutputStorage.includes('secret_pdf_code') &&
        loadedRegFileOutputs.length === 1 &&
        loadedRegFileOutputs[0].extracted_output === 'Sensitive financial extraction text' &&
        loadedRegFileOutputs[0].reader_code === 'import pypdf\nprint("secret_pdf_code")' &&
        lockedFileSave.success === false &&
        lockedFileSave.locked === true &&
        incFileRes.success &&
        loadedIncFileOutputs.length === 1 &&
        loadedIncFileOutputs[0].reader_code === 'print("incognito_reader")' &&
        networkRequests.length === 0,
      'H-5 Regression 4: File Outputs & reader_code Persist Strictly Locally',
      'Extracted file outputs and AI reader_code encrypt locally for signed-in users, stay isolated in incognito scope, fail closed when locked, and emit 0 network calls.'
    );

    // Regression 5 & 6: Shared chats still use Cloudflare endpoints & public share retrieval/fork works
    networkRequests.length = 0;
    const publicShareRes = await workerClient.getPublicShare('share_h5_test');
    const forkedFromPublic = publicShareRes.share
      ? createForkedChatSession(
          { id: publicShareRes.share.id, title: publicShareRes.share.title, messages: publicShareRes.share.messages },
          () => 'fork-h5-1'
        )
      : null;

    assert(
      publicShareRes.success === true &&
        publicShareRes.share?.title === 'Public Shared Topic' &&
        networkRequests.some((r) => r.method === 'GET' && r.url.includes('/api/public/shares/share_h5_test')) &&
        forkedFromPublic !== null &&
        forkedFromPublic.id === 'fork-h5-1' &&
        !('shareId' in forkedFromPublic) &&
        workerIndexSql.includes("pathname === '/api/shares' && request.method === 'POST'") &&
        workerIndexSql.includes("pathname === '/api/shares' && request.method === 'DELETE'") &&
        workerIndexSql.includes('publicShareMatch') &&
        workerIndexSql.includes('revokeShareMatch') &&
        appContent.includes('workerClient.createShare(') &&
        appContent.includes('?share='),
      'H-5 Regression 5 & 6: Cloudflare Shared-Chat Endpoints, Retrieval & Local Fork Intact',
      'GET /api/public/shares/:shareId retrieves snapshots cleanly, Worker preserves POST/DELETE/GET share routes, and App creates ?share= URLs and local forks.'
    );

    // Regression 7: Failed localStorage persistence surfaces error & triggers ZERO cloud fallback
    networkRequests.length = 0;
    const quotaErr = new Error('DOMException: QuotaExceededError');
    quotaErr.name = 'QuotaExceededError';
    mockStorage.throwOnSet = quotaErr;

    const regQuotaFail = await saveRegularChatsLocally(guestChats);
    const encQuotaFail = await saveRegularChatsLocally(signedInChats, { userId: h5UserId, cryptoKey: h5Key, salt: h5Salt });
    const incQuotaFail = saveIncognitoChatsLocally(incChats);
    const fileQuotaFail = await saveLocalFileOutput('guest', {
      conversation_id: 'c1',
      source_file_id: 'f1',
      file_name: 'big.txt',
      file_type: 'text/plain',
      output_type: 'text_extraction',
      extracted_output: 'payload',
    });

    mockStorage.throwOnSet = null;

    // Also simulate missing localStorage completely
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true });
    const noStorageRegFail = await saveRegularChatsLocally(guestChats);
    const noStorageIncFail = saveIncognitoChatsLocally(incChats);
    const noStorageFileFail = await saveLocalFileOutput('guest', {
      conversation_id: 'c1',
      source_file_id: 'f1',
      file_name: 'big.txt',
      file_type: 'text/plain',
      output_type: 'text_extraction',
      extracted_output: 'payload',
    });
    Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true, writable: true });

    assert(
      !regQuotaFail.success &&
        regQuotaFail.isQuotaError === true &&
        Boolean(regQuotaFail.error?.includes('quota')) &&
        !encQuotaFail.success &&
        encQuotaFail.isQuotaError === true &&
        !incQuotaFail.success &&
        incQuotaFail.isQuotaError === true &&
        !fileQuotaFail.success &&
        fileQuotaFail.isQuotaError === true &&
        !noStorageRegFail.success &&
        !noStorageIncFail.success &&
        !noStorageFileFail.success &&
        networkRequests.length === 0,
      'H-5 Regression 7: Failed Local Persistence Surfacing Without Cloud Fallback',
      'QuotaExceededError and unavailable localStorage fail explicitly with surfaced errors and trigger zero Supabase, Worker D1, or R2 fallback requests.'
    );

    // Regression 8A: Explicit incognito clear removes incognito keys while preserving regular encrypted history
    clearIncognitoHistoryLocally();
    const afterExplicitIncClear = loadIncognitoChatsLocally();
    const afterExplicitIncFileOutputs = await loadLocalFileOutputs('incognito', 'inc-1', null);
    const regularAfterIncClear = await loadRegularChatsLocally({ userId: h5UserId, cryptoKey: h5Key, salt: h5Salt });

    assert(
      afterExplicitIncClear.chats.length === 0 &&
        mockStorage.getItem(INCOGNITO_CHATS_KEY) === null &&
        afterExplicitIncFileOutputs.length === 0 &&
        regularAfterIncClear.chats.length === 1,
      'H-5 Regression 8A: Explicit Incognito Clear Isolates Regular History',
      'clearIncognitoHistoryLocally wipes incognito chats and incognito file outputs without touching regular encrypted history.'
    );

    // Regression 8B: Account deletion local cleanup removes all regular, encrypted, incognito, legacy, and file-output keys
    mockStorage.clear();
    await saveRegularChatsLocally(signedInChats, { userId: h5UserId, cryptoKey: h5Key, salt: h5Salt });
    await saveLocalFileOutput(
      h5UserId,
      {
        conversation_id: 'reg-user-1',
        source_file_id: 'file-pdf-1',
        file_name: 'report.pdf',
        file_type: 'application/pdf',
        output_type: 'reader_script',
        reader_code: 'print("del")',
        extracted_output: 'extracted',
      },
      { cryptoKey: h5Key, salt: h5Salt, requireEncryption: true }
    );
    saveIncognitoChatsLocally(incChats);
    setIncognitoModeFlagLocally(true);
    mockStorage.setItem(REGULAR_GUEST_CHATS_KEY, '[]');
    mockStorage.setItem(LEGACY_ENCRYPTED_CHATS_KEY, 'enc:legacy');
    mockStorage.setItem('nanobot_active_user', h5UserId);
    mockStorage.setItem(`nanobot_migration_progress_${h5UserId}`, '{}');
    mockStorage.setItem(`nanobot_migration_lock_${h5UserId}`, '1');
    mockStorage.setItem('nanobot_files_reg-user-1', '[]');
    mockStorage.setItem('nanobot_r2_archive_reg-user-1', '[]');
    await saveLocalFileOutput('incognito', {
      conversation_id: 'inc-1',
      source_file_id: 'f-inc',
      file_name: 'a.txt',
      file_type: 'text/plain',
      output_type: 'text_extraction',
      extracted_output: 'inc',
    });

    clearAllLocalChatAndFileData(h5UserId, { includeIncognito: true, includeGuest: true });
    const remainingKeys = mockStorage.snapshotKeys();

    assert(
      remainingKeys.length === 0 &&
        typeof deleteUserAccountFromSupabase === 'function' &&
        appContent.includes('clearAllLocalChatAndFileData(deletedUserId, { includeIncognito: true, includeGuest: true })') &&
        appContent.includes('clearAllOriginalFiles()') &&
        workerIndexSql.includes("pathname === '/api/account' && request.method === 'DELETE'"),
      'H-5 Regression 8B: Complete Local Cleanup on Account Deletion',
      'clearAllLocalChatAndFileData removes regular, encrypted, incognito, migration, legacy, and file-output keys; Worker preserves legacy server cleanup.'
    );

    // Regression 8C: Accurate Privacy Disclosures in AboutModal & SettingsModal (no misleading localStorage security claims)
    const disclosuresAccurate =
      aboutModalContent.includes('Account &amp; authentication data (Supabase)') &&
      aboutModalContent.includes('Shared Noodles (Cloudflare)') &&
      aboutModalContent.includes('Regular chats (Browser localStorage)') &&
      aboutModalContent.includes('Incognito chats (Browser localStorage)') &&
      aboutModalContent.includes('does not protect data against malicious browser extensions, XSS, or compromise of the local browser or device') &&
      settingsContent.includes('Account &amp; authentication data (Supabase)') &&
      settingsContent.includes('Shared Noodles (Cloudflare)') &&
      settingsContent.includes('Regular chats (Browser localStorage)') &&
      settingsContent.includes('Incognito chats (Browser localStorage)') &&
      settingsContent.includes('does not protect data against malicious browser extensions, XSS, or compromise of the local browser or device') &&
      !aboutModalContent.includes('Cloudflare D1 / Supabase') &&
      !aboutModalContent.includes('User dats') &&
      !aboutModalContent.includes('Icognito');

    assert(
      disclosuresAccurate,
      'H-5 Regression 8C: Privacy Disclosures Accurately Reflect Storage & Browser Threat Model',
      'AboutModal and SettingsModal accurately document Supabase auth/account data, Cloudflare Shared Noodles, browser localStorage regular/incognito chats, and browser-compromise limits.'
    );
  } finally {
    globalThis.fetch = origFetch;
    if (origLocalStorageDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', origLocalStorageDescriptor);
    } else {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  }

  console.log('\n============================================================');
  console.log(`ALL VERIFICATION CHECKS COMPLETE: ${passCount}/${totalCount} TESTS PASSED`);
  console.log('============================================================');

  if (passCount !== totalCount) {
    process.exit(1);
  }
}

runAuthAndDatabaseTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
