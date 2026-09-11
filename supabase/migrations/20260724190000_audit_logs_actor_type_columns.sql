-- Align audit_logs with serverAuditLog writers (actor_type, request_id, success, etc).
-- Production was missing actor_type, causing PGRST204 on MCP/system audit inserts.

BEGIN;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_type TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS ip_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_type ON public.audit_logs (actor_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON public.audit_logs (request_id);

COMMIT;
