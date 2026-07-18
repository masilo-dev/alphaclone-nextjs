-- OAuth credentials must be scoped by workspace as well as user. A user may
-- legitimately connect different provider accounts in different workspaces.
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_user_id_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS integrations_tenant_user_type_key
  ON public.integrations (tenant_id, user_id, type);

ALTER TABLE public.hubspot_integration_secrets ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.hubspot_integration_secrets ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.hubspot_integration_secrets s SET tenant_id = i.tenant_id
FROM public.integrations i WHERE i.user_id = s.user_id AND i.type = 'hubspot' AND s.tenant_id IS NULL;
UPDATE public.hubspot_integration_secrets s SET tenant_id = membership.tenant_id
FROM (
  SELECT user_id, min(tenant_id::text)::uuid AS tenant_id
  FROM public.tenant_users GROUP BY user_id HAVING count(DISTINCT tenant_id) = 1
) membership WHERE membership.user_id = s.user_id AND s.tenant_id IS NULL;
DELETE FROM public.hubspot_integration_secrets WHERE tenant_id IS NULL;
ALTER TABLE public.hubspot_integration_secrets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.hubspot_integration_secrets DROP CONSTRAINT IF EXISTS hubspot_integration_secrets_pkey;
ALTER TABLE public.hubspot_integration_secrets ADD CONSTRAINT hubspot_integration_secrets_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS hubspot_secrets_tenant_user_key
  ON public.hubspot_integration_secrets (tenant_id, user_id);

ALTER TABLE public.google_calendar_tokens ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.google_calendar_tokens t SET tenant_id = i.tenant_id
FROM public.integrations i WHERE i.user_id = t.user_id AND i.type = 'google_calendar' AND t.tenant_id IS NULL;
UPDATE public.google_calendar_tokens t SET tenant_id = configured.tenant_id
FROM (
  SELECT configured_by, min(tenant_id::text)::uuid AS tenant_id
  FROM public.tenant_integrations
  WHERE integration_id IN ('google-calendar', 'google_calendar')
  GROUP BY configured_by HAVING count(DISTINCT tenant_id) = 1
) configured
WHERE configured.configured_by = t.user_id AND t.tenant_id IS NULL;
UPDATE public.google_calendar_tokens t SET tenant_id = membership.tenant_id
FROM (
  SELECT user_id, min(tenant_id::text)::uuid AS tenant_id
  FROM public.tenant_users GROUP BY user_id HAVING count(DISTINCT tenant_id) = 1
) membership WHERE membership.user_id = t.user_id AND t.tenant_id IS NULL;
DELETE FROM public.google_calendar_tokens WHERE tenant_id IS NULL;
ALTER TABLE public.google_calendar_tokens ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.google_calendar_tokens DROP CONSTRAINT IF EXISTS google_calendar_tokens_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_tokens_tenant_user_key
  ON public.google_calendar_tokens (tenant_id, user_id);

ALTER TABLE public.google_calendar_secrets ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.google_calendar_secrets ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.google_calendar_secrets s SET tenant_id = t.tenant_id
FROM public.google_calendar_tokens t WHERE t.user_id = s.user_id AND s.tenant_id IS NULL;
DELETE FROM public.google_calendar_secrets WHERE tenant_id IS NULL;
ALTER TABLE public.google_calendar_secrets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.google_calendar_secrets DROP CONSTRAINT IF EXISTS google_calendar_secrets_pkey;
ALTER TABLE public.google_calendar_secrets ADD CONSTRAINT google_calendar_secrets_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_secrets_tenant_user_key
  ON public.google_calendar_secrets (tenant_id, user_id);

NOTIFY pgrst, 'reload schema';
