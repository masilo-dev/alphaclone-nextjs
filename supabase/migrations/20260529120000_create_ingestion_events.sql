-- Lead ingestion events (manual capture, webhooks, social sources)
-- Idempotent: mirrors the live production schema so repo and remote stay in sync.
create table if not exists public.ingestion_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null,
  raw_content text,
  structured_data jsonb not null default '{}'::jsonb,
  author_name text,
  author_contact text,
  url text,
  intent_score smallint not null default 0,
  intent_label text not null default 'unknown',
  keywords_found text[] not null default '{}',
  processed boolean not null default false,
  lead_id uuid references public.leads(id) on delete set null,
  workflow_triggered boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_ingestion_events_tenant_created
  on public.ingestion_events (tenant_id, created_at desc);

create index if not exists idx_ingestion_events_tenant_intent
  on public.ingestion_events (tenant_id, intent_label);

alter table public.ingestion_events enable row level security;

-- Single tenant-scoped policy covering all operations for tenant members.
drop policy if exists "Tenant members manage ingestion events" on public.ingestion_events;
DROP POLICY IF EXISTS "Tenant members manage ingestion events" ON public.ingestion_events;
create policy "Tenant members manage ingestion events"
  on public.ingestion_events for all
  using (
    tenant_id in (
      select tenant_id from public.tenant_users where user_id = auth.uid()
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.tenant_users where user_id = auth.uid()
    )
  );
