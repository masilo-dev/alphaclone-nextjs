-- Add attachments column to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS attachments JSONB [] DEFAULT NULL;
-- Create storage bucket for chat attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true) ON CONFLICT (id) DO NOTHING;
-- Policy to allow authenticated users to upload to chat-attachments
CREATE POLICY "Authenticated users can upload chat attachments" ON storage.objects FOR
INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');
-- Policy to allow authenticated users to view chat attachments
CREATE POLICY "Authenticated users can view chat attachments" ON storage.objects FOR
SELECT TO authenticated USING (bucket_id = 'chat-attachments');
-- Policy to allow users to delete their own attachments (optional but good practice)
CREATE POLICY "Users can delete their own attachments" ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'chat-attachments'
    AND auth.uid() = owner
);