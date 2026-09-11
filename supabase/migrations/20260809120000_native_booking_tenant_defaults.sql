-- Native white-label booking defaults for every workspace.

alter table public.tenants
  add column if not exists booking_slug text,
  add column if not exists booking_domain text,
  add column if not exists booking_provider text not null default 'native'
    check (booking_provider in ('native', 'cal_cloud', 'cal_diy')),
  add column if not exists cal_base_url text,
  add column if not exists cal_team_id text,
  add column if not exists cal_user_id text,
  add column if not exists cal_event_type_id text,
  add column if not exists cal_oauth_client_id text;

create unique index if not exists tenants_booking_slug_key
  on public.tenants (booking_slug)
  where booking_slug is not null;

create unique index if not exists tenants_booking_domain_key
  on public.tenants (lower(booking_domain))
  where booking_domain is not null;

update public.tenants
set
  booking_slug = coalesce(booking_slug, slug),
  settings = jsonb_set(
    coalesce(settings, '{}'::jsonb),
    '{booking}',
    coalesce(settings->'booking', '{}'::jsonb)
      || jsonb_build_object(
        'enabled', true,
        'publicUrl', 'https://alphaclonesystems.com/book/' || coalesce(booking_slug, slug),
        'customDomain', booking_domain,
        'provider', booking_provider,
        'availability', coalesce(settings #> '{booking,availability}', '{"days":[1,2,3,4,5],"hours":{"start":"09:00","end":"17:00"},"timezone":"UTC"}'::jsonb)
      ),
    true
  )
where slug is not null;

insert into public.booking_types (tenant_id, name, slug, description, duration, price, currency, is_active)
select
  t.id,
  'Discovery Call',
  'discovery-call',
  'A first conversation to understand the work and next steps.',
  30,
  0,
  'USD',
  true
from public.tenants t
where not exists (
  select 1
  from public.booking_types bt
  where bt.tenant_id = t.id
);
