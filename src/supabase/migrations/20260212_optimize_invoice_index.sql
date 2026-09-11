-- Add composite index to optimize "Get last invoice number" query
-- Query: SELECT invoice_number FROM business_invoices WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1

CREATE INDEX IF NOT EXISTS idx_business_invoices_tenant_created 
ON business_invoices (tenant_id, created_at DESC);
