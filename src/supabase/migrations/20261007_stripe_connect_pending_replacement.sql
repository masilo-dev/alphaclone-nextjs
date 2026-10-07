alter table public.tenants
  add column if not exists stripe_connect_pending_id text,
  add column if not exists stripe_connect_pending_previous_id text;

comment on column public.tenants.stripe_connect_pending_id is 'Replacement Stripe Connect account undergoing onboarding; not used for new payments until activated.';
comment on column public.tenants.stripe_connect_pending_previous_id is 'Current Stripe account retained while a replacement account is onboarding.';
