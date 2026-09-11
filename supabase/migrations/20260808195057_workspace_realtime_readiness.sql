-- Workspace readiness: make operational tables available to Supabase Realtime
-- without failing when an optional module table has not been installed yet.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
DECLARE
  tbl text;
  tables_to_add text[] := ARRAY[
    -- CRM, sales, leads
    'leads',
    'lead_activities',
    'lead_candidates',
    'lead_search_jobs',
    'business_clients',
    'contacts',
    'companies',
    'deals',
    'deal_stakeholders',

    -- Finance, invoices, accounting
    'business_invoices',
    'invoice_line_items',
    'invoice_views',
    'invoice_audit_log',
    'invoice_delivery_log',
    'invoice_reminders',
    'business_expenses',
    'business_receipts',
    'expenses',
    'journal_entries',
    'journal_entry_lines',
    'receipts',
    'sales_receipts',

    -- Tasks, projects, documents
    'tasks',
    'projects',
    'project_comments',
    'documents',
    'doc_os_documents',
    'doc_os_versions',
    'doc_os_events',
    'document_requirements',
    'document_data_rooms',

    -- Inbox, email, channels
    'messages',
    'unified_messages',
    'email_provider_accounts',
    'email_sender_identities',
    'email_campaigns',
    'email_campaign_recipients',
    'campaign_recipients',
    'email_webhook_events',
    'whatsapp_messages',
    'messenger_conversations',
    'messenger_messages',
    'notifications',

    -- Social, webhooks, automations
    'social_posts',
    'social_identities',
    'linkedin_integrations',
    'facebook_integrations',
    'webhooks',
    'webhook_events',
    'webhook_deliveries',
    'automation_tasks',
    'automation_runs',
    'automation_cron_logs',
    'business_automation_events',
    'mcp_event_queue',
    'user_presence'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_add LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN insufficient_privilege THEN
          RAISE WARNING 'Could not add %.% to supabase_realtime due to insufficient privilege', 'public', tbl;
      END;
    END IF;
  END LOOP;
END $$;
