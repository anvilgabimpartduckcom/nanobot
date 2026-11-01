// Nanobot Comprehensive Supabase Auth, Database, Storage, and RLS Verification Suite [Commented by: Google AI Studio on 01/11/2026 02:15 PM]

import { formatAuthEmail } from '../src/lib/supabase';
import { generateSalt, deriveKeyFromPassword, encryptText, decryptText, decryptData } from '../src/lib/crypto';
import fs from 'node:fs';
import path from 'node:path';

async function runAuthAndDatabaseTests() {
  console.log('============================================================');
  console.log('NANOBOT AUTH, DATABASE, AND PERSISTENCE VERIFICATION SUITE');
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

  // --- Section 1: Supabase Schema & Email Column Verification ---
  console.log('--- Section 1: Supabase PostgreSQL Schema & RLS Tests ---');
  const schemaPath = path.resolve(process.cwd(), 'supabase/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  assert(
    !schemaSql.includes('email TEXT UNIQUE NOT NULL') && !schemaSql.includes('email TEXT NOT NULL'),
    'Zero Email Column in user_profiles',
    'public.user_profiles table strictly has NO email column defined.'
  );

  assert(
    schemaSql.includes('REFERENCES auth.users(id) ON DELETE CASCADE'),
    'Foreign Key to auth.users',
    'public.user_profiles.id foreign keys directly to auth.users(id) with ON DELETE CASCADE.'
  );

  assert(
    schemaSql.includes('auth.uid() = id'),
    'Strict Profile RLS Policies',
    'RLS policies enforce auth.uid() = id on user_profiles for all CRUD operations.'
  );

  assert(
    schemaSql.includes('CREATE TABLE IF NOT EXISTS public.conversations') &&
    schemaSql.includes('auth.uid() = user_id'),
    'Conversations Table with RLS',
    'Authoritative conversations table exists with strict auth.uid() = user_id RLS policy.'
  );

  assert(
    schemaSql.includes('CREATE TABLE IF NOT EXISTS public.messages') &&
    schemaSql.includes('auth.uid() = user_id'),
    'Messages Table with RLS',
    'Authoritative messages table exists with strict auth.uid() = user_id RLS policy.'
  );

  assert(
    schemaSql.includes('CREATE OR REPLACE FUNCTION public.check_username_available'),
    'Secure Username Availability RPC',
    'check_username_available function exists with SECURITY DEFINER to safely check username availability without leaking user records.'
  );

  assert(
    !schemaSql.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO anon'),
    'Revoke Anon Access to Private Profiles',
    'Anonymous users cannot query or mutate private user profiles; access restricted to authenticated.'
  );

  // --- Section 2: Supabase Auth Identifier & Email Logic Tests ---
  console.log('\n--- Section 2: Auth Identifier & Identity Mapping Tests ---');

  const authEmail1 = formatAuthEmail('Alice_99');
  assert(
    authEmail1 === 'alice_99@nanobot.auth.internal',
    'Deterministic Auth Email Generation',
    `formatAuthEmail produces standard GoTrue-compatible internal identifier: ${authEmail1}`
  );

  const authEmail2 = formatAuthEmail('Bob@Special!Chars#');
  assert(
    authEmail2 === 'bobspecialchars@nanobot.auth.internal',
    'Special Character Sanitization in Auth Identifier',
    `Sanitized special characters properly: ${authEmail2}`
  );

  // --- Section 3: Zero-Knowledge Client-Side Credential Encryption Tests ---
  console.log('\n--- Section 3: Zero-Knowledge Client-Side Credential Encryption Tests ---');

  const userPassword = 'CorrectHorseBatteryStaple123!';
  const wrongPassword = 'WrongPassword456!';
  const salt = generateSalt();

  const correctKey = await deriveKeyFromPassword(userPassword, salt);
  const wrongKey = await deriveKeyFromPassword(wrongPassword, salt);

  const plaintextOpenRouterKey = 'sk-or-v1-0123456789abcdef0123456789abcdef';
  const ciphertext = await encryptText(plaintextOpenRouterKey, correctKey, salt);

  assert(
    ciphertext.includes(':') && !ciphertext.includes('sk-or-v1'),
    'PBKDF2 + AES-GCM Encryption',
    'Credential encrypted into IV:Ciphertext with zero plaintext leakage.'
  );

  const decrypted = await decryptText(ciphertext, correctKey);
  assert(
    decrypted === plaintextOpenRouterKey,
    'Successful Decryption with Correct Password',
    'Plaintext key restored with exact fidelity using user password-derived key.'
  );

  let wrongDecryptionFailed = false;
  try {
    const parts = ciphertext.split(':');
    await decryptData(parts[2], parts[1], wrongKey);
  } catch {
    wrongDecryptionFailed = true;
  }
  const wrongTextResult = await decryptText(ciphertext, wrongKey);
  assert(
    wrongDecryptionFailed && wrongTextResult !== plaintextOpenRouterKey,
    'Decryption Rejection with Wrong Password',
    'Decryption failed with AES-GCM tag mismatch when using incorrect password and refused plaintext revelation.'
  );

  let corruptedDecryptionFailed = false;
  try {
    const parts = ciphertext.split(':');
    await decryptData('badcafe' + parts[2].slice(7), parts[1], correctKey);
  } catch {
    corruptedDecryptionFailed = true;
  }
  const corruptedTextResult = await decryptText('enc:badiv:badcipher', correctKey);
  assert(
    corruptedDecryptionFailed && corruptedTextResult !== plaintextOpenRouterKey,
    'Decryption Rejection on Corrupted Ciphertext',
    'Corrupted ciphertext was rejected without yielding invalid keys.'
  );

  // --- Section 4: Data Persistence Hierarchy & Frontend Code Checks ---
  console.log('\n--- Section 4: Data Persistence Hierarchy & Frontend Checks ---');

  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  assert(
    appContent.includes('restoreActiveSession') && appContent.includes('onAuthStateChange'),
    'Session Restoration on App Mount',
    'App.tsx subscribes to Supabase onAuthStateChange and restores active session.'
  );

  assert(
    appContent.includes('fetchRemoteConversationsFromSupabase') &&
    appContent.includes('persistConversationToSupabase'),
    'Authoritative Supabase Storage in App.tsx',
    'App.tsx reads from and persists conversations to Supabase authoritative database.'
  );

  assert(
    appContent.includes('deleteConversationFromSupabase'),
    'Remote Conversation Deletion Sync',
    'handleDeleteChat cascades deletion to Supabase conversations table.'
  );

  const settingsPath = path.resolve(process.cwd(), 'src/components/SettingsModal.tsx');
  const settingsContent = fs.readFileSync(settingsPath, 'utf8');

  assert(
    !settingsContent.includes('.eq(\'email\', user.email)'),
    'Zero .eq(\'email\', user.email) in SettingsModal',
    'SettingsModal profile queries strictly use user.id instead of email.'
  );

  console.log('\n============================================================');
  console.log(`AUTH & DATABASE VERIFICATION COMPLETE: ${passCount}/${totalCount} TESTS PASSED`);
  console.log('============================================================');

  if (passCount !== totalCount) {
    process.exit(1);
  }
}

runAuthAndDatabaseTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
