#!/usr/bin/env node
/**
 * Fix script: Add missing tenant_id to contract_versions + create contract_approvals table.
 * Run: node scripts/fix-contract-tables.js
 */
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SQL = `
-- 1. Add tenant_id to contract_versions if missing
ALTER TABLE public.contract_versions
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Back-fill tenant_id from parent contracts
UPDATE public.contract_versions cv
SET tenant_id = c.tenant_id
FROM public.contracts c
WHERE cv.contract_id = c.id
  AND cv.tenant_id IS NULL;

-- 2. Ensure RLS policy for contract_versions exists
ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_contract_versions_read" ON public.contract_versions;
CREATE POLICY "tenant_contract_versions_read"
    ON public.contract_versions FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "tenant_contract_versions_manage" ON public.contract_versions;
CREATE POLICY "tenant_contract_versions_manage"
    ON public.contract_versions FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid() AND role IN ('admin', 'tenant_admin')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid() AND role IN ('admin', 'tenant_admin')
        )
    );

CREATE INDEX IF NOT EXISTS idx_contract_versions_tenant_contract
    ON public.contract_versions (tenant_id, contract_id, version_number DESC);

-- 3. Create contract_approvals table
CREATE TABLE IF NOT EXISTS public.contract_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    contract_version_id UUID REFERENCES public.contract_versions(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    request_note TEXT,
    decision_note TEXT,
    due_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contract_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_contract_approvals_read" ON public.contract_approvals;
CREATE POLICY "tenant_contract_approvals_read"
    ON public.contract_approvals FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "tenant_contract_approvals_manage" ON public.contract_approvals;
CREATE POLICY "tenant_contract_approvals_manage"
    ON public.contract_approvals FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid() AND role IN ('admin', 'tenant_admin')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid() AND role IN ('admin', 'tenant_admin')
        )
    );

CREATE INDEX IF NOT EXISTS idx_contract_approvals_tenant_status
    ON public.contract_approvals (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_approvals_contract_version
    ON public.contract_approvals (contract_id, contract_version_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_contract_approvals_updated_at ON public.contract_approvals;
CREATE TRIGGER trg_contract_approvals_updated_at
    BEFORE UPDATE ON public.contract_approvals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
`;

async function run() {
  console.log("🔧 Applying contract table fixes...");
  const { error } = await supabase
    .rpc("exec_sql", { sql: SQL })
    .catch(() => ({ error: { message: "rpc not available" } }));

  if (error && error.message === "rpc not available") {
    // Fallback: split and run via REST
    console.log("⚠️  exec_sql RPC not available, trying direct fetch...");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ sql: SQL }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("❌ Failed:", text);
      process.exit(1);
    }
  } else if (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  console.log("✅ Migration applied successfully");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
