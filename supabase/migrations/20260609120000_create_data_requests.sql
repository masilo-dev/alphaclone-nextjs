create table if not exists public.data_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  request_type text not null,
  details text,
  status text default 'pending',
  created_at timestamptz default now()
);
