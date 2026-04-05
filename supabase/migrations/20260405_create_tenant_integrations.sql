-- Migration: tenant_integrations
-- Stores per-tenant connection state for each integration.
-- The integration catalog (metadata) lives in the application code (integrationService.ts).

create table if not exists public.tenant_integrations (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  integration_id    text not null,                  -- matches INTEGRATION_CATALOG[].id
  status            text not null default 'available'
                    check (status in ('available','connected','disabled','coming_soon')),
  connected_at      timestamptz,
  configured_by     uuid references auth.users(id) on delete set null,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint tenant_integrations_unique unique (tenant_id, integration_id)
);

-- Indexes
create index if not exists idx_tenant_integrations_tenant_id
  on public.tenant_integrations (tenant_id);

create index if not exists idx_tenant_integrations_status
  on public.tenant_integrations (tenant_id, status);

-- Auto-update updated_at
create or replace function public.set_tenant_integrations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tenant_integrations_updated_at on public.tenant_integrations;
create trigger trg_tenant_integrations_updated_at
  before update on public.tenant_integrations
  for each row execute procedure public.set_tenant_integrations_updated_at();

-- RLS
alter table public.tenant_integrations enable row level security;

-- Tenant admins can read/write their own integrations
create policy "tenant_integrations_tenant_admin_all"
  on public.tenant_integrations
  for all
  using (
    tenant_id in (
      select tenant_id from public.tenant_users
      where user_id = auth.uid()
      and role in ('tenant_admin','admin')
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.tenant_users
      where user_id = auth.uid()
      and role in ('tenant_admin','admin')
    )
  );

-- System admins can read all
create policy "tenant_integrations_admin_read"
  on public.tenant_integrations
  for select
  using (
    exists (
      select 1 from auth.users
      where id = auth.uid()
      and raw_user_meta_data->>'role' = 'admin'
    )
  );
