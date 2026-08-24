-- Tenant pricing catalog and reusable bundles
-- Enables "set price once, reuse across quote/invoice/contract flows"

create table if not exists public.tenant_service_catalog_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  service_code text,
  unit text not null default 'project' check (unit in ('hour', 'project', 'month', 'day')),
  default_price numeric(12,2) not null default 0 check (default_price >= 0),
  currency text not null default 'USD',
  tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_tenant_service_catalog_unique_name
  on public.tenant_service_catalog_items (tenant_id, lower(name));

create index if not exists idx_tenant_service_catalog_tenant_active
  on public.tenant_service_catalog_items (tenant_id, is_active, updated_at desc);

create index if not exists idx_tenant_service_catalog_code
  on public.tenant_service_catalog_items (tenant_id, service_code);

create table if not exists public.tenant_service_bundles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  currency text not null default 'USD',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_tenant_service_bundles_unique_name
  on public.tenant_service_bundles (tenant_id, lower(name));

create index if not exists idx_tenant_service_bundles_tenant_active
  on public.tenant_service_bundles (tenant_id, is_active, updated_at desc);

create table if not exists public.tenant_service_bundle_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bundle_id uuid not null references public.tenant_service_bundles(id) on delete cascade,
  catalog_item_id uuid not null references public.tenant_service_catalog_items(id) on delete restrict,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price_override numeric(12,2) check (unit_price_override >= 0),
  item_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_service_bundle_items_unique_item unique (bundle_id, catalog_item_id)
);

create index if not exists idx_tenant_service_bundle_items_bundle
  on public.tenant_service_bundle_items (bundle_id, item_order);

create index if not exists idx_tenant_service_bundle_items_tenant
  on public.tenant_service_bundle_items (tenant_id, bundle_id);

create or replace function public.set_tenant_pricing_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tenant_service_catalog_items_updated_at on public.tenant_service_catalog_items;
DROP TRIGGER IF EXISTS trg_tenant_service_catalog_items_updated_at ON public.tenant_service_catalog_items;
create trigger trg_tenant_service_catalog_items_updated_at
before update on public.tenant_service_catalog_items
for each row execute procedure public.set_tenant_pricing_updated_at();

drop trigger if exists trg_tenant_service_bundles_updated_at on public.tenant_service_bundles;
DROP TRIGGER IF EXISTS trg_tenant_service_bundles_updated_at ON public.tenant_service_bundles;
create trigger trg_tenant_service_bundles_updated_at
before update on public.tenant_service_bundles
for each row execute procedure public.set_tenant_pricing_updated_at();

drop trigger if exists trg_tenant_service_bundle_items_updated_at on public.tenant_service_bundle_items;
DROP TRIGGER IF EXISTS trg_tenant_service_bundle_items_updated_at ON public.tenant_service_bundle_items;
create trigger trg_tenant_service_bundle_items_updated_at
before update on public.tenant_service_bundle_items
for each row execute procedure public.set_tenant_pricing_updated_at();

alter table public.tenant_service_catalog_items enable row level security;
alter table public.tenant_service_bundles enable row level security;
alter table public.tenant_service_bundle_items enable row level security;

create policy tenant_service_catalog_select
  on public.tenant_service_catalog_items
  for select
  using (
    tenant_id in (
      select tenant_id from public.tenant_users where user_id = auth.uid()
    )
  );

create policy tenant_service_catalog_admin_write
  on public.tenant_service_catalog_items
  for all
  using (
    tenant_id in (
      select tenant_id from public.tenant_users
      where user_id = auth.uid()
      and role in ('tenant_admin', 'admin')
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.tenant_users
      where user_id = auth.uid()
      and role in ('tenant_admin', 'admin')
    )
  );

create policy tenant_service_bundles_select
  on public.tenant_service_bundles
  for select
  using (
    tenant_id in (
      select tenant_id from public.tenant_users where user_id = auth.uid()
    )
  );

create policy tenant_service_bundles_admin_write
  on public.tenant_service_bundles
  for all
  using (
    tenant_id in (
      select tenant_id from public.tenant_users
      where user_id = auth.uid()
      and role in ('tenant_admin', 'admin')
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.tenant_users
      where user_id = auth.uid()
      and role in ('tenant_admin', 'admin')
    )
  );

create policy tenant_service_bundle_items_select
  on public.tenant_service_bundle_items
  for select
  using (
    tenant_id in (
      select tenant_id from public.tenant_users where user_id = auth.uid()
    )
  );

create policy tenant_service_bundle_items_admin_write
  on public.tenant_service_bundle_items
  for all
  using (
    tenant_id in (
      select tenant_id from public.tenant_users
      where user_id = auth.uid()
      and role in ('tenant_admin', 'admin')
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.tenant_users
      where user_id = auth.uid()
      and role in ('tenant_admin', 'admin')
    )
  );
