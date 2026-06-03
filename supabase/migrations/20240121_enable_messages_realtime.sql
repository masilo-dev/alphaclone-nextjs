-- Enable Realtime for messages table
-- This ensures messages appear instantly without page refresh

-- Enable Realtime publication for messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;

-- Add comment
COMMENT ON TABLE messages IS 'Messages table with Realtime enabled for instant delivery';

-- Ensure proper indexes for real-time performance
CREATE INDEX IF NOT EXISTS idx_messages_tenant_created 
ON messages(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient 
ON messages(sender_id, recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_recipient_unread 
ON messages(recipient_id, read_at) 
WHERE read_at IS NULL;
