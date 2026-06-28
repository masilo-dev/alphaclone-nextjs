-- Pages (Notion-style) system
create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  parent_id uuid references pages(id) on delete cascade,
  title text not null default 'Untitled',
  content jsonb default '[]'::jsonb,
  icon text default '📄',
  cover_color text default null,
  is_archived boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast tree queries
create index if not exists idx_pages_tenant_id on pages(tenant_id);
create index if not exists idx_pages_parent_id on pages(parent_id);
create index if not exists idx_pages_user_id on pages(user_id);

-- RLS
alter table pages enable row level security;

DROP POLICY IF EXISTS "Tenant members can read their pages" ON pages;
create policy "Tenant members can read their pages"
  on pages for select
  using (
    tenant_id in (
      select tenant_id from tenant_users where user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant members can insert pages" ON pages;
create policy "Tenant members can insert pages"
  on pages for insert
  with check (
    tenant_id in (
      select tenant_id from tenant_users where user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant members can update their pages" ON pages;
create policy "Tenant members can update their pages"
  on pages for update
  using (
    tenant_id in (
      select tenant_id from tenant_users where user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant members can delete their pages" ON pages;
create policy "Tenant members can delete their pages"
  on pages for delete
  using (
    tenant_id in (
      select tenant_id from tenant_users where user_id = auth.uid()
    )
  );

-- Auto-update updated_at
create or replace function update_pages_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pages_updated_at on pages;
DROP TRIGGER IF EXISTS trg_pages_updated_at ON pages;
create trigger trg_pages_updated_at
  before update on pages
  for each row execute function update_pages_updated_at();
