alter table if exists public.unified_messages
  drop constraint if exists unified_messages_source_check;

alter table if exists public.unified_messages
  add constraint unified_messages_source_check check (
    source in (
      'internal',
      'gmail',
      'zoho',
      'sms',
      'slack',
      'teams',
      'brevo',
      'resend',
      'sendgrid',
      'facebook',
      'whatsapp',
      'linkedin',
      'mcp'
    )
  );

create table if not exists public.deal_stakeholders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  role text not null check (role in ('decision_maker', 'influencer', 'champion', 'blocker', 'evaluator', 'legal', 'finance', 'user')),
  influence_weight numeric not null default 0.5,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, deal_id, contact_id, role)
);

create index if not exists idx_deal_stakeholders_tenant_deal on public.deal_stakeholders(tenant_id, deal_id);
create index if not exists idx_deal_stakeholders_contact on public.deal_stakeholders(tenant_id, contact_id);

alter table public.deal_stakeholders enable row level security;

DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.deal_stakeholders;
create policy "tenant_isolation_policy" on public.deal_stakeholders
as permissive for all
to public
using (
  is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
)
with check (
  is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
);

create table if not exists public.contact_psychology_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  model_version integer not null default 1,
  confidence numeric not null default 0.5,
  big5 jsonb not null default '{}'::jsonb,
  archetypes text[] not null default '{}'::text[],
  response_metrics jsonb not null default '{}'::jsonb,
  influence_signals jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, contact_id)
);

create index if not exists idx_contact_psychology_tenant_updated on public.contact_psychology_profiles(tenant_id, updated_at desc);

alter table public.contact_psychology_profiles enable row level security;

DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.contact_psychology_profiles;
create policy "tenant_isolation_policy" on public.contact_psychology_profiles
as permissive for all
to public
using (
  is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
)
with check (
  is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
);

create table if not exists public.intelligence_correlation_models (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  model_version integer not null default 1,
  sample_size integer not null default 0,
  features text[] not null default '{}'::text[],
  correlations jsonb not null default '{}'::jsonb,
  feature_stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, model_version)
);

create index if not exists idx_intel_corr_models_tenant_updated on public.intelligence_correlation_models(tenant_id, updated_at desc);

alter table public.intelligence_correlation_models enable row level security;

DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.intelligence_correlation_models;
create policy "tenant_isolation_policy" on public.intelligence_correlation_models
as permissive for all
to public
using (
  is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
)
with check (
  is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
);

