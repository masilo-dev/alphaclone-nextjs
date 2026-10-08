BEGIN;
ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS folder_id text;
ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS folder_name text;
ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS mailbox_synced_at timestamptz;
ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS mailbox_sort_at timestamptz GENERATED ALWAYS AS (COALESCE(received_at,sent_at,created_at)) STORED;
CREATE INDEX IF NOT EXISTS email_mailbox_folder_idx ON public.email_messages(tenant_id, provider_account_id, folder_name, received_at DESC);

CREATE TABLE IF NOT EXISTS public.email_mailbox_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  provider_account_id uuid NOT NULL REFERENCES public.email_provider_accounts(id),
  status text NOT NULL CHECK(status IN ('running','pending','completed','failed')),
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_count integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS email_mailbox_one_active_job ON public.email_mailbox_sync_jobs(tenant_id, provider_account_id) WHERE status IN ('running','pending');
ALTER TABLE public.email_mailbox_sync_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_mailbox_sync_jobs FROM anon, authenticated;
GRANT ALL ON public.email_mailbox_sync_jobs TO service_role;

-- Atomic ingestion serializes both a provider message and its thread. No CRM
-- insert, sender selection or provider request happens inside this function.
CREATE OR REPLACE FUNCTION public.ingest_mailbox_message(p_tenant uuid, p_account uuid, p_message jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_thread uuid; v_external text; v_thread_external text; v_kind text; v_recipient text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM email_provider_accounts WHERE id=p_account AND tenant_id=p_tenant AND deleted_at IS NULL AND account_type IN ('user','shared_mailbox')) THEN
    RAISE EXCEPTION 'EMAIL_ACCOUNT_TENANT_MISMATCH';
  END IF;
  v_external := p_message->>'id';
  v_thread_external := COALESCE(NULLIF(p_message->>'thread_id',''), v_external);
  IF v_external IS NULL OR v_external='' THEN RAISE EXCEPTION 'EMAIL_PROVIDER_MESSAGE_ID_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||p_account::text||v_thread_external,0));
  SELECT id, thread_id INTO v_id,v_thread FROM email_messages WHERE tenant_id=p_tenant AND provider_account_id=p_account AND provider_message_id=v_external;
  IF v_thread IS NULL THEN
    SELECT thread_id INTO v_thread FROM email_messages WHERE tenant_id=p_tenant AND provider_account_id=p_account AND provider_thread_id=v_thread_external AND thread_id IS NOT NULL LIMIT 1;
  END IF;
  IF v_thread IS NULL THEN
    INSERT INTO email_threads(tenant_id,subject_normalized,latest_message_at) VALUES(p_tenant,lower(p_message->>'subject'),(p_message->>'date')::timestamptz) RETURNING id INTO v_thread;
  END IF;
  IF v_id IS NULL THEN
    INSERT INTO email_messages(tenant_id,provider_account_id,provider_message_id,provider_thread_id,thread_id,direction,purpose,subject,application_status)
    VALUES(p_tenant,p_account,v_external,v_thread_external,v_thread,p_message->>'direction','personal',p_message->>'subject',COALESCE(p_message->>'application_status','sent')) RETURNING id INTO v_id;
  END IF;
  UPDATE email_messages SET
    thread_id=v_thread,provider_thread_id=v_thread_external,
    subject=p_message->>'subject',body_preview=left(p_message->>'body_text',500),
    direction=p_message->>'direction',application_status=COALESCE(p_message->>'application_status','sent'),
    received_at=CASE WHEN p_message->>'direction'='inbound' THEN (p_message->>'date')::timestamptz ELSE NULL END,
    sent_at=CASE WHEN p_message->>'direction'='outbound' AND COALESCE(p_message->>'application_status','sent')='sent' THEN (p_message->>'date')::timestamptz ELSE sent_at END,
    read_at=CASE WHEN (p_message->>'is_read')::boolean THEN COALESCE(read_at,now()) ELSE NULL END,
    has_attachments=jsonb_array_length(COALESCE(p_message->'attachments','[]'::jsonb))>0,
    folder_id=p_message->>'folder_id',folder_name=p_message->>'folder_name',mailbox_synced_at=now(),
    headers_safe=COALESCE(p_message->'headers','{}'::jsonb),
    metadata=metadata||p_message,updated_at=now()
  WHERE id=v_id AND tenant_id=p_tenant;
  FOREACH v_kind IN ARRAY ARRAY['to','cc','bcc'] LOOP
    FOR v_recipient IN SELECT jsonb_array_elements_text(COALESCE(p_message->v_kind,'[]'::jsonb)) LOOP
      INSERT INTO email_message_recipients(tenant_id,message_id,recipient_type,email_address)
      SELECT p_tenant,v_id,v_kind,v_recipient WHERE NOT EXISTS (
        SELECT 1 FROM email_message_recipients WHERE tenant_id=p_tenant AND message_id=v_id AND recipient_type=v_kind AND email_address=v_recipient
      );
    END LOOP;
  END LOOP;
  UPDATE email_threads SET latest_message_at=GREATEST(latest_message_at,(p_message->>'date')::timestamptz),updated_at=now() WHERE id=v_thread AND tenant_id=p_tenant;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.ingest_mailbox_message(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_mailbox_message(uuid,uuid,jsonb) TO service_role;
COMMIT;
