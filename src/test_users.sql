-- Quick User Creation Guide
-- 1. Create the user in Supabase Authentication (Dashboard -> Authentication -> Users -> Add User)
--    This handles password hashing which cannot be easily done in raw SQL without pgcrypto.
-- 2. Once the user is created, the system triggers will automatically create a profile in 'public.profiles'.
-- 3. To make the user an ADMIN, run this query:
-- Replace 'your-email@example.com' with the email you just registered.
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
-- 4. To check your current users:
SELECT *
FROM public.profiles;