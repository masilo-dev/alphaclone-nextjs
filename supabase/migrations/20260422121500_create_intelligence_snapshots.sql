create table if not exists public.intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  overall_score numeric(5,2) not null,
  overall_confidence numeric(5,2) not null,
  module_scores jsonb not null default '[]'::jsonb,
  top_actions text[] not null default '{}'::text[],
  systemic_risks text[] not null default '{}'::text[],
  snapshot_payload jsonb not null default '{}'::jsonb,
  quantum_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_intelligence_snapshots_tenant_created
  on public.intelligence_snapshots (tenant_id, created_at desc);

alter table public.intelligence_snapshots enable row level security;

drop policy if exists "Users can view tenant intelligence snapshots" on public.intelligence_snapshots;
DROP POLICY IF EXISTS "Users can view tenant intelligence snapshots" ON public.intelligence_snapshots;
create policy "Users can view tenant intelligence snapshots"
  on public.intelligence_snapshots
  for select
  using (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = intelligence_snapshots.tenant_id
        and tu.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert tenant intelligence snapshots" on public.intelligence_snapshots;
DROP POLICY IF EXISTS "Users can insert tenant intelligence snapshots" ON public.intelligence_snapshots;
create policy "Users can insert tenant intelligence snapshots"
  on public.intelligence_snapshots
  for insert
  with check (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = intelligence_snapshots.tenant_id
        and tu.user_id = auth.uid()
    )
  );
