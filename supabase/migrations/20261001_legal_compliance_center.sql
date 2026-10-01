-- Migration: 20261001_legal_compliance_center.sql
-- Description: Core tables for Legal, Privacy, Cookie Consent & Compliance Center

-- 1. Platform Legal Documents (Canonical agreements and policies)
CREATE TABLE IF NOT EXISTS public.platform_legal_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type text NOT NULL CHECK (document_type IN ('terms_of_service', 'privacy_policy', 'cookie_policy', 'dpa', 'acceptable_use', 'ai_terms', 'sla')),
    title text NOT NULL,
    version_number text NOT NULL,
    status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'superseded', 'archived')),
    effective_date timestamptz NOT NULL DEFAULT now(),
    requires_reacceptance boolean NOT NULL DEFAULT false,
    content_markdown text NOT NULL,
    integrity_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (document_type, version_number)
);

CREATE INDEX IF NOT EXISTS idx_platform_legal_documents_type_status 
    ON public.platform_legal_documents(document_type, status);

-- 2. User Legal Acceptances (Explicit acceptance audits)
CREATE TABLE IF NOT EXISTS public.platform_legal_acceptances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
    document_type text NOT NULL,
    version_number text NOT NULL,
    accepted_at timestamptz NOT NULL DEFAULT now(),
    acceptance_context text NOT NULL DEFAULT 'signup' CHECK (acceptance_context IN ('signup', 'login', 'policy_update', 'checkout', 'settings')),
    ip_hash text,
    user_agent text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_platform_legal_acceptances_user 
    ON public.platform_legal_acceptances(user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_platform_legal_acceptances_tenant 
    ON public.platform_legal_acceptances(tenant_id);

-- 3. Cookie & Consent Audit Records (First-party consent records)
CREATE TABLE IF NOT EXISTS public.cookie_consent_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    anonymous_id text NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
    consent_version text NOT NULL DEFAULT '2026-10',
    essential boolean NOT NULL DEFAULT true,
    functional boolean NOT NULL DEFAULT false,
    analytics boolean NOT NULL DEFAULT false,
    marketing boolean NOT NULL DEFAULT false,
    zaraz_synced boolean NOT NULL DEFAULT false,
    ip_hash text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now(),
    withdrawn_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cookie_consent_records_anon 
    ON public.cookie_consent_records(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_records_user 
    ON public.cookie_consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_records_created 
    ON public.cookie_consent_records(created_at);

-- 4. Enable RLS
ALTER TABLE public.platform_legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cookie_consent_records ENABLE ROW LEVEL SECURITY;

-- 5. Policies
-- Anyone can read published platform documents
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'platform_legal_documents' AND policyname = 'Anyone can view published legal documents'
    ) THEN
        CREATE POLICY "Anyone can view published legal documents"
            ON public.platform_legal_documents FOR SELECT
            USING (status = 'published');
    END IF;
END $$;

-- Authenticated users can view their own acceptances
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'platform_legal_acceptances' AND policyname = 'Users can view their own legal acceptances'
    ) THEN
        CREATE POLICY "Users can view their own legal acceptances"
            ON public.platform_legal_acceptances FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- Service role has full access
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'cookie_consent_records' AND policyname = 'Service role full access on cookie_consent_records'
    ) THEN
        CREATE POLICY "Service role full access on cookie_consent_records"
            ON public.cookie_consent_records FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
