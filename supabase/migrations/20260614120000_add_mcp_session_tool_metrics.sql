-- Add explicit MCP tool telemetry columns for reliable health reporting.
-- Keeps legacy columns in place while introducing the new names requested by the platform.

ALTER TABLE public.mcp_sessions
  ADD COLUMN IF NOT EXISTS tool_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS tool_success BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS tool_latency_ms INTEGER NULL;

-- Backfill the new columns from the existing ones where possible.
UPDATE public.mcp_sessions
SET
  tool_success = COALESCE(tool_success, success),
  tool_latency_ms = COALESCE(tool_latency_ms, duration_ms)
WHERE tool_success IS NULL OR tool_latency_ms IS NULL;
