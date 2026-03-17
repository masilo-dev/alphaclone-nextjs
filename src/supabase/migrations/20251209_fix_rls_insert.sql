-- Fix RLS INSERT policies for profiles table
-- This allows users to be created properly during signup

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT
  TO service_role
  WITH CHECK (true);
