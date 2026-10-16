# AlphaClone Systems — Database Migration & Schema Compatibility Plan

**Repository**: `masilo-dev/alphaclone-nextjs`  
**Target Environment**: Multi-Tenant Supabase PostgreSQL 15+  
**Release**: Q4 2026 Production Readiness  
**Safety Protocol**: Additive, Idempotent, Zero-Downtime, Non-Destructive

---

## 1. Migration Execution Principles

1. **Strictly Additive**: Never drop columns, alter existing data types, or delete active tables in production.
2. **Backward-Compatible Schema Fallbacks**: Application code must support both legacy schemas and new database structures (e.g., invoice PDF storage falling back gracefully from `pdf_storage_path` column to `metadata.pdf_storage_path` via PG error code `42703`).
3. **Idempotency**: All DDL statements must utilize `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS`.
4. **Tenant Isolation**: Every newly provisioned table must declare `tenant_id UUID NOT NULL REFERENCES tenants(id)` and enable Row Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).

---

## 2. Migration Inventory & Execution Sequence

### Phase 1: Core Storage Buckets & Policies
```sql
-- Ensure private invoice documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoice-documents', 'invoice-documents', false, 15728640, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['application/pdf']::text[];
```

### Phase 2: Invoicing & Billing Lifecycle Schema Additions
```sql
-- Add PDF storage path and generation timestamp columns to business_invoices
ALTER TABLE business_invoices 
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canonical_delivery_status TEXT DEFAULT 'draft';

-- Create index on tenant and contract for fast reconciliation
CREATE INDEX IF NOT EXISTS idx_business_invoices_tenant_contract 
  ON business_invoices (tenant_id, contract_id);
```

### Phase 3: Contract Multi-Party Progression & Audit Trail
```sql
-- Add lifecycle status and signing order to contract parties
ALTER TABLE contract_parties
  ADD COLUMN IF NOT EXISTS signing_order INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS signature_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- Ensure contract audit trail captures tenant context
ALTER TABLE contract_audit_trail
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
```

### Phase 4: Revenue Lifecycle Connectivity
```sql
-- Ensure revenue_lifecycle_links indexes exist for zero-latency link traversal
CREATE INDEX IF NOT EXISTS idx_revenue_lifecycle_links_lookup
  ON revenue_lifecycle_links (tenant_id, source_type, source_id, target_type, relationship);
```

---

## 3. Pre-Flight Verification & Execution Checklist

- [x] All application code tested with both old and new schema structures.
- [x] RLS policies validated for tenant boundaries on all target tables.
- [x] No schema locks that would block real-time user mutations.
- [ ] Explicit user sign-off obtained before running SQL against production Supabase.
