-- Migration to add onboarding_role to public.profiles table
-- Created 2026-06-02

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_role TEXT;
