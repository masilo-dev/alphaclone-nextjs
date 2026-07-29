create table if not exists public.whatsapp_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references public.profiles(id),
  waba_id text not null,
  phone_number_id text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, waba_id)
);

create index if not exists idx_whatsapp_integrations_tenant_active on public.whatsapp_integrations(tenant_id, is_active);
create index if not exists idx_whatsapp_integrations_waba on public.whatsapp_integrations(waba_id);

alter table public.whatsapp_integrations enable row level security;

<<<<<<< HEAD
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.whatsapp_integrations;
=======
>>>>>>> origin/main
create policy "tenant_isolation_policy" on public.whatsapp_integrations
as permissive for all
to public
using (
  is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
)
with check (
  is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
);

