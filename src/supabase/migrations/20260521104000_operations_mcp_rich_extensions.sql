<<<<<<< HEAD
checkall wheris not native feel and fixthat
=======
-- Migration: Operations, costing, and MCP campaign rich extensions
-- Created: 2026-05-21
--
-- Safe to run more than once. Adds richer project-management, costing, and
-- campaign-tracking fields without replacing existing data.

DO $$
BEGIN
    IF to_regclass('public.business_projects') IS NOT NULL THEN
        ALTER TABLE public.business_projects
            ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
            ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS budget NUMERIC(14, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(14, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS estimated_revenue NUMERIC(14, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS percent_complete INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

        CREATE INDEX IF NOT EXISTS idx_business_projects_owner
            ON public.business_projects(owner_id);
        CREATE INDEX IF NOT EXISTS idx_business_projects_priority
            ON public.business_projects(priority);
    END IF;

    IF to_regclass('public.tasks') IS NOT NULL THEN
        ALTER TABLE public.tasks
            ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(10, 2),
            ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(10, 2),
            ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

        CREATE INDEX IF NOT EXISTS idx_tasks_blocked_by
            ON public.tasks(blocked_by);
    END IF;

    IF to_regclass('public.business_invoices') IS NOT NULL THEN
        ALTER TABLE public.business_invoices
            ADD COLUMN IF NOT EXISTS project_id UUID,
            ADD COLUMN IF NOT EXISTS cost_basis NUMERIC(14, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS margin_amount NUMERIC(14, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS margin_percent NUMERIC(7, 2) DEFAULT 0;

        CREATE INDEX IF NOT EXISTS idx_business_invoices_project
            ON public.business_invoices(project_id);
    END IF;

    IF to_regclass('public.contracts') IS NOT NULL THEN
        ALTER TABLE public.contracts
            ADD COLUMN IF NOT EXISTS project_id UUID,
            ADD COLUMN IF NOT EXISTS contract_value NUMERIC(14, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS cost_basis NUMERIC(14, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS margin_amount NUMERIC(14, 2) DEFAULT 0;

        CREATE INDEX IF NOT EXISTS idx_contracts_project
            ON public.contracts(project_id);
    END IF;

    IF to_regclass('public.email_campaigns') IS NOT NULL THEN
        ALTER TABLE public.email_campaigns
            ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS provider_summary JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF to_regclass('public.campaign_recipients') IS NOT NULL THEN
        ALTER TABLE public.campaign_recipients
            ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
            ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

        CREATE INDEX IF NOT EXISTS idx_campaign_recipients_events
            ON public.campaign_recipients(campaign_id, status, last_event_at);
    END IF;

    IF to_regclass('public.facebook_page_posts') IS NOT NULL THEN
        ALTER TABLE public.facebook_page_posts
            ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

        CREATE INDEX IF NOT EXISTS idx_facebook_page_posts_metadata
            ON public.facebook_page_posts USING GIN (metadata);
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
>>>>>>> origin/main
