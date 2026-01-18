-- Migration to fix duplicate accounts by enforcing unique emails
-- 1. First clean up any existing duplicates (keeping the most recently updated one)
WITH duplicates AS (
    SELECT id,
        ROW_NUMBER() OVER (
            PARTITION BY lower(email)
            ORDER BY updated_at DESC
        ) as r,
        email
    FROM public.profiles
)
DELETE FROM public.profiles
WHERE id IN (
        SELECT id
        FROM duplicates
        WHERE r > 1
    );
-- 2. Add unique constraint on email
-- We use a unique index on lower(email) to ensure case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (lower(email));
-- 3. Update the handle_new_user trigger to force lowercase email
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
DECLARE new_role public.user_role;
raw_role text;
normalized_email text;
BEGIN -- Get the role from metadata, default to client
raw_role := NEW.raw_user_meta_data->>'role';
-- Normalize email
normalized_email := lower(NEW.email);
-- Safely assign role
IF raw_role = 'admin' THEN new_role := 'admin';
ELSIF raw_role = 'visitor' THEN new_role := 'visitor';
ELSE new_role := 'client';
END IF;
INSERT INTO public.profiles (id, email, name, role, avatar)
VALUES (
        NEW.id,
        normalized_email,
        COALESCE(
            NEW.raw_user_meta_data->>'name',
            split_part(normalized_email, '@', 1)
        ),
        new_role,
        COALESCE(NEW.raw_user_meta_data->>'avatar', '')
    ) ON CONFLICT (id) DO
UPDATE
SET email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    avatar = EXCLUDED.avatar,
    updated_at = NOW();
RETURN NEW;
EXCEPTION
WHEN OTHERS THEN RAISE LOG 'Error in handle_new_user trigger: %',
SQLERRM;
RAISE EXCEPTION 'Database error saving new user: %',
SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;