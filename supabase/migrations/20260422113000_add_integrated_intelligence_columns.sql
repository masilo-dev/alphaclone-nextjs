alter table if exists public.leads
  add column if not exists intelligence_score numeric(5,2),
  add column if not exists intelligence_confidence numeric(5,2),
  add column if not exists intelligence_state jsonb default '{}'::jsonb,
  add column if not exists intelligence_recommendations text[] default '{}'::text[],
  add column if not exists psychology_profile text[] default '{}'::text[];

alter table if exists public.deals
  add column if not exists intelligence_score numeric(5,2),
  add column if not exists intelligence_confidence numeric(5,2),
  add column if not exists intelligence_state jsonb default '{}'::jsonb,
  add column if not exists intelligence_recommendations text[] default '{}'::text[],
  add column if not exists psychology_profile text[] default '{}'::text[];

create index if not exists idx_leads_intelligence_score on public.leads (tenant_id, intelligence_score desc);
create index if not exists idx_deals_intelligence_score on public.deals (tenant_id, intelligence_score desc);
