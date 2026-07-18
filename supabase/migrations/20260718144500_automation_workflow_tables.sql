CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL DEFAULT 'manual_trigger',
  trigger_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  is_template boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_order integer NOT NULL,
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  delay_minutes integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, action_order)
);

CREATE TABLE IF NOT EXISTS public.automation_workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','running','completed','failed','cancelled')),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  executed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL DEFAULT 'manual_trigger',
  trigger_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflows_tenant_created_idx ON public.workflows (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS workflow_actions_tenant_workflow_idx ON public.workflow_actions (tenant_id, workflow_id, action_order);
CREATE INDEX IF NOT EXISTS automation_workflow_executions_tenant_workflow_idx ON public.automation_workflow_executions (tenant_id, workflow_id, executed_at DESC);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members manage workflows" ON public.workflows;
CREATE POLICY "Tenant members manage workflows" ON public.workflows FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_users member WHERE member.tenant_id = workflows.tenant_id AND member.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_users member WHERE member.tenant_id = workflows.tenant_id AND member.user_id = auth.uid()));
DROP POLICY IF EXISTS "Tenant members manage workflow actions" ON public.workflow_actions;
CREATE POLICY "Tenant members manage workflow actions" ON public.workflow_actions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_users member WHERE member.tenant_id = workflow_actions.tenant_id AND member.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_users member WHERE member.tenant_id = workflow_actions.tenant_id AND member.user_id = auth.uid()));
DROP POLICY IF EXISTS "Tenant members view workflow executions" ON public.automation_workflow_executions;
CREATE POLICY "Tenant members view workflow executions" ON public.automation_workflow_executions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_users member WHERE member.tenant_id = automation_workflow_executions.tenant_id AND member.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users view workflow templates" ON public.workflow_templates;
CREATE POLICY "Users view workflow templates" ON public.workflow_templates FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR EXISTS (SELECT 1 FROM public.tenant_users member WHERE member.tenant_id = workflow_templates.tenant_id AND member.user_id = auth.uid()));
