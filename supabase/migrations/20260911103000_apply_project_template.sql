-- Atomically instantiate Projects V2 templates into canonical milestones, tasks and dependencies.
-- Retries are protected by project_template_applications.

CREATE OR REPLACE FUNCTION public.apply_project_template(
  p_tenant_id uuid,
  p_project_id uuid,
  p_template_id uuid,
  p_start_date date DEFAULT CURRENT_DATE,
  p_idempotency_key text DEFAULT NULL,
  p_applied_by uuid DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template public.project_templates%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_existing public.project_template_applications%ROWTYPE;
  v_application_id uuid;
  v_phase record;
  v_task record;
  v_dependency record;
  v_milestone_id uuid;
  v_task_id uuid;
  v_dependency_task_id uuid;
  v_depends_on_task_id uuid;
  v_result jsonb;
  v_milestone_ids jsonb := '{}'::jsonb;
  v_task_ids jsonb := '{}'::jsonb;
  v_created_milestones integer := 0;
  v_created_tasks integer := 0;
  v_created_dependencies integer := 0;
  v_key text;
BEGIN
  IF p_tenant_id IS NULL OR p_project_id IS NULL OR p_template_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id, project_id and template_id are required';
  END IF;

  v_key := COALESCE(NULLIF(p_idempotency_key, ''),
    format('project-template:%s:%s:%s', p_project_id, p_template_id, p_start_date));

  SELECT * INTO v_project
  FROM public.projects
  WHERE id = p_project_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found';
  END IF;

  SELECT * INTO v_template
  FROM public.project_templates
  WHERE id = p_template_id
    AND tenant_id = p_tenant_id
    AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_template_not_found';
  END IF;

  SELECT * INTO v_existing
  FROM public.project_template_applications
  WHERE tenant_id = p_tenant_id
    AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'duplicate', true,
      'application_id', v_existing.id,
      'result', v_existing.result
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.project_template_applications
  WHERE project_id = p_project_id
    AND template_id = p_template_id
    AND template_version = v_template.version;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'duplicate', true,
      'application_id', v_existing.id,
      'result', v_existing.result
    );
  END IF;

  INSERT INTO public.project_template_applications (
    tenant_id, project_id, template_id, template_version,
    idempotency_key, correlation_id, applied_by, result
  ) VALUES (
    p_tenant_id, p_project_id, p_template_id, v_template.version,
    v_key, p_correlation_id, p_applied_by, '{}'::jsonb
  )
  RETURNING id INTO v_application_id;

  FOR v_phase IN
    SELECT * FROM public.project_template_phases
    WHERE tenant_id = p_tenant_id
      AND template_id = p_template_id
    ORDER BY order_index, created_at
  LOOP
    INSERT INTO public.project_milestones (
      tenant_id, project_id, name, description, target_date, due_date,
      status, progress_percent, metadata, order_index, created_by
    ) VALUES (
      p_tenant_id,
      p_project_id,
      v_phase.name,
      v_phase.description,
      p_start_date + COALESCE(v_phase.relative_days_from_start, 0),
      (p_start_date + COALESCE(v_phase.relative_days_from_start, 0))::timestamptz,
      'pending',
      0,
      COALESCE(v_phase.metadata, '{}'::jsonb) || jsonb_build_object(
        'template_id', p_template_id,
        'template_phase_id', v_phase.id,
        'template_application_id', v_application_id
      ),
      v_phase.order_index,
      p_applied_by
    )
    RETURNING id INTO v_milestone_id;

    v_milestone_ids := v_milestone_ids || jsonb_build_object(v_phase.id::text, v_milestone_id);
    v_created_milestones := v_created_milestones + 1;
  END LOOP;

  FOR v_task IN
    SELECT * FROM public.project_template_tasks
    WHERE tenant_id = p_tenant_id
      AND template_id = p_template_id
    ORDER BY order_index, created_at
  LOOP
    v_milestone_id := NULL;
    IF v_task.phase_id IS NOT NULL THEN
      v_milestone_id := NULLIF(v_milestone_ids ->> v_task.phase_id::text, '')::uuid;
    END IF;

    INSERT INTO public.tasks (
      tenant_id, project_id, related_to_project, milestone_id,
      title, description, priority, status, start_date, due_date,
      weight, requires_approval, position, created_by
    ) VALUES (
      p_tenant_id,
      p_project_id,
      p_project_id,
      v_milestone_id,
      v_task.title,
      v_task.description,
      COALESCE(v_task.priority, 'medium'),
      'todo',
      (p_start_date + COALESCE(v_task.relative_start_days, 0))::timestamptz,
      CASE WHEN v_task.relative_due_days IS NULL THEN NULL
        ELSE (p_start_date + v_task.relative_due_days)::timestamptz END,
      COALESCE(v_task.weight, 1),
      COALESCE(v_task.requires_approval, false),
      v_task.order_index,
      p_applied_by
    )
    RETURNING id INTO v_task_id;

    v_task_ids := v_task_ids || jsonb_build_object(v_task.task_key, v_task_id);
    v_created_tasks := v_created_tasks + 1;
  END LOOP;

  FOR v_dependency IN
    SELECT * FROM public.project_template_dependencies
    WHERE tenant_id = p_tenant_id
      AND template_id = p_template_id
    ORDER BY created_at
  LOOP
    v_dependency_task_id := NULLIF(v_task_ids ->> v_dependency.task_key, '')::uuid;
    v_depends_on_task_id := NULLIF(v_task_ids ->> v_dependency.depends_on_task_key, '')::uuid;

    IF v_dependency_task_id IS NULL OR v_depends_on_task_id IS NULL THEN
      RAISE EXCEPTION 'template_dependency_references_unknown_task: % -> %',
        v_dependency.task_key, v_dependency.depends_on_task_key;
    END IF;

    INSERT INTO public.task_dependencies (
      tenant_id, task_id, depends_on_task_id, dependency_type, lag_minutes, created_by
    ) VALUES (
      p_tenant_id,
      v_dependency_task_id,
      v_depends_on_task_id,
      COALESCE(v_dependency.dependency_type, 'finish_to_start'),
      COALESCE(v_dependency.lag_minutes, 0),
      p_applied_by
    )
    ON CONFLICT (tenant_id, task_id, depends_on_task_id, dependency_type) DO NOTHING;

    v_created_dependencies := v_created_dependencies + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'template_id', p_template_id,
    'template_version', v_template.version,
    'milestone_ids', v_milestone_ids,
    'task_ids', v_task_ids,
    'created_milestones', v_created_milestones,
    'created_tasks', v_created_tasks,
    'created_dependencies', v_created_dependencies
  );

  UPDATE public.project_template_applications
  SET result = v_result,
      correlation_id = COALESCE(p_correlation_id, correlation_id),
      applied_at = now()
  WHERE id = v_application_id;

  INSERT INTO public.project_activity (
    tenant_id, project_id, activity_type, title, description, actor_user_id, metadata, created_at
  ) VALUES (
    p_tenant_id,
    p_project_id,
    'template_applied',
    'Project template applied',
    v_template.name,
    p_applied_by,
    jsonb_build_object(
      'template_id', p_template_id,
      'template_version', v_template.version,
      'application_id', v_application_id,
      'correlation_id', p_correlation_id,
      'result', v_result
    ),
    now()
  );

  RETURN jsonb_build_object(
    'duplicate', false,
    'application_id', v_application_id,
    'result', v_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_project_template(uuid, uuid, uuid, date, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_project_template(uuid, uuid, uuid, date, text, uuid, text) TO service_role;
