-- Exact, user-approved MCP actions. Client roles cannot alter execution payloads.
create table if not exists public.scheduled_mcp_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  args jsonb not null check (jsonb_typeof(args) = 'object'),
  scheduled_at timestamptz not null,
  timezone text not null,
  repeat_cron text,
  approved_at timestamptz not null,
  idempotency_key text not null,
  status text not null default 'scheduled' check (status in ('scheduled','running','completed','provider_accepted','failed','unknown','cancelled')),
  claimed_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  last_error text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,idempotency_key)
);
create index if not exists scheduled_mcp_actions_due_idx on public.scheduled_mcp_actions (scheduled_at) where status='scheduled';
alter table public.scheduled_mcp_actions enable row level security;
revoke all on public.scheduled_mcp_actions from anon, authenticated;
grant select on public.scheduled_mcp_actions to authenticated;
grant all on public.scheduled_mcp_actions to service_role;
create policy scheduled_mcp_actions_workspace_read on public.scheduled_mcp_actions for select to authenticated
using (exists (select 1 from public.tenant_users tu where tu.tenant_id=scheduled_mcp_actions.tenant_id and tu.user_id=(select auth.uid())));

-- Invoker rights + service-role-only RPC. Concurrent workers claim disjoint rows.
create or replace function public.claim_due_scheduled_mcp_actions(p_limit integer default 20)
returns setof public.scheduled_mcp_actions language plpgsql security invoker set search_path='' as $$
begin
  -- Stale writes have uncertain outcomes: quarantine, never auto-resend.
  update public.scheduled_mcp_actions set status='unknown',last_error='Worker interrupted; reconcile provider outcome before resending',updated_at=now()
    where status='running' and claimed_at < now()-interval '15 minutes';
  return query with due as (
    select id from public.scheduled_mcp_actions where status='scheduled' and scheduled_at<=now()
    order by scheduled_at for update skip locked limit greatest(1,least(p_limit,100))
  ) update public.scheduled_mcp_actions a set status='running',claimed_at=now(),updated_at=now()
    from due where a.id=due.id returning a.*;
end;
$$;
revoke all on function public.claim_due_scheduled_mcp_actions(integer) from public,anon,authenticated;
grant execute on function public.claim_due_scheduled_mcp_actions(integer) to service_role;

-- Preserve exact per-step user scheduling and actor authorization for sequences.
alter table public.email_sequence_steps add column if not exists scheduled_at timestamptz;
alter table public.email_sequence_steps add column if not exists timezone text;
alter table public.email_sequence_enrollments add column if not exists scheduled_by uuid references auth.users(id);

alter table public.email_sequence_steps add column if not exists step_order integer;
