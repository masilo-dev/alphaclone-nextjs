-- User-scoped email automation hardening:
-- 1) Ensure outreach logs are attributable to a specific user
-- 2) Track provider message IDs for delivery/reply reconciliation
-- 3) Persist inbound webhook events for audit/retry

alter table public.lead_outreach_log
  add column if not exists user_id uuid,
  add column if not exists provider_message_id text,
  add column if not exists provider_event_status text,
  add column if not exists provider_last_event_at timestamptz;

create index if not exists idx_lead_outreach_log_tenant_user_created
  on public.lead_outreach_log (tenant_id, user_id, created_at desc);

create index if not exists idx_lead_outreach_log_provider_message
  on public.lead_outreach_log (tenant_id, provider, provider_message_id);

create table if not exists public.email_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid null,
  provider text not null,
  event_type text not null,
  provider_message_id text null,
  tracking_id text null,
  event_timestamp timestamptz null,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received',
  processing_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_webhook_events_tenant_provider_created
  on public.email_webhook_events (tenant_id, provider, created_at desc);

create index if not exists idx_email_webhook_events_tracking
  on public.email_webhook_events (tenant_id, tracking_id);

create index if not exists idx_email_webhook_events_provider_message
  on public.email_webhook_events (tenant_id, provider_message_id);

alter table public.email_webhook_events enable row level security;

drop policy if exists "email_webhook_events_tenant_isolation_select" on public.email_webhook_events;
<<<<<<< HEAD
DROP POLICY IF EXISTS "email_webhook_events_tenant_isolation_select" ON public.email_webhook_events;
=======
>>>>>>> origin/main
create policy "email_webhook_events_tenant_isolation_select"
  on public.email_webhook_events
  for select
  using (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = email_webhook_events.tenant_id
        and tu.user_id = auth.uid()
    )
  );

drop policy if exists "email_webhook_events_tenant_isolation_write" on public.email_webhook_events;
<<<<<<< HEAD
DROP POLICY IF EXISTS "email_webhook_events_tenant_isolation_write" ON public.email_webhook_events;
=======
>>>>>>> origin/main
create policy "email_webhook_events_tenant_isolation_write"
  on public.email_webhook_events
  for all
  using (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = email_webhook_events.tenant_id
        and tu.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = email_webhook_events.tenant_id
        and tu.user_id = auth.uid()
    )
  );

