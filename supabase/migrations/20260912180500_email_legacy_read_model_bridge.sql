BEGIN;

-- Existing MCP read tools still consume lead_outreach_log and
-- project_email_dispatches. Mirror canonical outbound recipient evidence into
-- those read models until all consumers query email_messages directly.
CREATE OR REPLACE FUNCTION public.bridge_canonical_outbound_email_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.email_messages%ROWTYPE;
  provider_name text;
  body_text_value text;
BEGIN
  IF NEW.recipient_type <> 'to' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO m
  FROM public.email_messages
  WHERE id = NEW.message_id AND tenant_id = NEW.tenant_id;

  IF NOT FOUND OR m.direction <> 'outbound' OR m.provider_message_id IS NULL THEN
    RETURN NEW;
  END IF;

  provider_name := COALESCE(NULLIF(m.metadata->>'provider', ''), 'unknown');
  body_text_value := COALESCE(NULLIF(m.metadata->>'body_text', ''), m.body_preview, '');

  IF NOT EXISTS (
    SELECT 1 FROM public.lead_outreach_log l
    WHERE l.tenant_id = NEW.tenant_id
      AND (l.provider_message_id = m.provider_message_id OR l.tracking_id = m.provider_message_id)
      AND lower(COALESCE(l.lead_email, '')) = lower(NEW.email_address)
  ) THEN
    INSERT INTO public.lead_outreach_log (
      tenant_id, user_id, lead_name, lead_email, subject, body_html,
      tracking_id, pitch_angle, industry, score, status, provider,
      provider_message_id, zoho_message_id, provider_event_status,
      provider_last_event_at, sent_at
    ) VALUES (
      NEW.tenant_id, m.created_by, NEW.email_address, NEW.email_address,
      m.subject, COALESCE(m.metadata->>'body_html', body_text_value),
      m.provider_message_id, 'canonical_email', '', 0,
      CASE
        WHEN m.delivery_status = 'delivered' THEN 'delivered'
        WHEN m.delivery_status = 'bounced' THEN 'bounced'
        WHEN m.application_status = 'failed' THEN 'failed'
        ELSE 'provider_accepted'
      END,
      provider_name, m.provider_message_id,
      CASE WHEN provider_name = 'zoho' THEN m.provider_message_id ELSE NULL END,
      COALESCE(m.delivery_status, 'accepted'),
      COALESCE((m.metadata->>'provider_accepted_at')::timestamptz, m.sent_at, m.created_at),
      COALESCE(m.sent_at, m.created_at)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_email_dispatches d
    WHERE d.tenant_id = NEW.tenant_id
      AND lower(d.recipient_email) = lower(NEW.email_address)
      AND d.subject IS NOT DISTINCT FROM m.subject
      AND d.created_at >= m.created_at - interval '2 seconds'
      AND d.created_at <= m.created_at + interval '2 seconds'
  ) THEN
    INSERT INTO public.project_email_dispatches (
      tenant_id, project_id, client_id, stage, autonomy_level,
      approval_status, recipient_email, subject, body_text, sent_at, created_at
    ) VALUES (
      NEW.tenant_id,
      NULLIF(m.metadata->>'projectId', '')::uuid,
      NULLIF(m.metadata->>'clientId', '')::uuid,
      'canonical_outbound', 'level_4', 'auto_sent', NEW.email_address,
      COALESCE(m.subject, ''), body_text_value,
      COALESCE(m.sent_at, m.created_at), m.created_at
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bridge_canonical_outbound_email_recipient
  ON public.email_message_recipients;
CREATE TRIGGER trg_bridge_canonical_outbound_email_recipient
AFTER INSERT ON public.email_message_recipients
FOR EACH ROW EXECUTE FUNCTION public.bridge_canonical_outbound_email_recipient();

CREATE INDEX IF NOT EXISTS lead_outreach_log_tenant_tracking_idx
  ON public.lead_outreach_log (tenant_id, tracking_id)
  WHERE tracking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lead_outreach_log_tenant_provider_message_idx
  ON public.lead_outreach_log (tenant_id, provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_email_dispatches_tenant_subject_idx
  ON public.project_email_dispatches (tenant_id, subject, created_at DESC);

NOTIFY pgrst, 'reload schema';
COMMIT;
