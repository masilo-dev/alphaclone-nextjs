-- Read-only workspace readiness audit for Supabase SQL editor.
-- Reports missing tables, RLS gaps, realtime publication gaps, and high-signal
-- data integrity warnings without failing when optional tables are absent.

CREATE TEMP TABLE IF NOT EXISTS workspace_readiness_findings (
  check_name text,
  module_name text,
  object_name text,
  status text,
  detail text
) ON COMMIT DROP;

TRUNCATE workspace_readiness_findings;

WITH expected_tables(table_name, module_name, realtime_required) AS (
  VALUES
    ('tenants','core',false),
    ('tenant_users','core',false),
    ('profiles','core',false),
    ('leads','crm',true),
    ('lead_activities','crm',true),
    ('business_clients','crm',true),
    ('contacts','crm',true),
    ('companies','crm',true),
    ('deals','crm',true),
    ('deal_stakeholders','crm',true),
    ('business_invoices','finance',true),
    ('invoice_line_items','finance',true),
    ('invoice_views','finance',true),
    ('invoice_audit_log','finance',true),
    ('invoice_delivery_log','finance',true),
    ('invoice_reminders','finance',true),
    ('business_receipts','finance',true),
    ('sales_receipts','finance',true),
    ('journal_entries','accounting',true),
    ('journal_entry_lines','accounting',true),
    ('tasks','tasks',true),
    ('projects','projects',true),
    ('project_comments','projects',true),
    ('documents','documents',true),
    ('doc_os_documents','documents',true),
    ('doc_os_versions','documents',true),
    ('doc_os_events','documents',true),
    ('document_requirements','documents',true),
    ('document_data_rooms','documents',true),
    ('messages','inbox',true),
    ('unified_messages','inbox',true),
    ('email_provider_accounts','email',true),
    ('email_sender_identities','email',true),
    ('email_campaigns','email',true),
    ('campaign_recipients','email',true),
    ('email_webhook_events','email',true),
    ('whatsapp_messages','inbox',true),
    ('notifications','notifications',true),
    ('social_posts','social',true),
    ('social_identities','social',true),
    ('linkedin_integrations','linkedin',true),
    ('facebook_integrations','social',true),
    ('webhook_events','webhooks',true),
    ('webhook_deliveries','webhooks',true),
    ('automation_tasks','automation',true),
    ('automation_runs','automation',true),
    ('automation_cron_logs','automation',true),
    ('business_automation_events','automation',true),
    ('mcp_event_queue','automation',true),
    ('user_presence','realtime',true)
),
table_status AS (
  SELECT
    e.module_name,
    e.table_name,
    e.realtime_required,
    c.oid IS NOT NULL AS exists_in_db,
    COALESCE(c.relrowsecurity, false) AS rls_enabled,
    rpt.tablename IS NOT NULL AS in_realtime
  FROM expected_tables e
  LEFT JOIN pg_class c
    ON c.oid = to_regclass(format('public.%I', e.table_name))
  LEFT JOIN pg_publication_tables rpt
    ON rpt.pubname = 'supabase_realtime'
   AND rpt.schemaname = 'public'
   AND rpt.tablename = e.table_name
)
INSERT INTO workspace_readiness_findings (check_name, module_name, object_name, status, detail)
SELECT 'table_missing', module_name, table_name, 'fail', 'Expected table does not exist'
FROM table_status
WHERE NOT exists_in_db
UNION ALL
SELECT 'rls_disabled', module_name, table_name, 'fail', 'Expected tenant/user table exists but RLS is disabled'
FROM table_status
WHERE exists_in_db
  AND table_name NOT IN ('automation_cron_logs')
  AND NOT rls_enabled
UNION ALL
SELECT 'realtime_missing', module_name, table_name, 'warn', 'Table exists but is not in supabase_realtime publication'
FROM table_status
WHERE exists_in_db
  AND realtime_required
  AND NOT in_realtime;

DO $$
DECLARE
  n bigint;
BEGIN
  IF to_regclass('public.leads') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.leads WHERE tenant_id IS NULL' INTO n;
    INSERT INTO workspace_readiness_findings
    VALUES ('leads_missing_tenant', 'crm', 'leads', CASE WHEN n = 0 THEN 'pass' ELSE 'fail' END, n || ' lead row(s) have no tenant_id');
  END IF;

  IF to_regclass('public.social_posts') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.social_posts WHERE tenant_id IS NULL' INTO n;
    INSERT INTO workspace_readiness_findings
    VALUES ('social_posts_missing_tenant', 'social', 'social_posts', CASE WHEN n = 0 THEN 'pass' ELSE 'fail' END, n || ' social post row(s) have no tenant_id');
  END IF;

  IF to_regclass('public.business_invoices') IS NOT NULL THEN
    EXECUTE $q$
      SELECT count(*)
      FROM public.business_invoices
      WHERE COALESCE(status, '') NOT IN ('paid','void','draft')
        AND COALESCE(client_email, '') = ''
    $q$ INTO n;
    INSERT INTO workspace_readiness_findings
    VALUES ('invoices_missing_client_email', 'finance', 'business_invoices', CASE WHEN n = 0 THEN 'pass' ELSE 'warn' END, n || ' unpaid invoice row(s) have no client email/client link email');
  END IF;

  IF to_regclass('public.email_provider_accounts') IS NOT NULL THEN
    EXECUTE $q$
      SELECT count(*)
      FROM public.email_provider_accounts
      WHERE COALESCE(status, '') IN ('active','connected')
    $q$ INTO n;
    INSERT INTO workspace_readiness_findings
    VALUES ('email_accounts_active', 'email', 'email_provider_accounts', CASE WHEN n = 0 THEN 'warn' ELSE 'pass' END, n || ' active provider account(s)');
  END IF;

  IF to_regclass('public.unified_messages') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.unified_messages WHERE tenant_id IS NULL' INTO n;
    INSERT INTO workspace_readiness_findings
    VALUES ('unified_messages_missing_tenant', 'inbox', 'unified_messages', CASE WHEN n = 0 THEN 'pass' ELSE 'fail' END, n || ' inbox message row(s) have no tenant_id');
  END IF;
END $$;

SELECT *
FROM workspace_readiness_findings
ORDER BY
  CASE status WHEN 'fail' THEN 1 WHEN 'warn' THEN 2 WHEN 'pass' THEN 3 ELSE 4 END,
  module_name,
  object_name,
  check_name;
