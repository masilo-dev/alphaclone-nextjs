-- Fix journal fingerprint trigger: digest() lives in extensions schema on Supabase.

CREATE OR REPLACE FUNCTION generate_record_fingerprint()
RETURNS TRIGGER AS $$
DECLARE
    prev_fingerprint TEXT;
    content_to_hash TEXT;
BEGIN
    EXECUTE format('SELECT fingerprint FROM %I WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1', TG_TABLE_NAME)
    INTO prev_fingerprint
    USING NEW.tenant_id;

    NEW.previous_fingerprint := COALESCE(prev_fingerprint, '0000000000000000000000000000000000000000000000000000000000000000');

    IF TG_TABLE_NAME = 'journal_entries' THEN
        content_to_hash := concat_ws('|',
            NEW.tenant_id,
            NEW.entry_number,
            NEW.entry_date,
            NEW.total_debits,
            NEW.total_credits,
            NEW.status,
            NEW.previous_fingerprint
        );
    ELSIF TG_TABLE_NAME = 'audit_logs' THEN
        content_to_hash := concat_ws('|',
            NEW.tenant_id,
            NEW.user_id,
            NEW.action,
            NEW.resource_type,
            NEW.resource_id,
            NEW.new_values::text,
            NEW.previous_fingerprint
        );
    ELSE
        content_to_hash := concat_ws('|', NEW.id, NEW.previous_fingerprint);
    END IF;

    NEW.fingerprint := encode(extensions.digest(content_to_hash, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Invoice journal RPCs run with search_path=public; include extensions for pgcrypto.
ALTER FUNCTION public.post_business_invoice_issue_journal(uuid, uuid, uuid)
  SET search_path = public, extensions;

ALTER FUNCTION public.record_business_invoice_payment(uuid, uuid, numeric, text, text, text, uuid)
  SET search_path = public, extensions;
