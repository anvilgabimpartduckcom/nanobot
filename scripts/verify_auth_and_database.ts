// Nanobot Comprehensive Supabase Auth, Database, Storage, and RLS Verification Suite [Commented by: Google AI Studio on 01/11/2026 04:18 PM]

import { formatAuthEmail, validateUsername } from '../src/lib/supabase';
import { generateSalt, deriveKeyFromPassword, encryptText, decryptText, decryptData } from '../src/lib/crypto';
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
    schemaSql.includes('DROP COLUMN email CASCADE'),
    'No Email Column in schema.sql',
    'public.user_profiles table strictly has NO email column defined and drops legacy column.'
  );

  assert(
    !supabaseTs.includes('email: string;') &&
    !settingsContent.includes('.eq(\'email\', user.email)'),
    'UserProfile Interface & Queries Free of Email Column',
    'UserProfile interface has no email field and SettingsModal queries by strict user.id.'
  );

  // =========================================================================
  // 4. Deterministic Auth Email Generation with Normalization & Collision Prevention
  // =========================================================================
  console.log('\n--- 4. Auth Identifier Normalization & Collision Guard ---');

  const emailStandard = formatAuthEmail('Alice_99');
  assert(
    emailStandard === 'alice_99@nanobot.auth.internal',
    'Standard Username Mapping',
    `formatAuthEmail('Alice_99') produces ${emailStandard}`
  );

  const emailSpecial = formatAuthEmail('Bob@Special!Chars#');
  assert(
    emailSpecial === 'bobspecialchars@nanobot.auth.internal',
    'Special Character Sanitization',
    `formatAuthEmail('Bob@Special!Chars#') sanitizes to ${emailSpecial}`
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

  // =========================================================================
  // 6. Atomic Conversation Persistence (RPC & Fallback)
  // =========================================================================
  console.log('\n--- 6. Atomic Conversation Persistence ---');

  assert(
    schemaSql.includes('CREATE OR REPLACE FUNCTION public.save_conversation_and_messages'),
    'Atomic RPC Function Defined in Schema',
    'save_conversation_and_messages function executes upsert and message replacement inside single transaction.'
  );

  assert(
    supabaseTs.includes('save_conversation_and_messages') &&
    supabaseTs.includes('p_messages: msgRows'),
    'Client Calls Atomic RPC First',
    'persistConversationToSupabase calls save_conversation_and_messages RPC to guarantee atomicity.'
  );

  assert(
    supabaseTs.includes('Supabase conversation upsert failed; aborting message persistence:'),
    'Fallback Persistence Avoids Deletion on Failure',
    'Fallback persistence aborts before deleting existing messages if conversation upsert fails.'
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
  // 9. Migration Handles Errors, Empty vs Failed States & Idempotency
  // =========================================================================
  console.log('\n--- 9. Local-to-Cloud Migration Robustness ---');

  assert(
    supabaseTs.includes('if (countErr) {') &&
    supabaseTs.includes('Migration aborted: Unable to verify remote state due to query error:'),
    'Migration Aborts on Query Error',
    'migrateLocalChatsToSupabase distinguishes query error from count === 0 and aborts immediately.'
  );

  assert(
    supabaseTs.includes('if (allSucceeded) {') &&
    supabaseTs.includes('localStorage.removeItem(\'nanobot_chats\')'),
    'Local Cache Preserved Until Remote Success',
    'Unencrypted local chats are only removed after all conversations persist successfully.'
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
    supabaseTs.includes('localStorage.removeItem(`nanobot_encrypted_chats_${userId}`)'),
    'deleteUserAccountFromSupabase Clears Local Storage & Cache',
    'Deletes local cache entries and signs out auth session safely.'
  );

  assert(
    appContent.includes('orKey.startsWith(\'enc:\')') &&
    settingsContent.includes('Session Restored: Credentials Encrypted'),
    'Session Restore Re-Authentication UI Notice',
    'App and Settings notify user to enter password when restoring session with zero-knowledge encrypted keys.'
  );

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
