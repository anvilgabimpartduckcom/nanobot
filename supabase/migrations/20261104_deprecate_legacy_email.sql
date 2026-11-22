-- Nanobot Separate Migration Proposal: Optional Future Deprecation of Legacy Email Column [Commented by: Google AI Studio on 04/11/2026 05:38 PM]
-- IMPORTANT: This migration is DESTRUCTIVE and should ONLY be executed after an organization-level
-- data backup and confirmation that legacy user email lookups are no longer required.
-- 
-- The primary reconciliation migration (20261104_reconcile_production_schema.sql) intentionally
-- preserves public.user_profiles.email with NULL constraints removed.
-- 
-- When ready to permanently remove the legacy email column from user_profiles, execute this script:

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'email'
    ) THEN
        -- Verify that no active constraints or dependent views rely on email before dropping
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_email_key') THEN
            ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_email_key;
        END IF;

        ALTER TABLE public.user_profiles DROP COLUMN email CASCADE;
        RAISE NOTICE 'Successfully dropped legacy email column from public.user_profiles';
    ELSE
        RAISE NOTICE 'public.user_profiles.email column is already absent; skipping drop.';
    END IF;
END $$;
