-- Deploy Migrations Script
-- This file contains SQL commands to deploy all migrations to Supabase

-- Run migrations in order
\i 20241207000001_initial_schema.sql
\i 20241207000002_rls_policies.sql
\i 20241207000003_storage_buckets.sql
\i 20241207000004_functions.sql

-- Create admin accounts
-- Note: These need to be created via Supabase Dashboard or Auth API
-- Emails: info@alphaclone.tech, alphaclonesystems@hotmail.com
-- Password: Amgseries@gmail.com

-- After creating users in Supabase Auth, update their roles to admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE email IN ('info@alphaclone.tech', 'alphaclonesystems@hotmail.com');

-- Verify admin accounts
SELECT id, email, name, role FROM public.profiles WHERE role = 'admin';
