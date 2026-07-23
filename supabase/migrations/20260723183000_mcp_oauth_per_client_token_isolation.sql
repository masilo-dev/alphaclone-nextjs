-- ============================================================
-- MCP OAuth: one active token row per (user_id, client_id)
--
-- Prevents multi-client collision: Claude and ChatGPT (and any
-- future MCP client) each keep an independent active token.
-- Re-authorizing the *same* client rotates that client's row only.
-- Idempotent / safe for existing production duplicates.
-- ============================================================

-- 1) Collapse duplicate active rows: keep newest, revoke the rest
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, client_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.mcp_oauth_tokens
  WHERE COALESCE(revoked, false) = false
    AND client_id IS NOT NULL
    AND user_id IS NOT NULL
)
UPDATE public.mcp_oauth_tokens AS t
SET
  revoked = true,
  revoked_at = COALESCE(t.revoked_at, now())
FROM ranked AS r
WHERE t.id = r.id
  AND r.rn > 1
  AND COALESCE(t.revoked, false) = false;

-- 2) Partial unique index: at most one *active* token per user+client
CREATE UNIQUE INDEX IF NOT EXISTS mcp_oauth_tokens_active_user_client_uidx
  ON public.mcp_oauth_tokens (user_id, client_id)
  WHERE revoked = false
    AND client_id IS NOT NULL
    AND user_id IS NOT NULL;

-- Speeds up "revoke active for this client" on authorize/refresh
CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_user_client_active_idx
  ON public.mcp_oauth_tokens (user_id, client_id)
  WHERE revoked = false;
