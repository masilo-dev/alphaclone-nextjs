create table if not exists public.sales_forecasts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  forecast_period text not null,
  start_date date not null,
  end_date date not null,
  owner_id uuid references public.profiles(id),
  forecasted_revenue numeric,
  weighted_pipeline_value numeric,
  actual_revenue numeric not null default 0,
  total_deals integer not null default 0,
  expected_wins integer not null default 0,
  confidence_level numeric,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_forecasts_tenant_period on public.sales_forecasts(tenant_id, start_date desc);
create index if not exists idx_sales_forecasts_owner_period on public.sales_forecasts(tenant_id, owner_id, start_date desc) where owner_id is not null;

alter table public.sales_forecasts enable row level security;

DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.sales_forecasts;
create policy "tenant_isolation_policy" on public.sales_forecasts
as permissive for all
to public
using (
  is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
)
with check (
  is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
);

create table if not exists public.deal_intelligence_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  source text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_deal_intel_events_deal on public.deal_intelligence_events(tenant_id, deal_id, created_at desc);
create index if not exists idx_deal_intel_events_type on public.deal_intelligence_events(tenant_id, event_type, created_at desc);

alter table public.deal_intelligence_events enable row level security;

DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.deal_intelligence_events;
create policy "tenant_isolation_policy" on public.deal_intelligence_events
as permissive for all
to public
using (
  is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
)
with check (
  is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
);

