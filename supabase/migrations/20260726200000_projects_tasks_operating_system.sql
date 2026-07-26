-- Additive Projects + Tasks operating-system foundation.
-- Existing project/task rows and primary keys remain canonical. No legacy data is dropped.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS project_type text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS approved_budget numeric(18,2),
  ADD COLUMN IF NOT EXISTS estimated_hours numeric(12,2),
  ADD COLUMN IF NOT EXISTS target_date date,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS progress_method text NOT NULL DEFAULT 'weighted_tasks',
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'not_assessed',
  ADD COLUMN IF NOT EXISTS health_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

UPDATE public.projects
SET owner_user_id = owner_id,
    target_date = due_date,
    health_status = COALESCE(NULLIF(lower(health), ''), 'not_assessed')
WHERE owner_user_id IS NULL OR target_date IS NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS parent_task_id uuid,
  ADD COLUMN IF NOT EXISTS milestone_id uuid,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS progress_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weight numeric(10,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_rule_id uuid,
  ADD COLUMN IF NOT EXISTS position numeric,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

UPDATE public.tasks
SET project_id = related_to_project,
    owner_user_id = assigned_to,
    progress_percent = CASE WHEN status::text = 'completed' THEN 100 ELSE 0 END
WHERE project_id IS NULL OR owner_user_id IS NULL;

CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  allocation_percent numeric(5,2),
  access_level text NOT NULL DEFAULT 'edit',
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  UNIQUE (tenant_id, project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  owner_user_id uuid,
  target_date date,
  due_date timestamptz,
  status text NOT NULL DEFAULT 'pending',
  progress_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  completion_criteria text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_index integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.project_milestones
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS target_date date,
  ADD COLUMN IF NOT EXISTS progress_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_criteria text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.project_milestones milestone
SET tenant_id = project.tenant_id
FROM public.projects project
WHERE milestone.project_id = project.id AND milestone.tenant_id IS NULL;

CREATE TABLE IF NOT EXISTS public.project_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  deliverable_type text NOT NULL DEFAULT 'other',
  owner_user_id uuid,
  due_date date,
  status text NOT NULL DEFAULT 'planned',
  acceptance_criteria text,
  approver_user_id uuid,
  accepted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assignment_role text NOT NULL DEFAULT 'assignee',
  is_primary boolean NOT NULL DEFAULT false,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  UNIQUE (tenant_id, task_id, user_id, assignment_role)
);

INSERT INTO public.task_assignees (tenant_id, task_id, user_id, assignment_role, is_primary, assigned_by)
SELECT tenant_id, id, assigned_to, 'assignee', true, created_by
FROM public.tasks
WHERE tenant_id IS NOT NULL AND assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'finish_to_start',
  lag_minutes integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_dependencies_not_self CHECK (task_id <> depends_on_task_id),
  UNIQUE (tenant_id, task_id, depends_on_task_id, dependency_type)
);

CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  position numeric NOT NULL DEFAULT 0,
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.project_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  relationship_type text NOT NULL DEFAULT 'related',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, project_id, target_type, target_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS public.task_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  relationship_type text NOT NULL DEFAULT 'related',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, task_id, target_type, target_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS public.project_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  actor_user_id uuid,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  previous_value jsonb,
  new_value jsonb,
  source text NOT NULL DEFAULT 'user',
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text,
  probability smallint CHECK (probability BETWEEN 1 AND 5),
  impact smallint CHECK (impact BETWEEN 1 AND 5),
  owner_user_id uuid,
  mitigation text,
  contingency text,
  review_date date,
  status text NOT NULL DEFAULT 'identified',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.project_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium',
  priority text NOT NULL DEFAULT 'normal',
  owner_user_id uuid,
  status text NOT NULL DEFAULT 'open',
  root_cause text,
  resolution text,
  due_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.project_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  context text,
  decision text,
  alternatives text,
  decided_by uuid,
  decided_at timestamptz,
  impact text,
  status text NOT NULL DEFAULT 'proposed',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.task_recurrence_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  source_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  frequency text NOT NULL,
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  weekdays smallint[],
  monthly_day smallint,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  timezone text NOT NULL DEFAULT 'UTC',
  due_offset_minutes integer,
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_task_id)
);

CREATE TABLE IF NOT EXISTS public.project_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('project', 'task')),
  name text NOT NULL,
  field_type text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (tenant_id, entity_type, name)
);

CREATE TABLE IF NOT EXISTS public.project_custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  field_id uuid NOT NULL REFERENCES public.project_custom_fields(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  value jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((project_id IS NOT NULL)::int + (task_id IS NOT NULL)::int = 1)
);

CREATE TABLE IF NOT EXISTS public.project_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('project', 'task')),
  name text NOT NULL,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS projects_tenant_status_active_idx ON public.projects (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS projects_tenant_owner_active_idx ON public.projects (tenant_id, owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS projects_tenant_target_active_idx ON public.projects (tenant_id, target_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_tenant_project_status_active_idx ON public.tasks (tenant_id, project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_tenant_due_active_idx ON public.tasks (tenant_id, due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_tenant_parent_active_idx ON public.tasks (tenant_id, parent_task_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS task_assignees_user_active_idx ON public.task_assignees (tenant_id, user_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS task_dependencies_task_idx ON public.task_dependencies (tenant_id, task_id);
CREATE INDEX IF NOT EXISTS project_activity_feed_idx ON public.project_activity (tenant_id, project_id, created_at DESC);

-- Shared membership predicate. SECURITY DEFINER avoids policy recursion and does not trust client tenant IDs.
CREATE OR REPLACE FUNCTION public.is_active_tenant_member(target_tenant uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_id = target_tenant AND user_id = auth.uid()
  )
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'project_members', 'project_milestones', 'project_deliverables', 'task_assignees',
    'task_dependencies', 'task_checklist_items', 'project_relationships', 'task_relationships',
    'project_activity', 'project_risks', 'project_issues', 'project_decisions',
    'task_recurrence_rules', 'project_custom_fields', 'project_custom_field_values',
    'project_saved_views'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_member_access ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_member_access ON public.%I FOR ALL TO authenticated USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id))',
      table_name
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.project_members IS 'Normalized collaborative membership; legacy projects.team remains during compatibility period.';
COMMENT ON TABLE public.task_assignees IS 'Normalized collaborative assignment; legacy tasks.assigned_to remains during compatibility period.';
