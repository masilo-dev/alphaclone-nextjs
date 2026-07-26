-- Non-destructive rollback: restore the legacy lookup index but retain grants,
-- jobs, token history, and backfilled columns so valid connections are preserved.
BEGIN;
DROP INDEX IF EXISTS public.mcp_oauth_tokens_active_family_uidx;
CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_user_client_active_idx
  ON public.mcp_oauth_tokens(user_id,client_id) WHERE revoked=false;
-- Intentionally do not recreate the unsafe UNIQUE(user_id, client_id) index.
COMMIT;
