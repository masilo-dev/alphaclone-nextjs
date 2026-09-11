-- Non-destructive rollback: preserve all newly written records and remove only policies
-- that could affect application access. Columns and tables intentionally remain archived
-- for recovery; permanent removal belongs in a later reviewed release.
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
    EXECUTE format('DROP POLICY IF EXISTS tenant_member_access ON public.%I', table_name);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.is_active_tenant_member(uuid) IS
  'Retained by rollback because other additive modules may safely reuse this membership predicate.';
