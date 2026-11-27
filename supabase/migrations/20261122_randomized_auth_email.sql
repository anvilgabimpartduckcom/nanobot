-- Added randomized internal auth_email mapping and lookup RPC for @nanobot.internal authentication while preserving legacy accounts [Commented by: Google AI Studio at 22/11/2026 14:32]

-- 1. Add nullable auth_email column to public.user_profiles for randomized @nanobot.internal account mapping
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS auth_email TEXT;

-- 2. Enforce case-insensitive uniqueness across non-null internal auth emails
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_lower_auth_email
    ON public.user_profiles (lower(auth_email))
    WHERE auth_email IS NOT NULL;

-- 3. Safely backfill auth_email from authoritative auth.users.email for existing accounts when NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'auth_email'
    ) THEN
        UPDATE public.user_profiles up
        SET auth_email = au.email
        FROM auth.users au
        WHERE up.id = au.id
          AND (up.auth_email IS NULL OR trim(up.auth_email) = '')
          AND au.email IS NOT NULL;
    END IF;
END $$;

-- 4. Secure RPC returning the internal auth email for a given username without exposing profile secrets
CREATE OR REPLACE FUNCTION public.get_auth_email_for_username(username_to_lookup TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT COALESCE(au.email, NULLIF(trim(up.auth_email), ''))
    FROM public.user_profiles up
    LEFT JOIN auth.users au ON au.id = up.id
    WHERE lower(up.username) = lower(trim(username_to_lookup))
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_auth_email_for_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_email_for_username(TEXT) TO anon, authenticated;
