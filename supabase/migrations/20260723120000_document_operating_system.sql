-- Document Operating System: brand profiles, unified documents, versions, event ledger,
-- signatures, approvals, retention, and notifications.

CREATE TABLE IF NOT EXISTS public.document_brand_profiles (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_business_name text NOT NULL,
  trading_name text,
  registration_number text,
  tax_vat_number text,
  physical_address text,
  postal_address text,
  business_email text,
  telephone text,
  website text,
  default_currency text NOT NULL DEFAULT 'USD',
  country text,
  jurisdiction text,
  primary_logo_url text,
  secondary_logo_url text,
  monochrome_logo_url text,
  favicon_url text,
  primary_colour text NOT NULL DEFAULT '#0f172a',
  secondary_colour text NOT NULL DEFAULT '#334155',
  accent_colour text NOT NULL DEFAULT '#0f766e',
  heading_font text NOT NULL DEFAULT '"Source Serif 4", Georgia, serif',
  body_font text NOT NULL DEFAULT '"IBM Plex Sans", Helvetica, Arial, sans-serif',
  logo_placement text NOT NULL DEFAULT 'left' CHECK (logo_placement IN ('left', 'center', 'right')),
  authorized_signatories jsonb NOT NULL DEFAULT '[]'::jsonb,
  bank_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_instructions text,
  legal_footer text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  page_size text NOT NULL DEFAULT 'A4' CHECK (page_size IN ('A4', 'Letter')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.doc_os_documents (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid,
  company_id uuid,
  project_id uuid,
  workflow_id uuid,
  parent_document_id uuid REFERENCES public.doc_os_documents(document_id) ON DELETE SET NULL,
  source_document_id uuid REFERENCES public.doc_os_documents(document_id) ON DELETE SET NULL,
  document_type text NOT NULL,
  document_number text NOT NULL,
  title text NOT NULL,
  current_version_id uuid,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'USD',
  source_template_id uuid,
  structured_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  rendered_pdf_url text,
  editable_source jsonb,
  owner_user_id uuid,
  department text,
  classification text,
  retention_policy_id uuid,
  created_by uuid,
  approved_by uuid,
  sent_to text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  expires_at timestamptz,
  archived_at timestamptz,
  checksum text,
  legal_hold boolean NOT NULL DEFAULT false,
  UNIQUE (tenant_id, document_number)
);

CREATE TABLE IF NOT EXISTS public.doc_os_versions (
  version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.doc_os_documents(document_id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  previous_version_id uuid REFERENCES public.doc_os_versions(version_id) ON DELETE SET NULL,
  structured_content jsonb NOT NULL,
  rendered_pdf_url text,
  editable_source_url text,
  checksum text NOT NULL,
  file_size bigint,
  mime_type text NOT NULL DEFAULT 'application/json',
  change_summary text,
  change_reason text,
  created_by_type text NOT NULL,
  created_by_id text NOT NULL,
  created_by_name text NOT NULL,
  ai_provider text,
  ai_model text,
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_signed boolean NOT NULL DEFAULT false,
  is_immutable boolean NOT NULL DEFAULT true,
  UNIQUE (document_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.doc_os_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.doc_os_documents(document_id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.doc_os_versions(version_id) ON DELETE SET NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor jsonb NOT NULL,
  action text NOT NULL,
  previous_status text,
  new_status text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_reference text,
  evidence_url text,
  correlation_id text
);

-- Append-only: revoke UPDATE/DELETE for authenticated roles after policies
CREATE OR REPLACE FUNCTION public.doc_os_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'doc_os_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_doc_os_events_no_update ON public.doc_os_events;
CREATE TRIGGER trg_doc_os_events_no_update
  BEFORE UPDATE OR DELETE ON public.doc_os_events
  FOR EACH ROW EXECUTE FUNCTION public.doc_os_events_append_only();

CREATE TABLE IF NOT EXISTS public.doc_os_signature_envelopes (
  envelope_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.doc_os_documents(document_id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.doc_os_versions(version_id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_checksum text NOT NULL,
  signers jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz,
  completion_certificate_url text,
  signed_pdf_url text,
  provider text NOT NULL DEFAULT 'alphaclone_esign'
);

CREATE TABLE IF NOT EXISTS public.doc_os_approvals (
  approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.doc_os_documents(document_id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.doc_os_versions(version_id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  approver jsonb NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'changes_requested')),
  comments text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  evidence text,
  expiration timestamptz
);

CREATE TABLE IF NOT EXISTS public.doc_os_retention_policies (
  retention_policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type text,
  country text,
  client_id uuid,
  active_retention_days integer NOT NULL DEFAULT 2555,
  archive_after_days integer NOT NULL DEFAULT 365,
  legal_requirement text,
  business_policy text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.doc_os_notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.doc_os_documents(document_id) ON DELETE CASCADE,
  event_action text NOT NULL,
  recipient text NOT NULL,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_doc_os_documents_tenant_status ON public.doc_os_documents (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_doc_os_documents_tenant_type ON public.doc_os_documents (tenant_id, document_type);
CREATE INDEX IF NOT EXISTS idx_doc_os_documents_client ON public.doc_os_documents (tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_doc_os_documents_number ON public.doc_os_documents (tenant_id, document_number);
CREATE INDEX IF NOT EXISTS idx_doc_os_versions_document ON public.doc_os_versions (document_id, version_number);
CREATE INDEX IF NOT EXISTS idx_doc_os_events_document ON public.doc_os_events (document_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_doc_os_events_tenant ON public.doc_os_events (tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_doc_os_events_correlation ON public.doc_os_events (correlation_id);

ALTER TABLE public.document_brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_os_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_os_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_os_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_os_signature_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_os_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_os_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_os_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_brand_profiles_tenant_access ON public.document_brand_profiles;
CREATE POLICY document_brand_profiles_tenant_access ON public.document_brand_profiles FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS doc_os_documents_tenant_access ON public.doc_os_documents;
CREATE POLICY doc_os_documents_tenant_access ON public.doc_os_documents FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS doc_os_versions_tenant_access ON public.doc_os_versions;
CREATE POLICY doc_os_versions_tenant_access ON public.doc_os_versions FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS doc_os_events_tenant_select ON public.doc_os_events;
CREATE POLICY doc_os_events_tenant_select ON public.doc_os_events FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS doc_os_events_tenant_insert ON public.doc_os_events;
CREATE POLICY doc_os_events_tenant_insert ON public.doc_os_events FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS doc_os_signatures_tenant_access ON public.doc_os_signature_envelopes;
CREATE POLICY doc_os_signatures_tenant_access ON public.doc_os_signature_envelopes FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS doc_os_approvals_tenant_access ON public.doc_os_approvals;
CREATE POLICY doc_os_approvals_tenant_access ON public.doc_os_approvals FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS doc_os_retention_tenant_access ON public.doc_os_retention_policies;
CREATE POLICY doc_os_retention_tenant_access ON public.doc_os_retention_policies FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS doc_os_notifications_tenant_access ON public.doc_os_notifications;
CREATE POLICY doc_os_notifications_tenant_access ON public.doc_os_notifications FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Prevent overwriting signed versions
CREATE OR REPLACE FUNCTION public.doc_os_versions_immutable_signed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_signed = true AND (
    NEW.structured_content IS DISTINCT FROM OLD.structured_content
    OR NEW.rendered_pdf_url IS DISTINCT FROM OLD.rendered_pdf_url
    OR NEW.checksum IS DISTINCT FROM OLD.checksum
  ) THEN
    RAISE EXCEPTION 'Signed document versions are immutable';
  END IF;
  IF OLD.is_immutable = true AND NEW.version_number IS DISTINCT FROM OLD.version_number THEN
    RAISE EXCEPTION 'Version numbers are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_doc_os_versions_immutable ON public.doc_os_versions;
CREATE TRIGGER trg_doc_os_versions_immutable
  BEFORE UPDATE ON public.doc_os_versions
  FOR EACH ROW EXECUTE FUNCTION public.doc_os_versions_immutable_signed();

COMMENT ON TABLE public.doc_os_documents IS 'Alphaclone Document OS unified document records (identity is document_id, never filename)';
COMMENT ON TABLE public.doc_os_events IS 'Append-only document event ledger';
COMMENT ON TABLE public.document_brand_profiles IS 'Tenant-level document brand profile for professional PDFs';
