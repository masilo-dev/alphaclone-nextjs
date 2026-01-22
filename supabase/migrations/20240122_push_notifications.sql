-- Create push_subscriptions table
create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text unique not null,
  keys jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.push_subscriptions enable row level security;

-- Policies
create policy "Users can manage own subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions(user_id);
