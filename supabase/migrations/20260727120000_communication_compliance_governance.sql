-- Shared privacy, localisation, branding, policy and communication governance.
-- Additive migration: legacy policies, tenant settings, suppressions and email records remain intact.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tenant_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  legal_company_name text NOT NULL,
  trading_name text, logo_url text, email_logo_url text, document_logo_url text,
  primary_color text, secondary_color text, accent_color text, text_color text, background_color text,
  font_preference text, postal_address text, website text, support_email text,
  privacy_contact text, legal_contact text, phone text, registration_number text, tax_number text,
  jurisdiction text, footer_text text, social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false, created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_brands_one_default_idx ON public.tenant_brands(tenant_id) WHERE is_default;

CREATE TABLE IF NOT EXISTS public.brand_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.tenant_brands(id) ON DELETE CASCADE,
  asset_type text NOT NULL, original_storage_key text NOT NULL, optimized_storage_key text,
  mime_type text NOT NULL, width integer, height integer, alt_text text NOT NULL,
  alignment text NOT NULL DEFAULT 'left', max_width integer, monochrome boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.legal_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.tenant_brands(id) ON DELETE RESTRICT, policy_type text NOT NULL,
  title text NOT NULL, slug text NOT NULL, owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);
CREATE TABLE IF NOT EXISTS public.legal_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES public.legal_policies(id) ON DELETE RESTRICT,
  version_number text NOT NULL, language text NOT NULL DEFAULT 'en', jurisdiction text NOT NULL DEFAULT 'global',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','published','superseded','archived')),
  effective_at timestamptz, published_at timestamptz, approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, content text NOT NULL, change_summary text,
  internal_notes text, public_url text, applicable_products text[] NOT NULL DEFAULT '{}',
  applicable_communication_types text[] NOT NULL DEFAULT '{}', applicable_brand_ids uuid[] NOT NULL DEFAULT '{}',
  acknowledgement_required boolean NOT NULL DEFAULT false,
  previous_version_id uuid REFERENCES public.legal_policy_versions(id) ON DELETE RESTRICT,
  integrity_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_id, version_number, language, jurisdiction)
);
CREATE TABLE IF NOT EXISTS public.legal_policy_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  policy_version_id uuid NOT NULL REFERENCES public.legal_policy_versions(id) ON DELETE RESTRICT,
  public_url text NOT NULL, published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(), withdrawn_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid, email_address text, phone text, purpose text NOT NULL, channel text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','granted','denied','withdrawn','expired','not_required','legitimate_interest_review_required','suppressed','unknown')),
  consent_wording text, policy_version_id uuid REFERENCES public.legal_policy_versions(id) ON DELETE RESTRICT,
  source text NOT NULL, collected_at timestamptz, expires_at timestamptz, withdrawn_at timestamptz,
  ip_address inet, user_agent text, region text, method text, double_opt_in_at timestamptz,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb, campaign_id uuid, retention_state text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  consent_record_id uuid NOT NULL REFERENCES public.consent_records(id) ON DELETE RESTRICT,
  event_type text NOT NULL, from_status text, to_status text, evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.communication_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_address text NOT NULL, contact_id uuid, marketing boolean NOT NULL DEFAULT false,
  newsletter boolean NOT NULL DEFAULT false, product_announcements boolean NOT NULL DEFAULT false,
  event_invitations boolean NOT NULL DEFAULT false, sales_follow_up boolean NOT NULL DEFAULT false,
  research_requests boolean NOT NULL DEFAULT false, optional_service_updates boolean NOT NULL DEFAULT true,
  preferred_language text, preferred_frequency text, preferred_topics text[] NOT NULL DEFAULT '{}',
  preferred_channels text[] NOT NULL DEFAULT ARRAY['email']::text[],
  token_hash text, token_expires_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email_address)
);
CREATE TABLE IF NOT EXISTS public.communication_preference_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_address text NOT NULL,
  event_type text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.communication_purposes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category text NOT NULL, reason_text text NOT NULL, related_record_type text, related_record_id uuid,
  requested_by_recipient boolean, campaign_id uuid, contract_id uuid, ticket_id uuid, invoice_id uuid,
  internal_notes text, created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.communication_compliance_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.email_messages(id) ON DELETE RESTRICT,
  classification text NOT NULL, purpose_id uuid REFERENCES public.communication_purposes(id) ON DELETE RESTRICT,
  sender_identity_id uuid, brand_id uuid REFERENCES public.tenant_brands(id) ON DELETE RESTRICT,
  recipient_email text NOT NULL, recipient_country text, jurisdiction_source text, jurisdiction_confidence text,
  locale text NOT NULL, locale_source text NOT NULL, consent_record_id uuid REFERENCES public.consent_records(id) ON DELETE RESTRICT,
  legal_basis text, policy_version_ids uuid[] NOT NULL DEFAULT '{}', tracking jsonb NOT NULL DEFAULT '{}'::jsonb,
  footer_resolution jsonb NOT NULL DEFAULT '{}'::jsonb, issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  ready boolean NOT NULL, approval_id uuid, checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT,
  request_number text NOT NULL UNIQUE, request_type text NOT NULL, status text NOT NULL DEFAULT 'received',
  requester_email text NOT NULL, requester_name text, jurisdiction text, details text,
  identity_status text NOT NULL DEFAULT 'pending', assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at timestamptz, completed_at timestamptz, token_hash text, token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.privacy_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT,
  privacy_request_id uuid NOT NULL REFERENCES public.privacy_requests(id) ON DELETE RESTRICT,
  event_type text NOT NULL, notes text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.data_inventory_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  data_category text NOT NULL, data_subject text NOT NULL, source text, purpose text NOT NULL, legal_basis text,
  module text NOT NULL, storage_location text NOT NULL, processor text, subprocessor text, country text,
  retention_rule_id uuid, security_classification text, deletion_method text, export_method text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.data_retention_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  data_type text NOT NULL, retention_days integer CHECK (retention_days IS NULL OR retention_days >= 0),
  deletion_method text NOT NULL, archive_method text, jurisdiction text, reason text NOT NULL,
  approver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL, reason text NOT NULL, scope jsonb NOT NULL, starts_at timestamptz NOT NULL,
  ends_at timestamptz, status text NOT NULL DEFAULT 'active', approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.tenant_brands(id) ON DELETE CASCADE, scope_type text NOT NULL,
  scope_id uuid, name text NOT NULL, html_content text NOT NULL, text_content text NOT NULL,
  confidentiality_notice text, is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.email_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.tenant_brands(id) ON DELETE RESTRICT, template_key text NOT NULL,
  version_number text NOT NULL, language text NOT NULL DEFAULT 'en', classification text NOT NULL,
  subject text NOT NULL, preheader text, html_body text NOT NULL, text_body text NOT NULL,
  required_variables text[] NOT NULL DEFAULT '{}', optional_variables text[] NOT NULL DEFAULT '{}',
  footer_type text NOT NULL DEFAULT 'resolved', tracking_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  approval_status text NOT NULL DEFAULT 'draft', created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, template_key, version_number, language)
);

CREATE INDEX IF NOT EXISTS consent_records_lookup_idx ON public.consent_records(tenant_id, lower(email_address), purpose, channel, created_at DESC);
CREATE INDEX IF NOT EXISTS compliance_checks_message_idx ON public.communication_compliance_checks(tenant_id, message_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS privacy_requests_queue_idx ON public.privacy_requests(tenant_id, status, due_at);

DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'tenant_brands','brand_assets','legal_policies','legal_policy_versions','legal_policy_publications',
    'consent_records','consent_events','communication_preferences','communication_preference_events','communication_purposes',
    'communication_compliance_checks','privacy_requests','privacy_request_events','data_inventory_records',
    'data_retention_rules','legal_holds','email_signatures','email_template_versions'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format('DROP POLICY IF EXISTS tenant_member_access ON public.%I', target);
    IF target IN ('privacy_requests','privacy_request_events') THEN
      EXECUTE format(
        'CREATE POLICY tenant_member_access ON public.%I FOR ALL TO authenticated USING (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid())) WITH CHECK (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid()))',
        target, target, target);
    ELSE
      EXECUTE format(
        'CREATE POLICY tenant_member_access ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid()))',
        target, target, target);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
