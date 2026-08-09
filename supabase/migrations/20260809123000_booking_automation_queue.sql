-- Provider-independent booking automations. This replaces Cal Workflows for
-- self-hosted Cal.diy and keeps hosted providers from owning tenant branding.

create table if not exists public.booking_automation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  trigger_event text not null check (trigger_event in ('booking.confirmed','booking.cancelled','booking.rescheduled','booking.completed')),
  recipient text not null check (recipient in ('client','host')),
  channel text not null default 'email' check (channel in ('email')),
  offset_minutes integer not null default 0,
  timing text not null default 'after_event' check (timing in ('after_event','before_start','after_end')),
  subject_template text not null,
  body_template text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  rule_id uuid references public.booking_automation_rules(id) on delete set null,
  idempotency_key text not null,
  recipient_email text not null,
  recipient_type text not null check (recipient_type in ('client','host')),
  subject text not null,
  body_html text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','cancelled')),
  attempts integer not null default 0,
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index if not exists booking_automation_rules_tenant_event_idx
  on public.booking_automation_rules (tenant_id, trigger_event, is_active);

create index if not exists booking_automation_jobs_due_idx
  on public.booking_automation_jobs (status, scheduled_for);

alter table public.booking_automation_rules enable row level security;
alter table public.booking_automation_jobs enable row level security;

drop policy if exists "Tenant members manage booking automation rules" on public.booking_automation_rules;
create policy "Tenant members manage booking automation rules"
  on public.booking_automation_rules for all to authenticated
  using (exists (
    select 1 from public.tenant_users tu
    where tu.tenant_id = booking_automation_rules.tenant_id
      and tu.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.tenant_users tu
    where tu.tenant_id = booking_automation_rules.tenant_id
      and tu.user_id = auth.uid()
  ));

drop policy if exists "Tenant members view booking automation jobs" on public.booking_automation_jobs;
create policy "Tenant members view booking automation jobs"
  on public.booking_automation_jobs for select to authenticated
  using (exists (
    select 1 from public.tenant_users tu
    where tu.tenant_id = booking_automation_jobs.tenant_id
      and tu.user_id = auth.uid()
  ));

insert into public.booking_automation_rules (
  tenant_id, name, trigger_event, recipient, offset_minutes, timing, subject_template, body_template, metadata
)
select t.id, seed.name, seed.trigger_event, seed.recipient, seed.offset_minutes, seed.timing, seed.subject_template, seed.body_template, seed.metadata
from public.tenants t
cross join (
  values
    (
      'Client confirmation',
      'booking.confirmed',
      'client',
      0,
      'after_event',
      'Confirmed: {{service_name}} on {{start_time}}',
      '<p>Hi {{client_name}},</p><p>Your booking for <strong>{{service_name}}</strong> is confirmed.</p><p><strong>When:</strong> {{start_time}}</p>{{meeting_link_html}}',
      '{"system_default":true}'::jsonb
    ),
    (
      'Host new booking notification',
      'booking.confirmed',
      'host',
      0,
      'after_event',
      'New booking: {{client_name}} - {{service_name}}',
      '<p><strong>{{client_name}}</strong> ({{client_email}}) booked <strong>{{service_name}}</strong>.</p><p><strong>When:</strong> {{start_time}}</p>{{meeting_link_html}}<p>{{client_notes}}</p>',
      '{"system_default":true}'::jsonb
    ),
    (
      'Client 24 hour reminder',
      'booking.confirmed',
      'client',
      1440,
      'before_start',
      'Reminder: {{service_name}} tomorrow',
      '<p>Hi {{client_name}},</p><p>This is a reminder for your upcoming booking with {{tenant_name}}.</p><p><strong>When:</strong> {{start_time}}</p>{{meeting_link_html}}',
      '{"system_default":true}'::jsonb
    ),
    (
      'Client 1 hour reminder',
      'booking.confirmed',
      'client',
      60,
      'before_start',
      'Starting soon: {{service_name}}',
      '<p>Hi {{client_name}},</p><p>Your booking starts soon.</p><p><strong>When:</strong> {{start_time}}</p>{{meeting_link_html}}',
      '{"system_default":true}'::jsonb
    ),
    (
      'Client follow-up',
      'booking.confirmed',
      'client',
      60,
      'after_end',
      'Thanks for meeting with {{tenant_name}}',
      '<p>Hi {{client_name}},</p><p>Thanks for meeting with {{tenant_name}}. Reply to this email if you have any follow-up questions.</p>',
      '{"system_default":true}'::jsonb
    )
) as seed(name, trigger_event, recipient, offset_minutes, timing, subject_template, body_template, metadata)
where not exists (
  select 1
  from public.booking_automation_rules existing
  where existing.tenant_id = t.id
    and existing.name = seed.name
    and existing.metadata->>'system_default' = 'true'
);
