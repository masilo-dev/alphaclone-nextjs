-- MCP event subscriptions, queue, and helper operational tables for P1-P5 expansion

create table if not exists public.mcp_event_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  event_name text not null,
  target text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mcp_event_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid null,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  task_id uuid not null,
  depends_on_task_id uuid not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, task_id, depends_on_task_id)
);

create table if not exists public.task_recurrence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  task_id uuid not null unique,
  frequency text not null,
  interval integer not null default 1,
  days_of_week jsonb null,
  day_of_month integer null,
  end_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  invoice_id uuid not null,
  position integer not null default 1,
  description text null,
  quantity numeric null,
  unit_price numeric null,
  line_total numeric null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mcp_event_subscriptions_tenant_user
  on public.mcp_event_subscriptions (tenant_id, user_id, is_active, created_at desc);

create index if not exists idx_mcp_event_queue_tenant_status
  on public.mcp_event_queue (tenant_id, status, available_at asc);

create index if not exists idx_task_dependencies_tenant_task
  on public.task_dependencies (tenant_id, task_id);

create index if not exists idx_task_recurrence_tenant_task
  on public.task_recurrence (tenant_id, task_id);

create index if not exists idx_invoice_line_items_tenant_invoice_position
  on public.invoice_line_items (tenant_id, invoice_id, position asc);

