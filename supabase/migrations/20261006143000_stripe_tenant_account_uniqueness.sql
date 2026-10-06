-- A provider account/customer may belong to only one AlphaClone workspace.
CREATE UNIQUE INDEX IF NOT EXISTS tenants_stripe_connect_id_unique
 ON public.tenants(stripe_connect_id) WHERE stripe_connect_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_stripe_customer_id_unique
 ON public.tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
