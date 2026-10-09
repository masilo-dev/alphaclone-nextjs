-- ============================================================================
-- Migration: CRM Import Jobs Schema & Durable Background Execution
-- Provides asynchronous tracking, chunked processing, checkpointing,
-- deduplication, and idempotent replay for CRM imports.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    created_by UUID,
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
      'QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL_SUCCESS', 'RETRY_PENDING', 'FAILED', 'CANCELLED', 'RECONCILING'
    )),
    import_type TEXT NOT NULL DEFAULT 'csv' CHECK (import_type IN (
      'csv', 'lead_finder', 'enrichment', 'integration', 'json'
    )),
    file_name TEXT,
    total_records INTEGER NOT NULL DEFAULT 0,
    processed_records INTEGER NOT NULL DEFAULT 0,
    created_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    error_log JSONB NOT NULL DEFAULT '[]'::jsonb,
    idempotency_key TEXT,
    payload JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performant lookup
CREATE INDEX IF NOT EXISTS idx_crm_import_jobs_tenant_status
    ON public.crm_import_jobs (tenant_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_import_jobs_tenant_idempotency
    ON public.crm_import_jobs (tenant_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Enable RLS
ALTER TABLE public.crm_import_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'crm_import_jobs' AND policyname = 'crm_import_jobs_tenant_isolation'
  ) THEN
    CREATE POLICY "crm_import_jobs_tenant_isolation"
        ON public.crm_import_jobs
        FOR ALL
        USING (
          tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
          OR
          auth.role() = 'service_role'
        );
  END IF;
END $$;
