CREATE TABLE IF NOT EXISTS public.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  run_count integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trigger_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions_met boolean NOT NULL DEFAULT false,
  actions_taken jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('success','partial','failed','skipped')),
  duration_ms integer NOT NULL DEFAULT 0,
  error_message text,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_definitions_tenant_trigger_idx ON public.workflow_definitions (tenant_id, trigger_type, is_active);
CREATE INDEX IF NOT EXISTS workflow_executions_tenant_workflow_idx ON public.workflow_executions (tenant_id, workflow_id, executed_at DESC);
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant members manage flow definitions" ON public.workflow_definitions;
CREATE POLICY "Tenant members manage flow definitions" ON public.workflow_definitions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_users member WHERE member.tenant_id = workflow_definitions.tenant_id AND member.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_users member WHERE member.tenant_id = workflow_definitions.tenant_id AND member.user_id = auth.uid()));
DROP POLICY IF EXISTS "Tenant members view flow executions" ON public.workflow_executions;
CREATE POLICY "Tenant members view flow executions" ON public.workflow_executions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_users member WHERE member.tenant_id = workflow_executions.tenant_id AND member.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.increment_workflow_definition_run(p_tenant_id uuid, p_workflow_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.workflow_definitions SET run_count = run_count + 1, last_run_at = now(), updated_at = now()
  WHERE tenant_id = p_tenant_id AND id = p_workflow_id;
$$;
REVOKE ALL ON FUNCTION public.increment_workflow_definition_run(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_workflow_definition_run(uuid, uuid) TO service_role;
