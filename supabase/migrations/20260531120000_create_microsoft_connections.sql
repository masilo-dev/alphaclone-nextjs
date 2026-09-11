create table if not exists public.microsoft_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz,
  microsoft_email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_microsoft_connections_user_id
  on public.microsoft_connections (user_id);

alter table public.microsoft_connections enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'microsoft_connections'
      and policyname = 'microsoft_connections_select_own'
  ) then
    create policy microsoft_connections_select_own
      on public.microsoft_connections
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'microsoft_connections'
      and policyname = 'microsoft_connections_insert_own'
  ) then
    create policy microsoft_connections_insert_own
      on public.microsoft_connections
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'microsoft_connections'
      and policyname = 'microsoft_connections_update_own'
  ) then
    create policy microsoft_connections_update_own
      on public.microsoft_connections
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'microsoft_connections'
      and policyname = 'microsoft_connections_delete_own'
  ) then
    create policy microsoft_connections_delete_own
      on public.microsoft_connections
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
