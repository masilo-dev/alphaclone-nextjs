-- Production stabilization: reconcile schema drift from compatibility stub tables
-- and harden idempotent usage recording.

-- ── mcp_action_receipts (compatibility stub lacked MCP columns) ─────────────
ALTER TABLE IF EXISTS public.mcp_action_receipts
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS tool TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS success BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_status TEXT,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS live_url TEXT,
  ADD COLUMN IF NOT EXISTS verification JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rollback_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS sanitized_input JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sanitized_output JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.mcp_action_receipts
   SET tool = COALESCE(NULLIF(trim(tool), ''), NULLIF(trim(type), ''), NULLIF(trim(name), ''), 'unknown')
 WHERE tool IS NULL OR trim(tool) = '';

UPDATE public.mcp_action_receipts
   SET final_status = COALESCE(NULLIF(trim(final_status), ''), CASE WHEN success THEN 'completed' ELSE 'failed' END)
 WHERE final_status IS NULL OR trim(final_status) = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_mcp_action_receipts_idempotency
  ON public.mcp_action_receipts (tenant_id, tool, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mcp_action_receipts_tenant_created
  ON public.mcp_action_receipts (tenant_id, created_at DESC);

-- ── agent_event_inbox (run_id + deduplication_key referenced by runtime) ────
ALTER TABLE IF EXISTS public.agent_event_inbox
  ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deduplication_key TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_event_inbox_run_id
  ON public.agent_event_inbox (run_id)
  WHERE run_id IS NOT NULL;

-- ── tenant_usage_events: idempotent insert under concurrent retries ─────────
CREATE OR REPLACE FUNCTION public.record_metered_usage_idempotent(
  p_tenant_id uuid,
  p_user_id uuid,
  p_resource text,
  p_amount integer DEFAULT 1,
  p_operation_id text DEFAULT NULL,
  p_initiation_source text DEFAULT 'api'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_consume jsonb;
  v_op text;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('charged', false, 'alreadyRecorded', false, 'amount', 0);
  END IF;

  v_op := NULLIF(trim(p_operation_id), '');

  IF v_op IS NOT NULL THEN
    SELECT id INTO v_existing
      FROM public.tenant_usage_events
     WHERE tenant_id = p_tenant_id
       AND operation_id = v_op
       AND quota_charged = true
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object(
        'charged', false,
        'alreadyRecorded', true,
        'operationId', v_op
      );
    END IF;
  END IF;

  v_consume := public.consume_daily_resource_quota(p_tenant_id, p_user_id, p_resource, p_amount);

  IF COALESCE((v_consume ->> 'allowed')::boolean, false) THEN
    BEGIN
      INSERT INTO public.tenant_usage_events (
        tenant_id, user_id, operation_id, initiation_source, business_action,
        success, quota_charged, quota_reason, metadata
      ) VALUES (
        p_tenant_id,
        p_user_id,
        v_op,
        COALESCE(NULLIF(trim(p_initiation_source), ''), 'api'),
        p_resource,
        true,
        true,
        format('Recorded %s x %s after successful persistence', p_amount, p_resource),
        jsonb_build_object('resource', p_resource, 'amount', p_amount)
      )
      ON CONFLICT (tenant_id, operation_id) WHERE operation_id IS NOT NULL DO NOTHING;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;

    IF v_op IS NOT NULL THEN
      SELECT id INTO v_existing
        FROM public.tenant_usage_events
       WHERE tenant_id = p_tenant_id
         AND operation_id = v_op
         AND quota_charged = true
       LIMIT 1;

      IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object(
          'charged', false,
          'alreadyRecorded', true,
          'operationId', v_op
        );
      END IF;
    END IF;
  END IF;

  RETURN v_consume || jsonb_build_object(
    'charged', COALESCE((v_consume ->> 'allowed')::boolean, false),
    'alreadyRecorded', false,
    'operationId', v_op
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_metered_usage_idempotent(uuid, uuid, text, integer, text, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
