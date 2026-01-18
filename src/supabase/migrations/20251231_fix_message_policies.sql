-- Fix messaging RLS policies - remove conflicting old policies and add proper ones

-- Drop old conflicting policies
DROP POLICY IF EXISTS "Users can view all messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.messages;

-- Ensure we have the correct policies (from 20251209_add_recipient_and_rls.sql)
-- These might already exist, so we use IF NOT EXISTS or just recreate

-- Drop and recreate to ensure correctness
DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;

-- 1. Admins can see ALL messages
CREATE POLICY "Admins can view all messages"
ON public.messages FOR SELECT
USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);

-- 2. Users can see messages they sent OR messages sent to them
CREATE POLICY "Users can view their own messages"
ON public.messages FOR SELECT
USING (
  auth.uid() = sender_id OR auth.uid() = recipient_id
);

-- 3. Users can insert messages (sender_id must be themselves)
CREATE POLICY "Users can insert their own messages"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
);

-- 4. ADD UPDATE POLICY - Users can update messages they own (for marking as read)
CREATE POLICY "Users can update their received messages"
ON public.messages FOR UPDATE
USING (
  auth.uid() = recipient_id OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);
