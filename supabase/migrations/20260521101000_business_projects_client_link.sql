-- Migration: Link native business projects to CRM clients
-- Created: 2026-05-21

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'business_projects'
    ) THEN
        ALTER TABLE public.business_projects
            ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.business_clients(id) ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS idx_business_projects_client
            ON public.business_projects(client_id);
    END IF;
END $$;
