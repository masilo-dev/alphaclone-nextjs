-- Database Repair Migration
-- Creates public.workspace_files, public.scheduled_posts, and fixes public.secure_read_only_query RPC

-- 1. Create public.workspace_files if not exists
CREATE TABLE IF NOT EXISTS public.workspace_files (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id            UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by        UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  anthropic_file_id  TEXT NULL,
  filename           TEXT NOT NULL,
  file_name          TEXT NOT NULL,
  mime_type          TEXT NOT NULL,
  file_type          TEXT NOT NULL,
  file_size          BIGINT NOT NULL DEFAULT 0,
  storage_url        TEXT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for workspace_files
ALTER TABLE public.workspace_files ENABLE ROW LEVEL SECURITY;

-- Add tenant isolation policy for workspace_files
DROP POLICY IF EXISTS tenant_isolation ON public.workspace_files;
CREATE POLICY tenant_isolation ON public.workspace_files
  FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);


-- 2. Create public.scheduled_posts if not exists
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content       TEXT,
  platform      VARCHAR(255),
  scheduled_at  TIMESTAMPTZ,
  status        VARCHAR(50) DEFAULT 'pending',
  asset_id      UUID NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for scheduled_posts
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Add tenant isolation policy for scheduled_posts
DROP POLICY IF EXISTS tenant_isolation ON public.scheduled_posts;
CREATE POLICY tenant_isolation ON public.scheduled_posts
  FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);


-- 3. Fix public.secure_read_only_query RPC (change json_agg to jsonb_agg to fix coalesce json vs jsonb type mismatch)
CREATE OR REPLACE FUNCTION public.secure_read_only_query(query_string text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result jsonb;
BEGIN
  -- Strict Postgres guard against write and diagnostic sequences
  IF query_string ILIKE '%insert%' OR
     query_string ILIKE '%update%' OR
     query_string ILIKE '%delete%' OR
     query_string ILIKE '%drop%' OR
     query_string ILIKE '%truncate%' OR
     query_string ILIKE '%alter%' OR
     query_string ILIKE '%create%' OR
     query_string ILIKE '%grant%' OR
     query_string ILIKE '%revoke%' OR
     query_string ILIKE '%pg_%' OR
     query_string ILIKE '%information_schema%' THEN
    RAISE EXCEPTION 'Action rejected: Secure read-only queries only support SELECT operations.';
  END IF;

  -- Dynamic execution returning a single cohesive JSON array
  EXECUTE 'SELECT coalesce(jsonb_agg(t), ''[]''::jsonb) FROM (' || query_string || ') t' INTO result;

  RETURN result;
END;
$function$;
