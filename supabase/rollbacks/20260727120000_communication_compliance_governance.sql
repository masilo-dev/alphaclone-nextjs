BEGIN;
DROP TABLE IF EXISTS public.email_template_versions, public.email_signatures, public.legal_holds,
  public.data_retention_rules, public.data_inventory_records, public.privacy_request_events,
  public.privacy_requests, public.communication_compliance_checks, public.communication_purposes,
  public.communication_preferences, public.consent_events, public.consent_records,
  public.legal_policy_publications, public.legal_policy_versions, public.legal_policies,
  public.brand_assets, public.tenant_brands;
COMMIT;
