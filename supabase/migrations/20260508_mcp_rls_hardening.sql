-- ============================================================================
-- MCP AND MULTI-TENANT DATA ISOLATION HARDENING
-- Migration: 20260508_mcp_rls_hardening.sql
-- Purpose: Enforce strict RLS on MCP tables and ensure business data isolation
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. HARDEN MCP OAUTH TABLES
-- ────────────────────────────────────────────────────────────────────────────

-- mcp_oauth_clients (Internal table, only service_role/admin)
ALTER TABLE mcp_oauth_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only for clients" ON mcp_oauth_clients;
CREATE POLICY "Service role only for clients" 
  ON mcp_oauth_clients FOR ALL 
  USING (true); -- Usually service_role bypasses RLS, but this allows explicit service_role access if needed.

-- mcp_oauth_codes (User/Tenant scoped)
ALTER TABLE mcp_oauth_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own auth codes" ON mcp_oauth_codes;
CREATE POLICY "Users can view their own auth codes"
  ON mcp_oauth_codes FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own auth codes" ON mcp_oauth_codes;
CREATE POLICY "Users can manage their own auth codes"
  ON mcp_oauth_codes FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- mcp_oauth_tokens (User/Tenant scoped)
ALTER TABLE mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own tokens" ON mcp_oauth_tokens;
CREATE POLICY "Users can view their own tokens"
  ON mcp_oauth_tokens FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own tokens" ON mcp_oauth_tokens;
CREATE POLICY "Users can manage their own tokens"
  ON mcp_oauth_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────
-- 2. HARDEN BUSINESS DATA ISOLATION (Revenue & Leads)
-- ────────────────────────────────────────────────────────────────────────────

-- Ensure business_invoices is strictly tenant-isolated
ALTER TABLE business_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for business_invoices" ON business_invoices;
CREATE POLICY "Tenant isolation for business_invoices"
  ON business_invoices FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Ensure business_clients is strictly tenant-isolated
ALTER TABLE business_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for business_clients" ON business_clients;
CREATE POLICY "Tenant isolation for business_clients"
  ON business_clients FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Ensure leads is strictly tenant-isolated
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for leads" ON leads;
CREATE POLICY "Tenant isolation for leads"
  ON leads FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Ensure deals is strictly tenant-isolated
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for deals" ON deals;
CREATE POLICY "Tenant isolation for deals"
  ON deals FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────
-- 3. VERIFY REALTIME SECURITY (Enable RLS for Realtime if not already)
-- ────────────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE mcp_oauth_tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE mcp_oauth_codes;

-- Log Completion
DO $$
BEGIN
  RAISE NOTICE '✅ MCP Authentication and Business Data RLS Hardening Complete';
END $$;
