BEGIN;

ALTER TABLE public.outreach_sequences
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.marketing_segments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.outreach_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
  contact_id UUID,
  lead_id UUID,
  client_id UUID,
  normalized_recipient TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  current_step_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','waiting','completed','stopped','failed','suppressed')),
  next_step_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_event_type TEXT,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sequence_id, normalized_recipient)
);

CREATE TABLE IF NOT EXISTS public.outreach_sequence_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.outreach_sequence_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.outreach_sequence_steps(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','skipped','awaiting_approval')),
  provider TEXT,
  provider_receipt_id TEXT,
  error TEXT,
  verification JSONB NOT NULL DEFAULT '{}'::JSONB,
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 10),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (tenant_id, enrollment_id, step_id, attempt)
);

ALTER TABLE public.outreach_sequence_executions
  ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 10);
ALTER TABLE public.outreach_sequence_executions
  DROP CONSTRAINT IF EXISTS outreach_sequence_executions_tenant_id_enrollment_id_step_id_key;
-- PostgreSQL truncates generated identifiers to 63 bytes; remove the actual
-- legacy constraint name as well before adding the stable named constraint.
ALTER TABLE public.outreach_sequence_executions
  DROP CONSTRAINT IF EXISTS outreach_sequence_executions_tenant_id_enrollment_id_step_i_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outreach_sequence_execution_attempt_key') THEN
    ALTER TABLE public.outreach_sequence_executions
      ADD CONSTRAINT outreach_sequence_execution_attempt_key UNIQUE (tenant_id, enrollment_id, step_id, attempt);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_due ON public.outreach_sequence_enrollments (status, next_step_at) WHERE status IN ('active','waiting');
CREATE INDEX IF NOT EXISTS idx_sequence_executions_sequence ON public.outreach_sequence_executions (tenant_id, sequence_id, started_at DESC);

ALTER TABLE public.outreach_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sequence_executions ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE table_name TEXT; BEGIN
  FOREACH table_name IN ARRAY ARRAY['outreach_sequence_enrollments','outreach_sequence_executions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "tenant_%s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "tenant_%s" ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid()))', table_name, table_name, table_name, table_name);
  END LOOP;
END $$;

COMMIT;
