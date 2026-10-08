BEGIN;
-- Atomic ingestion serializes both a provider message and its thread. No CRM
-- insert, sender selection or provider request happens inside this function.
CREATE OR REPLACE FUNCTION public.ingest_mailbox_message(p_tenant uuid, p_account uuid, p_message jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_thread uuid; v_external text; v_thread_external text; v_kind text; v_recipient text; v_parent uuid; v_parent_external text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM email_provider_accounts WHERE id=p_account AND tenant_id=p_tenant AND deleted_at IS NULL AND account_type IN ('user','shared_mailbox')) THEN
    RAISE EXCEPTION 'EMAIL_ACCOUNT_TENANT_MISMATCH';
  END IF;
  v_external := p_message->>'id';
  v_thread_external := COALESCE(NULLIF(p_message->>'thread_id',''), v_external);
  IF v_external IS NULL OR v_external='' THEN RAISE EXCEPTION 'EMAIL_PROVIDER_MESSAGE_ID_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||p_account::text||v_thread_external,0));
  SELECT id, thread_id INTO v_id,v_thread FROM email_messages WHERE tenant_id=p_tenant AND provider_account_id=p_account AND provider_message_id=v_external;
  -- Zoho may expose the native source-message ID as the sent reply thread ID.
  -- Prefer the known parent (native ID or RFC Message-ID), then preserve the
  -- established canonical root when reading back an already accepted reply.
  SELECT thread_id,provider_thread_id INTO v_parent,v_parent_external
  FROM email_messages
  WHERE tenant_id=p_tenant AND provider_account_id=p_account AND id IS DISTINCT FROM v_id
    AND (provider_message_id=v_thread_external OR headers_safe->>'message-id'=p_message->'headers'->>'in-reply-to')
    AND thread_id IS NOT NULL ORDER BY created_at LIMIT 1;
  IF v_parent IS NOT NULL THEN
    v_thread:=v_parent; v_thread_external:=v_parent_external;
  ELSIF v_thread IS NOT NULL THEN
    SELECT provider_thread_id INTO v_parent_external FROM email_messages
    WHERE tenant_id=p_tenant AND provider_account_id=p_account AND thread_id=v_thread
      AND id IS DISTINCT FROM v_id ORDER BY created_at LIMIT 1;
    v_thread_external:=COALESCE(v_parent_external,v_thread_external);
  ELSE
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
    metadata=metadata||p_message||jsonb_build_object('thread_id',v_thread_external),updated_at=now()
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
