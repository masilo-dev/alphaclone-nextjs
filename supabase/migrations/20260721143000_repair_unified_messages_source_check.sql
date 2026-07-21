-- Repair production drift: extend unified_messages.source allowed values (idempotent).
ALTER TABLE IF EXISTS public.unified_messages
  DROP CONSTRAINT IF EXISTS unified_messages_source_check;

ALTER TABLE IF EXISTS public.unified_messages
  ADD CONSTRAINT unified_messages_source_check CHECK (
    source IN (
      'internal',
      'gmail',
      'zoho',
      'sms',
      'slack',
      'teams',
      'brevo',
      'resend',
      'sendgrid',
      'facebook',
      'whatsapp',
      'linkedin',
      'instagram',
      'mcp'
    )
  );

NOTIFY pgrst, 'reload schema';
