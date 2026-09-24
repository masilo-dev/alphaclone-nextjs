-- ==============================================================================
-- Migration: 20260924110000_database_performance_and_reliability_repair.sql
-- Production Supabase & Database Performance and Reliability Repair
--
-- 1. Fix is_super_admin() permission denied & RLS InitPlan optimization
-- 2. Add missing columns on email_campaigns and lead_outreach_log (fixing 400 Bad Requests)
-- 3. Composite & partial indexes for hot queues and polling tables
-- 4. Unschedule duplicate pg_cron jobs that duplicate Railway cron runners
-- 5. Notify PostgREST schema cache reload
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX FUNCTION PERMISSIONS & DEFINITION FOR is_super_admin()
-- ------------------------------------------------------------------------------
-- Ensure is_super_admin() is STABLE, SECURITY DEFINER, with search_path pinned.
-- CRITICAL: When auth.uid() is NULL, return false immediately so unauthenticated
-- requests evaluate safely without inspecting tables or raising permissions errors.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND (account_status IS NULL OR account_status = 'active')
      AND lower(COALESCE(role::text, '')) IN ('super_admin', 'admin', 'platform_admin', 'platform_owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = pg_catalog, public, auth;

-- Grant EXECUTE to anon, authenticated, and service_role.
-- Anon MUST have execute privilege because RLS policies evaluated for anon queries
-- contain calls to is_super_admin(). Since the function returns false immediately
-- when auth.uid() is null, this is completely secure and eliminates the permission denied error.
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. OPTIMIZE RLS POLICIES WITH InitPlan (SELECT public.is_super_admin())
-- ------------------------------------------------------------------------------
-- Wrapping public.is_super_admin() in (SELECT public.is_super_admin()) causes
-- PostgreSQL query planner to evaluate it ONCE per query (as an InitPlan)
-- rather than row-by-row on large table scans.

-- leads
DROP POLICY IF EXISTS "Tenant members manage leads" ON public.leads;
CREATE POLICY "Tenant members manage leads"
  ON public.leads
  FOR ALL
  USING (
    (SELECT public.is_super_admin())
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  )
  WITH CHECK (
    (SELECT public.is_super_admin())
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  );

-- lead_activities
DROP POLICY IF EXISTS "Tenant members manage lead activities" ON public.lead_activities;
CREATE POLICY "Tenant members manage lead activities"
  ON public.lead_activities
  FOR ALL
  USING (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_activities.lead_id
        AND l.tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
    )
  )
  WITH CHECK (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_activities.lead_id
        AND l.tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
    )
  );

-- business_invoices
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_invoices') THEN
    DROP POLICY IF EXISTS "tenant_invoices_admin_delete" ON public.business_invoices;
    DROP POLICY IF EXISTS "Tenant members manage invoices" ON public.business_invoices;
    CREATE POLICY "Tenant members manage invoices"
      ON public.business_invoices
      FOR ALL
      USING (
        (SELECT public.is_super_admin())
        OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
      )
      WITH CHECK (
        (SELECT public.is_super_admin())
        OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
      );
  END IF;
END $$;

-- business_invoice_items
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_invoice_items') THEN
    DROP POLICY IF EXISTS "Tenant members manage invoice items" ON public.business_invoice_items;
    CREATE POLICY "Tenant members manage invoice items"
      ON public.business_invoice_items
      FOR ALL
      USING (
        (SELECT public.is_super_admin())
        OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
      )
      WITH CHECK (
        (SELECT public.is_super_admin())
        OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
      );
  END IF;
END $$;

-- business_invoice_payments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_invoice_payments') THEN
    DROP POLICY IF EXISTS "Tenant members manage invoice payments" ON public.business_invoice_payments;
    CREATE POLICY "Tenant members manage invoice payments"
      ON public.business_invoice_payments
      FOR ALL
      USING (
        (SELECT public.is_super_admin())
        OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
      )
      WITH CHECK (
        (SELECT public.is_super_admin())
        OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
      );
  END IF;
END $$;

-- sales_forecasts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_forecasts') THEN
    DROP POLICY IF EXISTS "sales_forecasts_tenant_select" ON public.sales_forecasts;
    DROP POLICY IF EXISTS "sales_forecasts_tenant_all" ON public.sales_forecasts;
    CREATE POLICY "sales_forecasts_tenant_all"
      ON public.sales_forecasts
      FOR ALL
      USING (
        (SELECT public.is_super_admin())
        OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
      )
      WITH CHECK (
        (SELECT public.is_super_admin())
        OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
      );
  END IF;
END $$;

-- deal_intelligence_events
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deal_intelligence_events') THEN
    DROP POLICY IF EXISTS "deal_intelligence_events_tenant_select" ON public.deal_intelligence_events;
    DROP POLICY IF EXISTS "deal_intelligence_events_tenant_all" ON public.deal_intelligence_events;
    CREATE POLICY "deal_intelligence_events_tenant_all"
      ON public.deal_intelligence_events
      FOR ALL
      USING (
        (SELECT public.is_super_admin())
        OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
      )
      WITH CHECK (
        (SELECT public.is_super_admin())
        OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. CATCH-UP MISSING COLUMNS (FIXING POSTGREST 400 BAD REQUEST ERRORS)
-- ------------------------------------------------------------------------------

-- email_campaigns missing columns expected by POST /api/email/campaigns and campaign runner
ALTER TABLE IF EXISTS public.email_campaigns
  ADD COLUMN IF NOT EXISTS from_name text,
  ADD COLUMN IF NOT EXISTS from_email text,
  ADD COLUMN IF NOT EXISTS reply_to text,
  ADD COLUMN IF NOT EXISTS segment_filter jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_recipients integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- lead_outreach_log missing campaign_name expected by /api/dashboard/action-queue
ALTER TABLE IF EXISTS public.lead_outreach_log
  ADD COLUMN IF NOT EXISTS campaign_name text;

-- ------------------------------------------------------------------------------
-- 4. PARTIAL & COMPOSITE PERFORMANCE INDEXES FOR QUEUES & POLLED TABLES
-- ------------------------------------------------------------------------------

-- agent_event_outbox: Outbox sweeper queries pending/failed rows due for attempt ordered by created_at
CREATE INDEX IF NOT EXISTS idx_agent_event_outbox_pending_work
  ON public.agent_event_outbox (next_attempt_at, created_at ASC)
  WHERE delivery_status IN ('pending', 'failed');

-- automation_runs: Retry sweeper queries failed runs with retries < 3 ordered by updated_at
CREATE INDEX IF NOT EXISTS idx_automation_runs_retry_queue
  ON public.automation_runs (updated_at ASC)
  WHERE status = 'failed' AND retries < 3;

CREATE INDEX IF NOT EXISTS idx_automation_runs_tenant_status_updated
  ON public.automation_runs (tenant_id, status, updated_at DESC);

-- social_post_sync_queue: Sync sweeper queries unprocessed entries ordered by created_at
CREATE INDEX IF NOT EXISTS idx_social_post_sync_queue_pending
  ON public.social_post_sync_queue (created_at ASC)
  WHERE processed_at IS NULL;

-- social_posts: LinkedIn sync worker queries tenant posts with linkedin_post_urn ordered by created_at
CREATE INDEX IF NOT EXISTS idx_social_posts_linkedin_sync
  ON public.social_posts (tenant_id, created_at DESC)
  WHERE linkedin_post_urn IS NOT NULL;

-- lead_outreach_log: Dashboard action queue and inbox queries
CREATE INDEX IF NOT EXISTS idx_lead_outreach_log_tenant_status_created
  ON public.lead_outreach_log (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_outreach_log_tenant_created
  ON public.lead_outreach_log (tenant_id, created_at DESC);

-- business_clients: CRM client list query with tenant + is_active + created_at
CREATE INDEX IF NOT EXISTS idx_business_clients_tenant_active_created
  ON public.business_clients (tenant_id, is_active, created_at DESC);

-- email_campaigns: Campaign management list view
CREATE INDEX IF NOT EXISTS idx_email_campaigns_tenant_status_created
  ON public.email_campaigns (tenant_id, status, created_at DESC);

-- failure_records: Operations dashboard recent failure records
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'failure_records') THEN
    CREATE INDEX IF NOT EXISTS idx_failure_records_tenant_status_time
      ON public.failure_records (tenant_id, status, failure_time DESC);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. UNSCHEDULE DUPLICATE PG_CRON JOBS (PREVENTS WORKER TIMEOUTS & 503 STORMS)
-- ------------------------------------------------------------------------------
-- Railway crons (configured in railway.crons.json) are the authoritative runners
-- for HTTP cron endpoints. Having pg_cron concurrently invoke net.http_get every
-- 1-2 minutes exhausts PostgreSQL background worker processes (yielding 452 cron startup
-- timeouts) and floods Supavisor connection pools.
DO $unschedule$
DECLARE
  v_job text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR v_job IN SELECT jobname FROM cron.job WHERE jobname IN (
      'bonnie-runtime-worker',
      'bonnie-runtime-outbox',
      'bonnie-runtime-reconcile',
      'bonnie-runtime-timers',
      'process-events',
      'social-publish',
      'process-mcp-event-queue',
      'retry-failed'
    )
    LOOP
      PERFORM cron.unschedule(v_job);
      RAISE NOTICE 'Unscheduled duplicate pg_cron job %', v_job;
    END LOOP;
  END IF;
END $unschedule$;

-- ------------------------------------------------------------------------------
-- 6. RELOAD POSTGREST SCHEMA CACHE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
