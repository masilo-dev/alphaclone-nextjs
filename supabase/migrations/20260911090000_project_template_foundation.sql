-- Projects V2 canonical template foundation.
-- Reuses the existing project_templates/project_template_phases contract already consumed by the UI/API.

CREATE TABLE IF NOT EXISTS public.project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  template_key text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_templates ADD COLUMN IF NOT EXISTS template_key text;
ALTER TABLE public.project_templates ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.project_templates ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.project_templates ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.project_templates ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.project_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ux_project_templates_tenant_name
  ON public.project_templates (tenant_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS ux_project_templates_tenant_key
  ON public.project_templates (tenant_id, template_key)
  WHERE template_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_templates_tenant_active
  ON public.project_templates (tenant_id, is_active, name);

CREATE TABLE IF NOT EXISTS public.project_template_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  relative_days_from_start integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_template_phases ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.project_template_phases ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.project_template_phases ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.project_template_phases p
SET tenant_id = t.tenant_id
FROM public.project_templates t
WHERE p.template_id = t.id
  AND p.tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_project_template_phases_order
  ON public.project_template_phases (template_id, order_index);
CREATE INDEX IF NOT EXISTS idx_project_template_phases_tenant_template
  ON public.project_template_phases (tenant_id, template_id, order_index);

CREATE TABLE IF NOT EXISTS public.project_template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.project_template_phases(id) ON DELETE SET NULL,
  task_key text NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium',
  relative_start_days integer NOT NULL DEFAULT 0,
  relative_due_days integer,
  weight numeric NOT NULL DEFAULT 1 CHECK (weight >= 0),
  requires_approval boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, task_key)
);

CREATE INDEX IF NOT EXISTS idx_project_template_tasks_tenant_template
  ON public.project_template_tasks (tenant_id, template_id, order_index);

CREATE TABLE IF NOT EXISTS public.project_template_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  task_key text NOT NULL,
  depends_on_task_key text NOT NULL,
  dependency_type text NOT NULL DEFAULT 'finish_to_start',
  lag_minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (task_key <> depends_on_task_key),
  UNIQUE (template_id, task_key, depends_on_task_key, dependency_type)
);

CREATE INDEX IF NOT EXISTS idx_project_template_dependencies_tenant_template
  ON public.project_template_dependencies (tenant_id, template_id);

CREATE TABLE IF NOT EXISTS public.project_template_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.project_templates(id) ON DELETE RESTRICT,
  template_version integer NOT NULL,
  idempotency_key text NOT NULL,
  correlation_id text,
  applied_by uuid,
  applied_at timestamptz NOT NULL DEFAULT now(),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (project_id, template_id, template_version)
);

CREATE INDEX IF NOT EXISTS idx_project_template_applications_project
  ON public.project_template_applications (tenant_id, project_id, applied_at DESC);

CREATE OR REPLACE FUNCTION public.seed_default_project_templates(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  template_record record;
BEGIN
  INSERT INTO public.project_templates (tenant_id, template_key, name, description, version, is_active, metadata)
  VALUES
    (p_tenant_id, 'website-development', 'Website Development', 'Discovery through launch and handover.', 1, true, '{"system":true}'::jsonb),
    (p_tenant_id, 'consulting', 'Consulting', 'Structured consulting engagement from discovery to recommendations.', 1, true, '{"system":true}'::jsonb),
    (p_tenant_id, 'software-development', 'Software Development', 'Plan, build, validate and release software.', 1, true, '{"system":true}'::jsonb),
    (p_tenant_id, 'marketing-campaign', 'Marketing Campaign', 'Campaign strategy, production, launch and optimization.', 1, true, '{"system":true}'::jsonb),
    (p_tenant_id, 'social-media-management', 'Social Media Management', 'Content planning, production, publishing and reporting.', 1, true, '{"system":true}'::jsonb),
    (p_tenant_id, 'client-onboarding', 'Client Onboarding', 'Collect requirements, provision access and complete kickoff.', 1, true, '{"system":true}'::jsonb),
    (p_tenant_id, 'custom', 'Custom', 'Flexible starting point for a custom project lifecycle.', 1, true, '{"system":true}'::jsonb)
  ON CONFLICT (tenant_id, name) DO UPDATE SET
    description = EXCLUDED.description,
    template_key = COALESCE(public.project_templates.template_key, EXCLUDED.template_key),
    updated_at = now();

  FOR template_record IN
    SELECT id, template_key FROM public.project_templates
    WHERE tenant_id = p_tenant_id
      AND template_key IN ('website-development','consulting','software-development','marketing-campaign','social-media-management','client-onboarding','custom')
  LOOP
    IF template_record.template_key = 'website-development' THEN
      INSERT INTO public.project_template_phases (tenant_id, template_id, name, description, order_index, relative_days_from_start)
      VALUES
        (p_tenant_id, template_record.id, 'Discovery', 'Requirements, goals and content inputs.', 0, 0),
        (p_tenant_id, template_record.id, 'Design', 'Information architecture and visual approval.', 1, 7),
        (p_tenant_id, template_record.id, 'Build', 'Implementation and content population.', 2, 14),
        (p_tenant_id, template_record.id, 'QA', 'Functional, content and launch checks.', 3, 24),
        (p_tenant_id, template_record.id, 'Launch', 'Production release and handover.', 4, 30)
      ON CONFLICT (template_id, order_index) DO NOTHING;
    ELSIF template_record.template_key = 'consulting' THEN
      INSERT INTO public.project_template_phases (tenant_id, template_id, name, description, order_index, relative_days_from_start)
      VALUES
        (p_tenant_id, template_record.id, 'Discovery', 'Stakeholder goals and baseline evidence.', 0, 0),
        (p_tenant_id, template_record.id, 'Analysis', 'Evaluate evidence and identify options.', 1, 7),
        (p_tenant_id, template_record.id, 'Recommendations', 'Prepare recommendations and decision support.', 2, 14),
        (p_tenant_id, template_record.id, 'Handover', 'Review outcomes and next actions.', 3, 21)
      ON CONFLICT (template_id, order_index) DO NOTHING;
    ELSIF template_record.template_key = 'software-development' THEN
      INSERT INTO public.project_template_phases (tenant_id, template_id, name, description, order_index, relative_days_from_start)
      VALUES
        (p_tenant_id, template_record.id, 'Planning', 'Scope, architecture and acceptance criteria.', 0, 0),
        (p_tenant_id, template_record.id, 'Implementation', 'Build the agreed increment.', 1, 7),
        (p_tenant_id, template_record.id, 'Validation', 'Test behavior, security and acceptance criteria.', 2, 21),
        (p_tenant_id, template_record.id, 'Release', 'Deploy, observe and hand over.', 3, 28)
      ON CONFLICT (template_id, order_index) DO NOTHING;
    ELSIF template_record.template_key = 'marketing-campaign' THEN
      INSERT INTO public.project_template_phases (tenant_id, template_id, name, description, order_index, relative_days_from_start)
      VALUES
        (p_tenant_id, template_record.id, 'Strategy', 'Audience, offer, channels and measurement.', 0, 0),
        (p_tenant_id, template_record.id, 'Production', 'Create campaign assets and copy.', 1, 5),
        (p_tenant_id, template_record.id, 'Launch', 'Approve and publish campaign.', 2, 12),
        (p_tenant_id, template_record.id, 'Optimization', 'Review results and iterate.', 3, 19)
      ON CONFLICT (template_id, order_index) DO NOTHING;
    ELSIF template_record.template_key = 'social-media-management' THEN
      INSERT INTO public.project_template_phases (tenant_id, template_id, name, description, order_index, relative_days_from_start)
      VALUES
        (p_tenant_id, template_record.id, 'Plan', 'Content pillars and publishing calendar.', 0, 0),
        (p_tenant_id, template_record.id, 'Produce', 'Create and review content.', 1, 5),
        (p_tenant_id, template_record.id, 'Publish', 'Schedule and publish approved content.', 2, 10),
        (p_tenant_id, template_record.id, 'Report', 'Summarize performance and next actions.', 3, 28)
      ON CONFLICT (template_id, order_index) DO NOTHING;
    ELSIF template_record.template_key = 'client-onboarding' THEN
      INSERT INTO public.project_template_phases (tenant_id, template_id, name, description, order_index, relative_days_from_start)
      VALUES
        (p_tenant_id, template_record.id, 'Intake', 'Collect required client information.', 0, 0),
        (p_tenant_id, template_record.id, 'Access', 'Provision accounts, access and integrations.', 1, 2),
        (p_tenant_id, template_record.id, 'Kickoff', 'Confirm responsibilities, cadence and first deliverables.', 2, 5),
        (p_tenant_id, template_record.id, 'Activated', 'Verify onboarding completion.', 3, 7)
      ON CONFLICT (template_id, order_index) DO NOTHING;
    ELSE
      INSERT INTO public.project_template_phases (tenant_id, template_id, name, description, order_index, relative_days_from_start)
      VALUES (p_tenant_id, template_record.id, 'Execution', 'Custom project execution phase.', 0, 0)
      ON CONFLICT (template_id, order_index) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- Seed existing workspaces.
DO $$
DECLARE tenant_record record;
BEGIN
  FOR tenant_record IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_default_project_templates(tenant_record.id);
  END LOOP;
END;
$$;

-- Seed new workspaces without replacing the existing tenant creation flow.
CREATE OR REPLACE FUNCTION public.seed_project_templates_after_tenant_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_project_templates(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_project_templates_after_tenant_insert ON public.tenants;
CREATE TRIGGER seed_project_templates_after_tenant_insert
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.seed_project_templates_after_tenant_insert();
