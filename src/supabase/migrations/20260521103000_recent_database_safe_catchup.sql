-- Migration: Recent database safe catch-up
-- Created: 2026-05-21
--
-- This migration intentionally combines the recent database changes into one
-- idempotent catch-up file. It is safe to run after any of the individual
-- migrations below because every table, column, index, and policy is guarded.
--
-- Included changes:
-- - 20260515100000_add_provider_to_outreach_log.sql
-- - 20260520100000_pwa_push_subscriptions.sql, without dropping existing data
-- - 20260521100000_public_shares.sql
-- - 20260521101000_business_projects_client_link.sql
-- - 20260521102000_push_subscription_compat.sql

-- 1. Outreach provider tracking
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'lead_outreach_log'
    ) THEN
        ALTER TABLE public.lead_outreach_log
            ADD COLUMN IF NOT EXISTS provider TEXT;
    END IF;
END $$;

-- 2. PWA push subscriptions, preserving existing rows if the table already exists
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    endpoint TEXT,
    keys JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS subscription JSONB,
    ADD COLUMN IF NOT EXISTS endpoint TEXT,
    ADD COLUMN IF NOT EXISTS keys JSONB,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'push_subscriptions'
          AND policyname = 'Users can manage own subscriptions'
    ) THEN
        CREATE POLICY "Users can manage own subscriptions"
            ON public.push_subscriptions
            FOR ALL
            TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

UPDATE public.push_subscriptions
SET
    endpoint = COALESCE(endpoint, subscription->>'endpoint'),
    keys = COALESCE(keys, subscription->'keys'),
    updated_at = COALESCE(updated_at, NOW())
WHERE subscription IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
    ON public.push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant_id
    ON public.push_subscriptions(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
    ON public.push_subscriptions(endpoint)
    WHERE endpoint IS NOT NULL;

-- 3. Temporary public document shares
CREATE TABLE IF NOT EXISTS public.public_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    bucket TEXT NOT NULL,
    original_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.public_shares
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS file_path TEXT,
    ADD COLUMN IF NOT EXISTS bucket TEXT,
    ADD COLUMN IF NOT EXISTS original_name TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.public_shares ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'public_shares'
          AND policyname = 'anon_select_public_shares'
    ) THEN
        CREATE POLICY anon_select_public_shares
            ON public.public_shares
            FOR SELECT
            USING (expires_at > NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'public_shares'
          AND policyname = 'manage_public_shares'
    ) THEN
        CREATE POLICY manage_public_shares
            ON public.public_shares
            FOR ALL
            TO authenticated
            USING (
                tenant_id IN (
                    SELECT tenant_id
                    FROM public.tenant_users
                    WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_public_shares_tenant
    ON public.public_shares(tenant_id);

CREATE INDEX IF NOT EXISTS idx_public_shares_expires
    ON public.public_shares(expires_at);

-- 4. Link native business projects to CRM clients, only when those tables exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'business_projects'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'business_clients'
    ) THEN
        ALTER TABLE public.business_projects
            ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.business_clients(id) ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS idx_business_projects_client
            ON public.business_projects(client_id);
    END IF;
END $$;

-- Reload PostgREST schema cache so new columns/tables are immediately visible.
NOTIFY pgrst, 'reload schema';
