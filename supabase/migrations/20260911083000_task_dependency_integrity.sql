-- Projects V2 dependency integrity
-- Additive, tenant-safe guard for all writers (UI, API, MCP, Bonnie, workers).

CREATE OR REPLACE FUNCTION public.enforce_task_dependency_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_tenant uuid;
  dependency_tenant uuid;
  cycle_exists boolean := false;
BEGIN
  IF NEW.task_id = NEW.depends_on_task_id THEN
    RAISE EXCEPTION 'Task dependency cannot reference itself'
      USING ERRCODE = '23514';
  END IF;

  SELECT tenant_id INTO source_tenant
  FROM public.tasks
  WHERE id = NEW.task_id;

  SELECT tenant_id INTO dependency_tenant
  FROM public.tasks
  WHERE id = NEW.depends_on_task_id;

  IF source_tenant IS NULL OR dependency_tenant IS NULL THEN
    RAISE EXCEPTION 'Task dependency references a task that does not exist'
      USING ERRCODE = '23503';
  END IF;

  IF source_tenant <> NEW.tenant_id OR dependency_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Task dependency must stay within one tenant'
      USING ERRCODE = '42501';
  END IF;

  WITH RECURSIVE dependency_chain(task_id) AS (
    SELECT NEW.depends_on_task_id
    UNION
    SELECT td.depends_on_task_id
    FROM public.task_dependencies td
    JOIN dependency_chain dc ON td.task_id = dc.task_id
    WHERE td.tenant_id = NEW.tenant_id
      AND (TG_OP <> 'UPDATE' OR td.id <> NEW.id)
  )
  SELECT EXISTS (
    SELECT 1
    FROM dependency_chain
    WHERE task_id = NEW.task_id
  ) INTO cycle_exists;

  IF cycle_exists THEN
    RAISE EXCEPTION 'Task dependency would create a cycle'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_dependencies_integrity_guard
ON public.task_dependencies;

CREATE TRIGGER task_dependencies_integrity_guard
BEFORE INSERT OR UPDATE OF tenant_id, task_id, depends_on_task_id
ON public.task_dependencies
FOR EACH ROW
EXECUTE FUNCTION public.enforce_task_dependency_integrity();

COMMENT ON FUNCTION public.enforce_task_dependency_integrity() IS
'Prevents self/cyclic/cross-tenant task dependencies for every task_dependencies writer.';
