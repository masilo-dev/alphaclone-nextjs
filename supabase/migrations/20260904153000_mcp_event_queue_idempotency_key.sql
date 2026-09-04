-- Repair mcp_event_queue for durable bulk/campaign MCP jobs.
-- bulkJobQueue.ts requires idempotency_key for deduplicated enqueue.

ALTER TABLE public.mcp_event_queue
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mcp_event_queue_tenant_idempotency
  ON public.mcp_event_queue (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mcp_event_queue_processing_locked
  ON public.mcp_event_queue (status, locked_at)
  WHERE status = 'processing';
