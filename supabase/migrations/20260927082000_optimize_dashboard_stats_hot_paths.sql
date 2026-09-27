-- Optimize dashboard hot paths observed timing out in production.
-- Keeps tenant-scoped dashboard aggregates index-backed and refreshes PostgREST.

CREATE INDEX IF NOT EXISTS idx_business_invoices_tenant_status
  ON public.business_invoices (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_start
  ON public.calendar_events (tenant_id, start_time);

CREATE INDEX IF NOT EXISTS idx_messages_tenant_read
  ON public.messages (tenant_id, read_at);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status
  ON public.tasks (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_deals_tenant_stage
  ON public.deals (tenant_id, stage);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_user_created
  ON public.audit_logs (tenant_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_status
  ON public.journal_entries (tenant_id, status)
  WHERE voided_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_tenant_type
  ON public.chart_of_accounts (tenant_id, account_type);

NOTIFY pgrst, 'reload schema';
