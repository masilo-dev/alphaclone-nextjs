-- REPAIR SCRIPT: Fix "User exists but cannot login"
-- Run this in Supabase SQL Editor
-- 1. Restore missing profiles from Auth Users
-- This fixes the issue where you deleted the 'profiles' table data but your User still exists in Auth.
INSERT INTO public.profiles (id, email, name, role, avatar)
SELECT au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'name',
        split_part(au.email, '@', 1)
    ),
    COALESCE(
        (au.raw_user_meta_data->>'role')::public.user_role,
        'admin'
    ),
    -- Restore as Admin to be safe
    au.raw_user_meta_data->>'avatar'
FROM auth.users au
WHERE au.id NOT IN (
        SELECT id
        FROM public.profiles
    );
-- 2. Verify it worked
SELECT 'Profiles Restored' as status,
    count(*) as count
FROM public.profiles;
-- 3. Ensure you are an Admin (Explicit Fix)
-- Replace the email below with your email if needed
UPDATE public.profiles
SET role = 'admin'
WHERE email LIKE '%alphaclone%';