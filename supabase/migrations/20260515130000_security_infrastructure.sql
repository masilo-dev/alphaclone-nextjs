-- Security Infrastructure Update
-- Migration: 20260515130000_security_infrastructure.sql

BEGIN;

-- 1. Hardening audit_logs
ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS old_values JSONB,
  ADD COLUMN IF NOT EXISTS new_values JSONB;

-- 2. Email Audit & Rate Limiting
CREATE TABLE IF NOT EXISTS public.email_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  provider TEXT,
  allowed BOOLEAN DEFAULT true,
  blocked_reason TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_email_audit_log" ON public.email_audit_log;
CREATE POLICY "tenant_email_audit_log" ON public.email_audit_log
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.email_rate_limits (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  transactional_count INTEGER DEFAULT 0,
  bulk_count INTEGER DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_rate_limits ENABLE ROW LEVEL SECURITY;

-- 3. Contract Versioning Hardening (Ensuring columns from Prompt 3 exist)
ALTER TABLE public.contract_versions
  ADD COLUMN IF NOT EXISTS saved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Audit Log Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_audit_log_tenant ON public.email_audit_log(tenant_id);

COMMIT;
