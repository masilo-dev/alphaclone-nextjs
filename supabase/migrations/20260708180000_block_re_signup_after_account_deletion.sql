create table if not exists public.blocked_account_emails (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null unique,
  reason text not null default 'user_requested_permanent_delete',
  blocked_at timestamptz not null default now(),
  user_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.blocked_account_emails enable row level security;

create or replace function public.prevent_blocked_account_re_signup()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if exists (
    select 1
    from public.blocked_account_emails bae
    where bae.normalized_email = lower(trim(new.email))
  ) then
    raise exception 'This email address is permanently blocked after account deletion.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_blocked_account_re_signup_on_auth_users on auth.users;

create trigger prevent_blocked_account_re_signup_on_auth_users
before insert or update of email on auth.users
for each row
execute function public.prevent_blocked_account_re_signup();
