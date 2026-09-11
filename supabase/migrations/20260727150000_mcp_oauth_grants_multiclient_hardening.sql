-- Grant-scoped MCP OAuth, durable sessions/jobs, and tenant security.
-- Rollback: see supabase/rollbacks/20260727150000_mcp_oauth_grants_multiclient_hardening.down.sql
BEGIN;

ALTER TABLE public.mcp_oauth_clients
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'generic_mcp',
  ADD COLUMN IF NOT EXISTS token_endpoint_auth_method text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS mcp_oauth_clients_id_uidx
  ON public.mcp_oauth_clients(id);

CREATE TABLE IF NOT EXISTS public.mcp_oauth_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  oauth_client_id uuid REFERENCES public.mcp_oauth_clients(id) ON DELETE RESTRICT,
  external_client_key text,
  connection_name text,
  scopes text[] NOT NULL DEFAULT ARRAY['workspace:read']::text[],
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','revoked','expired','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.mcp_oauth_tokens
  ADD COLUMN IF NOT EXISTS grant_id uuid REFERENCES public.mcp_oauth_grants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS access_token_encrypted text,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted text,
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS previous_token_id uuid,
  ADD COLUMN IF NOT EXISTS replaced_by_token_id uuid,
  ADD COLUMN IF NOT EXISTS revoke_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS mcp_oauth_tokens_id_uidx
  ON public.mcp_oauth_tokens(id);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.mcp_oauth_tokens'::regclass
      AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) = 'PRIMARY KEY (access_token)'
  ) THEN
    ALTER TABLE public.mcp_oauth_tokens DROP CONSTRAINT mcp_oauth_tokens_pkey;
    ALTER TABLE public.mcp_oauth_tokens
      ADD CONSTRAINT mcp_oauth_tokens_pkey PRIMARY KEY USING INDEX mcp_oauth_tokens_id_uidx;
  END IF;
END $$;
ALTER TABLE public.mcp_oauth_tokens ALTER COLUMN access_token DROP NOT NULL;

UPDATE public.mcp_oauth_tokens
SET access_expires_at = COALESCE(access_expires_at, expires_at),
    token_family_id = COALESCE(token_family_id, gen_random_uuid()),
    updated_at = COALESCE(updated_at, created_at, now())
WHERE access_expires_at IS NULL OR token_family_id IS NULL;

-- Preserve every legacy connection as its own grant. No token is revoked or deleted.
WITH legacy AS (
  SELECT t.id token_id, t.tenant_id, t.user_id, t.client_id, t.scopes,
         c.id oauth_client_id,
         row_number() OVER (PARTITION BY t.user_id, t.client_id ORDER BY t.created_at, t.id) device_number
  FROM public.mcp_oauth_tokens t
  LEFT JOIN public.mcp_oauth_clients c ON c.client_id = t.client_id
  WHERE t.grant_id IS NULL AND t.tenant_id IS NOT NULL AND t.user_id IS NOT NULL
), inserted AS (
  INSERT INTO public.mcp_oauth_grants
    (tenant_id,user_id,oauth_client_id,external_client_key,connection_name,scopes,status,created_at,metadata)
  SELECT tenant_id,user_id,oauth_client_id,
         client_id || ':legacy:' || token_id::text,
         COALESCE(client_id,'Legacy MCP client') || CASE WHEN device_number > 1 THEN ' #' || device_number ELSE '' END,
         COALESCE(scopes, ARRAY['read']::text[]),
         CASE WHEN COALESCE((SELECT revoked FROM public.mcp_oauth_tokens WHERE id=token_id),false)
              THEN 'revoked' ELSE 'active' END,
         COALESCE((SELECT created_at FROM public.mcp_oauth_tokens WHERE id=token_id),now()),
         jsonb_build_object('backfilled',true,'legacy_token_id',token_id)
  FROM legacy
  RETURNING id, metadata
)
UPDATE public.mcp_oauth_tokens t
SET grant_id = i.id
FROM inserted i
WHERE (i.metadata->>'legacy_token_id')::uuid = t.id;

-- Remove the unsafe one-active-row-per-user/client rule. A grant is the boundary.
DROP INDEX IF EXISTS public.mcp_oauth_tokens_active_user_client_uidx;
DROP INDEX IF EXISTS public.mcp_oauth_tokens_user_client_active_idx;
CREATE UNIQUE INDEX IF NOT EXISTS mcp_oauth_tokens_active_family_uidx
  ON public.mcp_oauth_tokens(grant_id, token_family_id)
  WHERE revoked = false AND grant_id IS NOT NULL AND token_family_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mcp_oauth_tokens_access_hash_uidx
  ON public.mcp_oauth_tokens(access_token_hash) WHERE access_token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mcp_oauth_tokens_refresh_hash_uidx
  ON public.mcp_oauth_tokens(refresh_token_hash) WHERE refresh_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS mcp_oauth_grants_subject_idx
  ON public.mcp_oauth_grants(tenant_id,user_id,status,last_used_at DESC);
CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_grant_idx
  ON public.mcp_oauth_tokens(grant_id,revoked,access_expires_at);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mcp_oauth_tokens_previous_fkey') THEN
    ALTER TABLE public.mcp_oauth_tokens ADD CONSTRAINT mcp_oauth_tokens_previous_fkey
      FOREIGN KEY (previous_token_id) REFERENCES public.mcp_oauth_tokens(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mcp_oauth_tokens_replaced_fkey') THEN
    ALTER TABLE public.mcp_oauth_tokens ADD CONSTRAINT mcp_oauth_tokens_replaced_fkey
      FOREIGN KEY (replaced_by_token_id) REFERENCES public.mcp_oauth_tokens(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

ALTER TABLE public.mcp_sessions
  ADD COLUMN IF NOT EXISTS grant_id uuid REFERENCES public.mcp_oauth_grants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS oauth_client_id uuid REFERENCES public.mcp_oauth_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_instance_id text,
  ADD COLUMN IF NOT EXISTS protocol_version text,
  ADD COLUMN IF NOT EXISTS transport text NOT NULL DEFAULT 'streamable-http',
  ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS connected_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS disconnected_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'connected';
CREATE INDEX IF NOT EXISTS mcp_sessions_grant_status_idx
  ON public.mcp_sessions(grant_id,status,last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.mcp_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_id uuid REFERENCES public.mcp_oauth_grants(id) ON DELETE SET NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','awaiting_input','awaiting_approval','completed','failed','cancelled')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error jsonb,
  idempotency_key text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS mcp_jobs_worker_idx ON public.mcp_jobs(status,available_at) WHERE status='queued';
CREATE UNIQUE INDEX IF NOT EXISTS mcp_jobs_idempotency_uidx
  ON public.mcp_jobs(tenant_id,job_type,idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.mcp_oauth_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant members read own mcp grants" ON public.mcp_oauth_grants;
CREATE POLICY "tenant members read own mcp grants" ON public.mcp_oauth_grants
  FOR SELECT USING (user_id=auth.uid() AND EXISTS (
    SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id=mcp_oauth_grants.tenant_id
      AND tu.user_id=auth.uid()
  ));
DROP POLICY IF EXISTS "tenant members read own mcp jobs" ON public.mcp_jobs;
CREATE POLICY "tenant members read own mcp jobs" ON public.mcp_jobs
  FOR SELECT USING (user_id=auth.uid() AND EXISTS (
    SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id=mcp_jobs.tenant_id
      AND tu.user_id=auth.uid()
  ));

COMMIT;
