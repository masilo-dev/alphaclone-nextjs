-- Add recipient_id to messages to support 1:1 chat
-- If recipient_id is NULL, it could be treated as a broadcast or system message, 
-- but for Client->Admin, we can either set admin ID or assume NULL/System is Admin.
-- Best practice: Explicit recipient.

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);

-- Update RLS (Row Level Security) - CRITICAL for isolation
-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

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
