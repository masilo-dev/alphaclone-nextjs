-- Workspace compatibility: ensure every table name referenced by the app exists.
-- These are broad compatibility tables for legacy/secondary modules so dormant
-- routes do not fail with relation-not-found while module-specific migrations
-- can still add richer columns later.

DO $$
DECLARE
  tbl text;
  tables_to_create text[] := ARRAY[
    'access_tokens',
    'activity_log',
    'agent_verifications',
    'ai_conversations',
    'ai_interactions',
    'ai_messages',
    'ai_quotas',
    'ai_usage',
    'appointments',
    'automation_approvals',
    'automation_logs',
    'autonomous_rule_runs',
    'autonomous_rules',
    'background_jobs',
    'bank_reconciliation_sessions',
    'blocked_ips',
    'bonnie_approvals',
    'bonnie_skills',
    'business_digital_twins',
    'calendar_sync_tokens',
    'campaigns',
    'captured_content',
    'chatbot_conversations',
    'chatbot_messages',
    'client_feedback',
    'client_notes',
    'clients',
    'dashboard_widgets',
    'department_members',
    'documentation_pages',
    'dpa_requests',
    'error_reports',
    'facebook_posts',
    'feature_flags',
    'files',
    'funnels',
    'gmail_integrations',
    'group_chats',
    'growth_agent_targets',
    'intelligence_correlation_models',
    'invoice_payments',
    'knowledge_articles',
    'landing_pages',
    'login_history',
    'mcp_action_receipts',
    'milestones',
    'permissions',
    'plugin_hooks',
    'project_files',
    'proposals',
    'quote_versions',
    'roles',
    'search_analytics',
    'security_threats',
    'sessions',
    'social_bookmarks',
    'social_interactions',
    'social_watchlist',
    'sso_providers',
    'subscriptions',
    'task_recurrence',
    'tenant_document_versions',
    'tenant_members',
    'tenant_usage',
    'uploads',
    'user_profiles',
    'user_registration_events',
    'user_roles',
    'web_vitals',
    'workflow_events'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_create LOOP
    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS public.%I (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid,
        user_id uuid,
        owner_user_id uuid,
        related_id uuid,
        name text,
        title text,
        email text,
        type text,
        status text DEFAULT 'active',
        content text,
        description text,
        url text,
        provider text,
        external_id text,
        amount numeric,
        count integer DEFAULT 0,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        config jsonb NOT NULL DEFAULT '{}'::jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        starts_at timestamptz,
        ends_at timestamptz,
        processed_at timestamptz,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    $sql$, tbl);

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, created_at DESC)', 'idx_' || tbl || '_tenant_created', tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id, created_at DESC)', 'idx_' || tbl || '_user_created', tbl);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_select', tbl);
    EXECUTE format($sql$
      CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
      USING (
        tenant_id IS NULL
        OR tenant_id IN (
          SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
        OR user_id = auth.uid()
        OR owner_user_id = auth.uid()
      )
    $sql$, tbl || '_tenant_select', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_service_role_all', tbl);
    EXECUTE format($sql$
      CREATE POLICY %I ON public.%I FOR ALL TO service_role
      USING (true)
      WITH CHECK (true)
    $sql$, tbl || '_service_role_all', tbl);
  END LOOP;
END $$;

DO $$
DECLARE
  tbl text;
  tables_to_add text[] := ARRAY[
    'access_tokens',
    'activity_log',
    'agent_verifications',
    'ai_conversations',
    'ai_interactions',
    'ai_messages',
    'ai_quotas',
    'ai_usage',
    'appointments',
    'automation_approvals',
    'automation_logs',
    'autonomous_rule_runs',
    'autonomous_rules',
    'background_jobs',
    'bank_reconciliation_sessions',
    'blocked_ips',
    'bonnie_approvals',
    'bonnie_skills',
    'business_digital_twins',
    'calendar_sync_tokens',
    'campaigns',
    'captured_content',
    'chatbot_conversations',
    'chatbot_messages',
    'client_feedback',
    'client_notes',
    'clients',
    'dashboard_widgets',
    'department_members',
    'documentation_pages',
    'dpa_requests',
    'error_reports',
    'facebook_posts',
    'feature_flags',
    'files',
    'funnels',
    'gmail_integrations',
    'group_chats',
    'growth_agent_targets',
    'intelligence_correlation_models',
    'invoice_payments',
    'knowledge_articles',
    'landing_pages',
    'login_history',
    'mcp_action_receipts',
    'milestones',
    'permissions',
    'plugin_hooks',
    'project_files',
    'proposals',
    'quote_versions',
    'roles',
    'search_analytics',
    'security_threats',
    'sessions',
    'social_bookmarks',
    'social_interactions',
    'social_watchlist',
    'sso_providers',
    'subscriptions',
    'task_recurrence',
    'tenant_document_versions',
    'tenant_members',
    'tenant_usage',
    'uploads',
    'user_profiles',
    'user_registration_events',
    'user_roles',
    'web_vitals',
    'workflow_events'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH tbl IN ARRAY tables_to_add LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN insufficient_privilege THEN
        RAISE WARNING 'Could not add %.% to supabase_realtime due to insufficient privilege', 'public', tbl;
    END;
  END LOOP;
END $$;
