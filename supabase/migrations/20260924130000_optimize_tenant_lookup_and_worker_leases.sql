-- ==============================================================================
-- Migration: 20260924130000_optimize_tenant_lookup_and_worker_leases.sql
-- Production Performance Repair:
-- 1. Optimize get_user_tenant_ids() (eliminate row-to-jsonb overhead)
-- 2. Index agent_worker_leases(task_id, lease_token) for heartbeat lookups
-- 3. Index autonomous_runner_actions(tenant_id, created_at DESC) for workspace snapshots
-- 4. Complete unscheduling of all remaining duplicate HTTP pg_cron jobs
-- ==============================================================================

-- 1. Optimize get_user_tenant_ids()
-- Removes the expensive to_jsonb(tu) serialization and short-circuits if auth.uid() is null
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS TABLE (tenant_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public, auth
AS $$
  SELECT tu.tenant_id
  FROM public.tenant_users tu
  WHERE auth.uid() IS NOT NULL
    AND tu.user_id = auth.uid();
$$;

-- 2. Index agent_worker_leases(task_id, lease_token)
-- Eliminates sequential table scans on worker heartbeats and lease renewals
CREATE INDEX IF NOT EXISTS idx_agent_worker_leases_task_token
  ON public.agent_worker_leases (task_id, lease_token)
  WHERE status = 'active';

-- 3. Index autonomous_runner_actions(tenant_id, created_at DESC)
-- Eliminates sequential table scans during workspace snapshot queries
CREATE INDEX IF NOT EXISTS idx_autonomous_runner_actions_tenant_created
  ON public.autonomous_runner_actions (tenant_id, created_at DESC);

-- 4. Unschedule remaining duplicate HTTP pg_cron jobs
DO $$
DECLARE
  v_job text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR v_job IN SELECT jobname FROM cron.job WHERE jobname IN (
      'process-task-reminders',
      'process-scheduled-ai-tasks',
      'process-invoice-overdue-reminders',
      'reconcile-social-posts'
    )
    LOOP
      PERFORM cron.unschedule(v_job);
      RAISE NOTICE 'Unscheduled duplicate pg_cron job %', v_job;
    END LOOP;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
