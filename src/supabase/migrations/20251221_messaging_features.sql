-- Add read receipt timestamp to messages
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL;
-- Add priority flag to messages
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent'));
-- Add auto-reply and presence tracking to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();
-- Index for querying unread messages
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON public.messages(recipient_id, read_at)
WHERE read_at IS NULL;