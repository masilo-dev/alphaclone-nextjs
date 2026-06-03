-- ============================================================================
-- ALPHACLONE: CRON JOBS & FUNCTIONS DATABASE SCHEMA
-- ============================================================================
-- Paste into Supabase SQL Editor. All guards: IF NOT EXISTS / IF EXISTS.
-- Tables required by every cron job, workflow, and MCP function.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. AUTOMATION EVENT BUS
-- Used by: /api/cron/process-events, /api/cron/retry-failed
-- lib/automation/emit-event.ts writes here; cron polls & dispatches workflows
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.business_automation_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  processed   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automation_events_unprocessed
  ON public.business_automation_events (tenant_id, created_at ASC)
  WHERE processed = false;

ALTER TABLE public.business_automation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_events" ON public.business_automation_events;
CREATE POLICY "service_role_manage_events" ON public.business_automation_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tenant_read_events" ON public.business_automation_events;
CREATE POLICY "tenant_read_events" ON public.business_automation_events
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ============================================================================
-- 2. AUTOMATION RUNS (Playbook / Workflow Execution Log)
-- Used by: runtimeService.ts, process-events, retry-failed, lead-flows
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  playbook_id      TEXT,
  workflow_type    TEXT,
  status           TEXT NOT NULL DEFAULT 'running'
                     CHECK (status IN ('running','completed','failed','cancelled','retrying','approval_required')),
  inputs           JSONB NOT NULL DEFAULT '{}',
  policy           JSONB NOT NULL DEFAULT '{}',
  last_error       TEXT,
  idempotency_key  TEXT,
  retries          INTEGER NOT NULL DEFAULT 0,
  steps            JSONB,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automation_runs_tenant_status
  ON public.automation_runs (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_idempotency
  ON public.automation_runs (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_runs" ON public.automation_runs;
CREATE POLICY "service_role_manage_runs" ON public.automation_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tenant_read_runs" ON public.automation_runs;
CREATE POLICY "tenant_read_runs" ON public.automation_runs
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ============================================================================
-- 3. AUTOMATION RUN STEPS
-- Used by: runtimeService.ts (step-by-step playbook execution)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.automation_run_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  run_id        UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  step_id       TEXT NOT NULL,
  action        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','failed','cancelled','approval_required')),
  risk_level    TEXT CHECK (risk_level IN ('low','medium','high')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  output        JSONB,
  error_message TEXT,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automation_run_steps_run_id
  ON public.automation_run_steps (run_id, created_at ASC);

ALTER TABLE public.automation_run_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_steps" ON public.automation_run_steps;
CREATE POLICY "service_role_manage_steps" ON public.automation_run_steps
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tenant_read_steps" ON public.automation_run_steps;
CREATE POLICY "tenant_read_steps" ON public.automation_run_steps
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ============================================================================
-- 4. AUTOMATION CRON LOGS
-- Used by: process-events, retry-failed (logCron helper)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.automation_cron_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('success','failed','skipped')),
  payload       JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  ran_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automation_cron_logs_trigger
  ON public.automation_cron_logs (trigger_type, ran_at DESC);

ALTER TABLE public.automation_cron_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_cron_logs" ON public.automation_cron_logs;
CREATE POLICY "service_role_manage_cron_logs" ON public.automation_cron_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "super_admin_read_cron_logs" ON public.automation_cron_logs;
CREATE POLICY "super_admin_read_cron_logs" ON public.automation_cron_logs
  FOR SELECT USING ((auth.jwt() ->> 'role') = 'super_admin');

-- ============================================================================
-- 5. SCHEDULED AI TASKS
-- Used by: processScheduledAiTasks, autonomousRunner, taskAutomationService
-- MCP schedules tasks here; cron picks them up and executes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.scheduled_ai_tasks (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name                     TEXT NOT NULL,
  prompt                   TEXT NOT NULL,
  schedule                 TEXT NOT NULL,
  timezone                 TEXT NOT NULL DEFAULT 'UTC',
  notification_preference  JSONB NOT NULL DEFAULT '{"email": true}',
  status                   TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
  last_run_at              TIMESTAMPTZ,
  next_run_at              TIMESTAMPTZ,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_ai_tasks_due
  ON public.scheduled_ai_tasks (tenant_id, next_run_at ASC)
  WHERE status = 'active';

ALTER TABLE public.scheduled_ai_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_manage_ai_tasks" ON public.scheduled_ai_tasks;
CREATE POLICY "tenant_manage_ai_tasks" ON public.scheduled_ai_tasks
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ============================================================================
-- 6. SCHEDULED AI TASK RESULTS
-- Used by: taskAutomationService.executeTask
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.scheduled_ai_task_results (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id   UUID NOT NULL REFERENCES public.scheduled_ai_tasks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  output    TEXT,
  status    TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','failure')),
  error     TEXT,
  ran_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_task_results_task
  ON public.scheduled_ai_task_results (task_id, ran_at DESC);

ALTER TABLE public.scheduled_ai_task_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_read_ai_task_results" ON public.scheduled_ai_task_results;
CREATE POLICY "tenant_read_ai_task_results" ON public.scheduled_ai_task_results
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "service_role_insert_ai_task_results" ON public.scheduled_ai_task_results;
CREATE POLICY "service_role_insert_ai_task_results" ON public.scheduled_ai_task_results
  FOR INSERT TO service_role WITH CHECK (true);

-- ============================================================================
-- 7. AUTONOMOUS RULES (AI condition-action rules per tenant)
-- Used by: autonomousRunner workflow, cron-workflows.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.autonomous_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  trigger     JSONB NOT NULL DEFAULT '{}',
  conditions  JSONB NOT NULL DEFAULT '[]',
  actions     JSONB NOT NULL DEFAULT '[]',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  run_count   INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_autonomous_rules_tenant_active
  ON public.autonomous_rules (tenant_id, is_active);

ALTER TABLE public.autonomous_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_manage_autonomous_rules" ON public.autonomous_rules;
CREATE POLICY "tenant_manage_autonomous_rules" ON public.autonomous_rules
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ============================================================================
-- 8. AUTONOMOUS RULE RUNS
-- Used by: autonomousRunner workflow
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.autonomous_rule_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id      UUID NOT NULL REFERENCES public.autonomous_rules(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'triggered' CHECK (status IN ('triggered','executed','failed','skipped')),
  output       JSONB,
  error        TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_autonomous_rule_runs_rule
  ON public.autonomous_rule_runs (rule_id, triggered_at DESC);

ALTER TABLE public.autonomous_rule_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_rule_runs" ON public.autonomous_rule_runs;
CREATE POLICY "service_role_manage_rule_runs" ON public.autonomous_rule_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tenant_read_rule_runs" ON public.autonomous_rule_runs;
CREATE POLICY "tenant_read_rule_runs" ON public.autonomous_rule_runs
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ============================================================================
-- 9. INVOICE REMINDERS
-- Used by: process-invoice-overdue-reminders, autonomousRunnerService
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoice_reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id    UUID NOT NULL REFERENCES public.business_invoices(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL,
  sent_to       TEXT,
  status        TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invoice_id, reminder_type)
);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice
  ON public.invoice_reminders (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_tenant
  ON public.invoice_reminders (tenant_id, created_at DESC);

ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_invoice_reminders" ON public.invoice_reminders;
CREATE POLICY "service_role_manage_invoice_reminders" ON public.invoice_reminders
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tenant_read_invoice_reminders" ON public.invoice_reminders;
CREATE POLICY "tenant_read_invoice_reminders" ON public.invoice_reminders
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Add reminder columns to business_invoices
ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS reminder_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

-- ============================================================================
-- 10. SOCIAL POST SYNC QUEUE
-- Used by: reconcile-social-posts cron, linkedinPublishHelpers.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.social_post_sync_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  social_post_id UUID NOT NULL,
  platform       TEXT NOT NULL,
  external_id    TEXT,
  attempts       INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT,
  processed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_social_post_sync_unprocessed
  ON public.social_post_sync_queue (created_at ASC)
  WHERE processed_at IS NULL;

ALTER TABLE public.social_post_sync_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_sync_queue" ON public.social_post_sync_queue;
CREATE POLICY "service_role_manage_sync_queue" ON public.social_post_sync_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tenant_read_sync_queue" ON public.social_post_sync_queue;
CREATE POLICY "tenant_read_sync_queue" ON public.social_post_sync_queue
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ============================================================================
-- 11. CAMPAIGN RECIPIENTS
-- Used by: process-campaigns, sequence-worker, campaign-delivery workflow
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id  UUID NOT NULL,
  contact_id   UUID,
  email        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','waiting','sending','sent','failed','unsubscribed','bounced')),
  next_step_at TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  opened_at    TIMESTAMPTZ,
  clicked_at   TIMESTAMPTZ,
  error        TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign
  ON public.campaign_recipients (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_waiting
  ON public.campaign_recipients (tenant_id, next_step_at ASC)
  WHERE status = 'waiting';

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_recipients" ON public.campaign_recipients;
CREATE POLICY "service_role_manage_recipients" ON public.campaign_recipients
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tenant_read_recipients" ON public.campaign_recipients;
CREATE POLICY "tenant_read_recipients" ON public.campaign_recipients
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ============================================================================
-- 12. RECURRING INVOICES
-- Used by: processRecurringInvoices workflow, cronService
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.recurring_invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID,
  title             TEXT NOT NULL,
  amount            DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'USD',
  frequency         TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly')),
  next_invoice_date DATE NOT NULL,
  active            BOOLEAN NOT NULL DEFAULT true,
  line_items        JSONB NOT NULL DEFAULT '[]',
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_due
  ON public.recurring_invoices (next_invoice_date ASC)
  WHERE active = true;

ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_manage_recurring_invoices" ON public.recurring_invoices;
CREATE POLICY "tenant_manage_recurring_invoices" ON public.recurring_invoices
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ============================================================================
-- 13. MCP AGENT CONTEXT (MCP scheduled actions & context)
-- Used by: MCP server scheduled calls and workflows
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.mcp_agent_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_key     TEXT NOT NULL,
  context         JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','expired')),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, session_key)
);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_tenant
  ON public.mcp_agent_sessions (tenant_id, status);

ALTER TABLE public.mcp_agent_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_manage_mcp_sessions" ON public.mcp_agent_sessions;
CREATE POLICY "tenant_manage_mcp_sessions" ON public.mcp_agent_sessions
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ============================================================================
-- 14. MCP SCHEDULED ACTIONS
-- The actual table MCP uses to schedule future executions.
-- Cron: /api/cron/process-scheduled-ai-tasks picks these up.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.mcp_scheduled_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type   TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','failed','cancelled')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  executed_at   TIMESTAMPTZ,
  result        JSONB,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mcp_actions_due
  ON public.mcp_scheduled_actions (tenant_id, scheduled_for ASC)
  WHERE status = 'pending';

ALTER TABLE public.mcp_scheduled_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_manage_mcp_actions" ON public.mcp_scheduled_actions;
CREATE POLICY "tenant_manage_mcp_actions" ON public.mcp_scheduled_actions
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "service_role_execute_mcp_actions" ON public.mcp_scheduled_actions;
CREATE POLICY "service_role_execute_mcp_actions" ON public.mcp_scheduled_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 15. SUPABASE pg_cron JOBS (Self-contained — no Vercel needed)
-- These call your API routes directly from the database on schedule.
-- Requires pg_cron extension to be enabled in Supabase.
-- ============================================================================

-- Enable pg_cron (run once, safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

-- Helper function to call internal cron endpoints
CREATE OR REPLACE FUNCTION public.call_cron_endpoint(path TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  app_url TEXT := current_setting('app.url', true);
  cron_secret TEXT := current_setting('app.cron_secret', true);
BEGIN
  PERFORM net.http_post(
    url := app_url || path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'cron endpoint % failed: %', path, SQLERRM;
END;
$$;

-- ============================================================================
-- 16. SUPABASE NATIVE CRON SCHEDULES
-- These are BACKUP triggers running inside Supabase.
-- They fire the same cron endpoints via HTTP (pg_net extension).
-- If Vercel crons work fine, these act as redundancy.
-- ============================================================================

-- Remove old schedules if they exist (safe to re-run)
SELECT cron.unschedule('process-events') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-events');
SELECT cron.unschedule('retry-failed') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retry-failed');
SELECT cron.unschedule('process-campaigns') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-campaigns');
SELECT cron.unschedule('sequence-worker') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sequence-worker');
SELECT cron.unschedule('process-scheduled-ai-tasks') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-ai-tasks');
SELECT cron.unschedule('process-recurring-invoices') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-recurring-invoices');
SELECT cron.unschedule('process-invoice-overdue-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-invoice-overdue-reminders');
SELECT cron.unschedule('autonomous-sync') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'autonomous-sync');
SELECT cron.unschedule('social-publish') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'social-publish');
SELECT cron.unschedule('reconcile-social-posts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-social-posts');
SELECT cron.unschedule('mark-overdue-invoices') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark-overdue-invoices');

-- Native invoice overdue marking (no HTTP call needed - pure SQL)
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.business_invoices
  SET status = 'overdue', updated_at = NOW()
  WHERE status IN ('sent', 'viewed')
    AND due_date < CURRENT_DATE;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Native MCP scheduled action processor (pure SQL)
CREATE OR REPLACE FUNCTION public.process_due_mcp_actions()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  processed INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id FROM public.mcp_scheduled_actions
    WHERE status = 'pending' AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.mcp_scheduled_actions
    SET status = 'running', updated_at = NOW()
    WHERE id = rec.id;
    processed := processed + 1;
  END LOOP;
  RETURN processed;
END;
$$;

-- Schedule native functions directly in Supabase (no Vercel dependency)
SELECT cron.schedule('mark-overdue-invoices', '0 1 * * *',
  $$SELECT public.mark_overdue_invoices()$$);

SELECT cron.schedule('process-mcp-actions', '*/5 * * * *',
  $$SELECT public.process_due_mcp_actions()$$);

-- ============================================================================
-- 17. INTELLIGENT SNAPSHOT: business_intelligence_snapshots
-- Used by: /api/cron/intelligence-snapshots, integratedIntelligenceService
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.business_intelligence_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  overall_score  INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  dimensions     JSONB NOT NULL DEFAULT '{}',
  ai_summary     TEXT,
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, generated_at::DATE)
);
CREATE INDEX IF NOT EXISTS idx_intel_snapshots_tenant
  ON public.business_intelligence_snapshots (tenant_id, generated_at DESC);

ALTER TABLE public.business_intelligence_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_read_intel_snapshots" ON public.business_intelligence_snapshots;
CREATE POLICY "tenant_read_intel_snapshots" ON public.business_intelligence_snapshots
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "service_role_insert_intel_snapshots" ON public.business_intelligence_snapshots;
CREATE POLICY "service_role_insert_intel_snapshots" ON public.business_intelligence_snapshots
  FOR INSERT TO service_role WITH CHECK (true);

-- ============================================================================
-- 18. GRANTS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON public.business_automation_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.automation_runs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.automation_run_steps TO service_role;
GRANT SELECT, INSERT ON public.automation_cron_logs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.scheduled_ai_tasks TO service_role;
GRANT SELECT, INSERT ON public.scheduled_ai_task_results TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.autonomous_rules TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.autonomous_rule_runs TO service_role;
GRANT SELECT, INSERT ON public.invoice_reminders TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.social_post_sync_queue TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.campaign_recipients TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.recurring_invoices TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.mcp_scheduled_actions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.mcp_agent_sessions TO service_role;
GRANT SELECT, INSERT ON public.business_intelligence_snapshots TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
