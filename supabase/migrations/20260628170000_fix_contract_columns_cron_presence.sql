-- Contract lifecycle columns expected by dashboard + expiration services.
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_notice_days INTEGER NOT NULL DEFAULT 30;

UPDATE public.contracts
SET end_date = payment_due_date
WHERE end_date IS NULL
  AND payment_due_date IS NOT NULL;

UPDATE public.contracts
SET start_date = COALESCE(client_signed_at, signed_at, created_at)
WHERE start_date IS NULL
  AND COALESCE(client_signed_at, signed_at, created_at) IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_tenant_end_date
  ON public.contracts (tenant_id, end_date)
  WHERE end_date IS NOT NULL;

-- Presence RPC: no-op when session is gone (logout / beforeunload), instead of error spam.
CREATE OR REPLACE FUNCTION public.update_user_presence(
    p_user_id UUID,
    p_status TEXT,
    p_device_info JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    IF auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Not authorized to update this presence record';
    END IF;

    INSERT INTO public.user_presence (user_id, status, last_seen, device_info, updated_at)
    VALUES (p_user_id, COALESCE(p_status, 'online'), NOW(), p_device_info, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        status = EXCLUDED.status,
        last_seen = NOW(),
        device_info = COALESCE(EXCLUDED.device_info, public.user_presence.device_info),
        updated_at = NOW();
END;
$$;

-- Repair pg_cron HTTP jobs that used invalid JSON string casts for headers.
DO $$
DECLARE
    rec RECORD;
    v_secret TEXT;
    v_path TEXT;
BEGIN
    FOR rec IN
        SELECT jobid, command
        FROM cron.job
        WHERE command ILIKE '%net.http_post%'
          AND command ILIKE '%alphaclonesystems.com/api/cron/%'
    LOOP
        v_secret := substring(rec.command FROM 'Bearer ([a-f0-9]+)');
        IF v_secret IS NULL THEN
            CONTINUE;
        END IF;

        IF rec.command ILIKE '%social-publish%' THEN
            v_path := '/api/cron/social-publish';
        ELSIF rec.command ILIKE '%publish-scheduled-posts%' THEN
            v_path := '/api/cron/publish-scheduled-posts';
        ELSE
            CONTINUE;
        END IF;

        PERFORM cron.unschedule(rec.jobid);

        PERFORM cron.schedule(
            CASE v_path
                WHEN '/api/cron/social-publish' THEN 'social-publish'
                ELSE 'publish-scheduled-posts'
            END,
            '*/5 * * * *',
            format(
                $cmd$SELECT net.http_post(
  url := 'https://www.alphaclonesystems.com%s',
  headers := jsonb_build_object(
    'Authorization', 'Bearer %s',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
);$cmd$,
                v_path,
                v_secret
            )
        );
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
