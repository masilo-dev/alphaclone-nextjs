-- Zoho auto-responder audit log (aligns code with production schema).
CREATE TABLE IF NOT EXISTS public.zoho_auto_responder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  sender_email TEXT,
  subject TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  triage_status TEXT NOT NULL DEFAULT 'pending',
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  draft_reply TEXT,
  replied_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoho_auto_responder_logs_user_created
  ON public.zoho_auto_responder_logs (user_id, created_at DESC);

ALTER TABLE public.zoho_auto_responder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own auto-responder logs" ON public.zoho_auto_responder_logs;
CREATE POLICY "Users can view their own auto-responder logs"
  ON public.zoho_auto_responder_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can update auto-responder logs" ON public.zoho_auto_responder_logs;
CREATE POLICY "System can update auto-responder logs"
  ON public.zoho_auto_responder_logs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
