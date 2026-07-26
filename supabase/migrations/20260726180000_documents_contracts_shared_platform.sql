-- Shared Documents + Contract Manager foundation.
-- Additive only: existing file_uploads, documents, doc_os_* and contracts data is preserved.

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  name text NOT NULL,
  mime_type text,
  storage_path text,
  size_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  document_type text NOT NULL DEFAULT 'general_file',
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS team_id uuid,
  ADD COLUMN IF NOT EXISTS confidentiality_level text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS signature_status text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS review_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS retention_date date,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_file_id uuid,
  ADD COLUMN IF NOT EXISTS doc_os_document_id uuid;

ALTER TABLE public.file_uploads
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_tenant_number
  ON public.documents (tenant_id, document_number)
  WHERE document_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tenant_status_active
  ON public.documents (tenant_id, status, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tenant_expiry
  ON public.documents (tenant_id, expiry_date)
  WHERE deleted_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_file_uploads_document
  ON public.file_uploads (tenant_id, document_id)
  WHERE document_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.document_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  relationship_type text NOT NULL DEFAULT 'attachment',
  is_primary boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, document_id, entity_type, entity_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS public.document_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  previous_values jsonb,
  new_values jsonb,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.document_activity_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'document_activity is append-only';
END;
$$;
DROP TRIGGER IF EXISTS document_activity_no_mutation ON public.document_activity;
CREATE TRIGGER document_activity_no_mutation
  BEFORE UPDATE OR DELETE ON public.document_activity
  FOR EACH ROW EXECUTE FUNCTION public.document_activity_append_only();

CREATE TABLE IF NOT EXISTS public.document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  document_type text NOT NULL,
  instructions text,
  requester_user_id uuid NOT NULL,
  recipient_email text NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  deadline timestamptz,
  allowed_mime_types text[] NOT NULL DEFAULT '{}',
  max_file_size bigint NOT NULL DEFAULT 104857600,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','viewed','uploaded','needs_correction','accepted','expired','cancelled')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  token_hash text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{"view":true,"download":false,"comment":false}'::jsonb,
  max_views integer,
  view_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.documents(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS contract_number text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS team_id uuid,
  ADD COLUMN IF NOT EXISTS currency_code text,
  ADD COLUMN IF NOT EXISTS total_value numeric(18,2),
  ADD COLUMN IF NOT EXISTS annual_value numeric(18,2),
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS renewal_date date,
  ADD COLUMN IF NOT EXISTS notice_deadline date,
  ADD COLUMN IF NOT EXISTS auto_renews boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS governing_law text,
  ADD COLUMN IF NOT EXISTS jurisdiction text,
  ADD COLUMN IF NOT EXISTS risk_level text;

CREATE TABLE IF NOT EXISTS public.contract_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  contact_id uuid,
  company_id uuid,
  party_snapshot jsonb NOT NULL,
  role text NOT NULL,
  signing_order integer,
  signature_required boolean NOT NULL DEFAULT true,
  signature_status text NOT NULL DEFAULT 'not_requested',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contract_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  responsible_party_id uuid REFERENCES public.contract_parties(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  obligation_type text,
  due_date timestamptz,
  recurrence jsonb,
  owner_user_id uuid,
  team_id uuid,
  priority text NOT NULL DEFAULT 'medium',
  related_task_id uuid,
  related_event_id uuid,
  related_invoice_id uuid,
  evidence_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned',
  risk_level text,
  idempotency_key text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.contract_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  milestone_type text NOT NULL,
  title text NOT NULL,
  due_at timestamptz NOT NULL,
  calendar_event_id uuid,
  task_id uuid,
  status text NOT NULL DEFAULT 'scheduled',
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_document_relationship_entity
  ON public.document_relationships (tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_document_relationship_document
  ON public.document_relationships (tenant_id, document_id);
CREATE INDEX IF NOT EXISTS idx_document_activity_document
  ON public.document_activity (tenant_id, document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_status_active
  ON public.contracts (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_deadlines
  ON public.contracts (tenant_id, notice_deadline, renewal_date, end_date);
CREATE INDEX IF NOT EXISTS idx_contract_obligations_due
  ON public.contract_obligations (tenant_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_contract_milestones_due
  ON public.contract_milestones (tenant_id, due_at);

ALTER TABLE public.document_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_milestones ENABLE ROW LEVEL SECURITY;

DO $policies$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'document_relationships','document_requests','document_shares',
    'contract_parties','contract_obligations','contract_milestones'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_tenant_access', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING
       (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid()))
       WITH CHECK
       (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid()))',
       table_name || '_tenant_access', table_name, table_name, table_name
    );
  END LOOP;
END
$policies$;

DROP POLICY IF EXISTS document_activity_tenant_select ON public.document_activity;
CREATE POLICY document_activity_tenant_select ON public.document_activity FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = document_activity.tenant_id AND tu.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS document_activity_tenant_insert ON public.document_activity;
CREATE POLICY document_activity_tenant_insert ON public.document_activity FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = document_activity.tenant_id AND tu.user_id = auth.uid()
  ));

-- Backfill canonical records from existing uploads without copying any file.
INSERT INTO public.documents (
  tenant_id, title, name, mime_type, storage_path, size_bytes, status,
  document_type, uploaded_by, source_file_id, created_at, updated_at
)
SELECT
  fu.tenant_id, fu.original_filename, fu.original_filename, fu.file_type,
  fu.storage_path, fu.file_size, 'active', COALESCE(fu.category, 'general_file'),
  fu.user_id, fu.id, fu.created_at, fu.created_at
FROM public.file_uploads fu
WHERE fu.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.tenant_id = fu.tenant_id AND d.source_file_id = fu.id
  );

UPDATE public.file_uploads fu
SET document_id = d.id
FROM public.documents d
WHERE d.tenant_id = fu.tenant_id
  AND d.source_file_id = fu.id
  AND fu.document_id IS NULL;

COMMENT ON TABLE public.documents IS 'Canonical tenant document metadata; storage remains in file_uploads/storage and lifecycle evidence in doc_os_*.';
COMMENT ON TABLE public.document_relationships IS 'Polymorphic links expose one shared document across platform modules without file duplication.';
