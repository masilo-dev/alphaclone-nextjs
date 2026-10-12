-- Migration: 20261012150000_unified_communication_approval_gateway.sql
-- Description: Additive migration for Unified Communication & Human Approval Gateway.
-- Preserves all existing tables and data.

BEGIN;

-- 1. Extend lead_list_members to support canonical CRM contacts in addition to lead candidates
ALTER TABLE IF EXISTS public.lead_list_members
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS lead_list_members_contact_idx
  ON public.lead_list_members(list_id, contact_id)
  WHERE contact_id IS NOT NULL;

-- 2. Add content_hash and permitted_window to autonomous_runner_approvals for cryptographic tamper-proofing
ALTER TABLE IF EXISTS public.autonomous_runner_approvals
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS approval_window_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_channel TEXT DEFAULT 'email';

CREATE INDEX IF NOT EXISTS autonomous_runner_approvals_tenant_status_idx
  ON public.autonomous_runner_approvals(tenant_id, status, created_at);

-- 3. Add quota and health tracking columns to email_provider_accounts if missing
ALTER TABLE IF EXISTS public.email_provider_accounts
  ADD COLUMN IF NOT EXISTS daily_quota INT DEFAULT 500,
  ADD COLUMN IF NOT EXISTS daily_sent_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_quota_reset_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS rate_limit_per_minute INT DEFAULT 30;

-- 4. Create unified communication dispatch log table for cross-provider auditability
CREATE TABLE IF NOT EXISTS public.communication_dispatch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  approval_id UUID REFERENCES public.autonomous_runner_approvals(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('zoho', 'brevo', 'outlook', 'gmail', 'smtp', 'resend', 'sendgrid')),
  provider_account_id UUID REFERENCES public.email_provider_accounts(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  sender TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  message_subject TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'provider_accepted', 'delivered', 'failed', 'rejected')),
  provider_message_id TEXT,
  idempotency_key TEXT NOT NULL,
  delivery_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_details TEXT,
  dispatched_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS comm_dispatch_idempotency_uidx
  ON public.communication_dispatch_logs(tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS comm_dispatch_tenant_status_idx
  ON public.communication_dispatch_logs(tenant_id, status, created_at);

-- Enable RLS on communication_dispatch_logs
ALTER TABLE public.communication_dispatch_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY communication_dispatch_logs_tenant_isolation
  ON public.communication_dispatch_logs
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

COMMIT;
