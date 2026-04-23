create table if not exists public.contract_signing_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  token text not null unique,
  signer_email text not null,
  signer_role text not null check (signer_role in ('client', 'admin')),
  expires_at timestamptz not null,
  used_at timestamptz null,
  revoked_at timestamptz null,
  created_by uuid null references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_signing_tokens_contract
  on public.contract_signing_tokens (contract_id);

create index if not exists idx_contract_signing_tokens_lookup
  on public.contract_signing_tokens (token, expires_at, used_at, revoked_at);

alter table public.contract_signing_tokens enable row level security;

drop policy if exists "contract_signing_tokens_read_tenant_users" on public.contract_signing_tokens;
create policy "contract_signing_tokens_read_tenant_users"
  on public.contract_signing_tokens
  for select
  using (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = contract_signing_tokens.tenant_id
        and tu.user_id = auth.uid()
    )
  );

drop policy if exists "contract_signing_tokens_manage_tenant_admins" on public.contract_signing_tokens;
create policy "contract_signing_tokens_manage_tenant_admins"
  on public.contract_signing_tokens
  for all
  using (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = contract_signing_tokens.tenant_id
        and tu.user_id = auth.uid()
        and tu.role in ('admin', 'tenant_admin')
    )
  )
  with check (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = contract_signing_tokens.tenant_id
        and tu.user_id = auth.uid()
        and tu.role in ('admin', 'tenant_admin')
    )
  );
