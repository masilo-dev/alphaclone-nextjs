-- Legacy constraint allowed only one facebook_integrations row per tenant.
-- Product requires many rows per tenant (each member + each Page). Upserts then fail with 23505.
ALTER TABLE public.facebook_integrations
  DROP CONSTRAINT IF EXISTS unique_tenant_facebook;
