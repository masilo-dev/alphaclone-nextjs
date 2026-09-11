-- Phase 1 automation runtime for MCP playbooks and verification

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid null,
  playbook_id text not null,
  status text not null default 'running',
  inputs jsonb not null default '{}'::jsonb,
  policy jsonb not null default '{}'::jsonb,
  idempotency_key text null,
  last_error text null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_run_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  step_id text not null,
  action text not null,
  status text not null default 'pending',
  risk_level text not null default 'low',
  attempt_count integer not null default 0,
  error_message text null,
  output jsonb null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  step_id text not null,
  status text not null default 'pending',
  reason text null,
  approved_by uuid null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_automation_runs_tenant_started
  on public.automation_runs (tenant_id, started_at desc);

create index if not exists idx_automation_runs_tenant_status
  on public.automation_runs (tenant_id, status);

create unique index if not exists uq_automation_runs_tenant_idempotency
  on public.automation_runs (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_automation_run_steps_tenant_run
  on public.automation_run_steps (tenant_id, run_id, created_at asc);

create index if not exists idx_automation_run_steps_tenant_status
  on public.automation_run_steps (tenant_id, status, created_at desc);

create index if not exists idx_automation_approvals_tenant_status
  on public.automation_approvals (tenant_id, status, created_at desc);

alter table public.automation_runs enable row level security;
alter table public.automation_run_steps enable row level security;
alter table public.automation_approvals enable row level security;

drop policy if exists "automation_runs_tenant_isolation_select" on public.automation_runs;
DROP POLICY IF EXISTS "automation_runs_tenant_isolation_select" ON public.automation_runs;
create policy "automation_runs_tenant_isolation_select"
  on public.automation_runs
  for select
  using (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = automation_runs.tenant_id
        and tu.user_id = auth.uid()
    )
  );

drop policy if exists "automation_runs_tenant_isolation_write" on public.automation_runs;
DROP POLICY IF EXISTS "automation_runs_tenant_isolation_write" ON public.automation_runs;
create policy "automation_runs_tenant_isolation_write"
  on public.automation_runs
  for all
  using (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = automation_runs.tenant_id
        and tu.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = automation_runs.tenant_id
        and tu.user_id = auth.uid()
    )
  );

drop policy if exists "automation_run_steps_tenant_isolation" on public.automation_run_steps;
DROP POLICY IF EXISTS "automation_run_steps_tenant_isolation" ON public.automation_run_steps;
create policy "automation_run_steps_tenant_isolation"
  on public.automation_run_steps
  for all
  using (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = automation_run_steps.tenant_id
        and tu.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = automation_run_steps.tenant_id
        and tu.user_id = auth.uid()
    )
  );

drop policy if exists "automation_approvals_tenant_isolation" on public.automation_approvals;
DROP POLICY IF EXISTS "automation_approvals_tenant_isolation" ON public.automation_approvals;
create policy "automation_approvals_tenant_isolation"
  on public.automation_approvals
  for all
  using (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = automation_approvals.tenant_id
        and tu.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = automation_approvals.tenant_id
        and tu.user_id = auth.uid()
    )
  );

