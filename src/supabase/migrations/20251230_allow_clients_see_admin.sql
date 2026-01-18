-- Allow clients to see admin profiles for messaging
-- Clients need to see admin profile to send messages

-- Add policy for clients to view admin profiles
CREATE POLICY "Clients can view admin profiles"
  ON public.profiles FOR SELECT
  USING (
    -- Allow if the target profile is an admin
    role = 'admin'
  );

-- This combines with existing policies:
-- 1. "Users can view their own profile" - users see themselves
-- 2. "Admins can view all profiles" - admins see everyone
-- 3. "Clients can view admin profiles" - clients see admins (NEW)
