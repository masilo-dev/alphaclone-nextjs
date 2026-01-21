-- Enable Realtime for messages table
-- This ensures messages appear instantly without page refresh

-- Enable Realtime publication for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

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
