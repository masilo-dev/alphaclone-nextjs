-- AlphaClone Marketing Hub <-> Listmonk integration foundation.
-- Listmonk remains auxiliary infrastructure; AlphaClone stays system of record.

CREATE TABLE IF NOT EXISTS public.listmonk_list_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  alphaclone_segment_key text NOT NULL,
  listmonk_list_id bigint NOT NULL,
  listmonk_list_uuid text,
  list_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, alphaclone_segment_key),
  UNIQUE (tenant_id, listmonk_list_id)
);

CREATE TABLE IF NOT EXISTS public.listmonk_subscriber_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid,
  email text NOT NULL,
  listmonk_subscriber_id bigint NOT NULL,
  listmonk_subscriber_uuid text,
  status text NOT NULL DEFAULT 'enabled',
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email),
  UNIQUE (tenant_id, listmonk_subscriber_id)
);

CREATE INDEX IF NOT EXISTS idx_listmonk_subscribers_contact
  ON public.listmonk_subscriber_mappings (tenant_id, contact_id)
  WHERE contact_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.listmonk_campaign_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL,
  listmonk_campaign_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, campaign_id),
  UNIQUE (tenant_id, listmonk_campaign_id)
);

CREATE TABLE IF NOT EXISTS public.listmonk_operation_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  operation text NOT NULL,
  entity_type text,
  entity_id text,
  status text NOT NULL DEFAULT 'pending',
  correlation_id text,
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  retry_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_listmonk_operation_status
  ON public.listmonk_operation_ledger (tenant_id, status, created_at DESC);

COMMENT ON TABLE public.listmonk_operation_ledger IS
  'Idempotency and observability ledger for AlphaClone -> Listmonk operations. Credentials remain in Railway environment variables, never this table.';
