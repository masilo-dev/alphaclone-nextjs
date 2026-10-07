-- Private evidence; public routes expose only a fixed, sanitized projection.
create table public.platform_health_checks (
 id uuid primary key default gen_random_uuid(), service_name text not null,
 status text not null check(status in ('operational','degraded','partial_outage','major_outage','maintenance')),
 latency_ms integer check(latency_ms >= 0), message text not null,
 checked_at timestamptz not null, created_at timestamptz not null default now(),
 metadata_json jsonb not null default '{}'::jsonb,
 unique(service_name,checked_at)
);
create index on public.platform_health_checks(service_name,checked_at desc);
create index on public.platform_health_checks(checked_at);
create table public.platform_health_current (like public.platform_health_checks including defaults including constraints);
create unique index on public.platform_health_current(service_name);
create table public.platform_health_daily (
 service_name text not null, day date not null, samples integer not null default 0,
 operational_samples integer not null default 0, verified_samples integer not null default 0,
 primary key(service_name,day)
);
create table public.platform_status_incidents (
 id uuid primary key default gen_random_uuid(), service_name text not null,
 status text not null, started_at timestamptz not null, resolved_at timestamptz,
 message text not null
);
create unique index on public.platform_status_incidents(service_name) where resolved_at is null;
create table public.platform_monitor_runs (minute timestamptz primary key, started_at timestamptz not null default now());
alter table public.platform_health_checks enable row level security;
alter table public.platform_health_current enable row level security;
alter table public.platform_health_daily enable row level security;
alter table public.platform_status_incidents enable row level security;
alter table public.platform_monitor_runs enable row level security;
revoke all on public.platform_health_checks,public.platform_health_current,public.platform_health_daily,public.platform_status_incidents,public.platform_monitor_runs from anon, authenticated;
grant all on public.platform_health_checks,public.platform_health_current,public.platform_health_daily,public.platform_status_incidents,public.platform_monitor_runs to service_role;

create function public.platform_monitor_claim(p_minute timestamptz) returns boolean
language plpgsql security invoker set search_path=public as $$
begin
 insert into platform_monitor_runs(minute) values(date_trunc('minute',p_minute)) on conflict do nothing;
 return found;
end; $$;

-- A real read/write/schema round trip, confined to monitoring data.
create function public.platform_monitor_database_probe() returns boolean
language plpgsql security invoker set search_path=public as $$
declare v_id uuid := gen_random_uuid(); v_read uuid;
begin
 insert into platform_health_checks(id,service_name,status,message,checked_at)
 values(v_id,'__probe','operational','probe',clock_timestamp());
 select id into v_read from platform_health_checks where id=v_id;
 delete from platform_health_checks where id=v_id;
 return v_read=v_id and to_regclass('public.platform_health_daily') is not null
 and to_regclass('public.platform_status_incidents') is not null;
end; $$;

create function public.platform_monitor_save(p_checks jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare r jsonb; v_time timestamptz; v_name text; v_status text; v_verified boolean;
begin
 for r in select value from jsonb_array_elements(p_checks) loop
  v_time := (r->>'checked_at')::timestamptz; v_name := r->>'service_name';
  v_status := r->>'status'; v_verified := coalesce((r->'metadata_json'->>'verified')::boolean,false);
  insert into platform_health_checks(service_name,status,latency_ms,message,checked_at,metadata_json)
  values(v_name,v_status,(r->>'latency_ms')::integer,r->>'message',v_time,r->'metadata_json') on conflict do nothing;
  if not found then continue; end if;
  insert into platform_health_daily values(v_name,(v_time at time zone 'UTC')::date,1,
    case when v_verified and v_status='operational' then 1 else 0 end,case when v_verified then 1 else 0 end)
  on conflict(service_name,day) do update set samples=platform_health_daily.samples+1,
   operational_samples=platform_health_daily.operational_samples+excluded.operational_samples,
   verified_samples=platform_health_daily.verified_samples+excluded.verified_samples;
  insert into platform_health_current(service_name,status,latency_ms,message,checked_at,metadata_json)
  values(v_name,v_status,(r->>'latency_ms')::integer,r->>'message',v_time,r->'metadata_json')
  on conflict(service_name) do update set status=excluded.status,latency_ms=excluded.latency_ms,
   message=excluded.message,checked_at=excluded.checked_at,metadata_json=excluded.metadata_json
   where platform_health_current.checked_at < excluded.checked_at;
  if not found then continue; end if;
  if v_verified and v_status='operational' then
   update platform_status_incidents set resolved_at=v_time where service_name=v_name and resolved_at is null;
  elsif v_verified and v_status<>'maintenance' then
   insert into platform_status_incidents(service_name,status,started_at,message)
   values(v_name,v_status,v_time,r->>'message') on conflict(service_name) where resolved_at is null
   do update set status=excluded.status,message=excluded.message;
  end if;
 end loop;
end; $$;
revoke all on function public.platform_monitor_claim(timestamptz),public.platform_monitor_database_probe(),public.platform_monitor_save(jsonb) from public,anon,authenticated;
grant execute on function public.platform_monitor_claim(timestamptz),public.platform_monitor_database_probe(),public.platform_monitor_save(jsonb) to service_role;

create table public.platform_monitor_http_requests (
 request_id bigint primary key, service_name text not null, checked_at timestamptz not null
);
alter table public.platform_monitor_http_requests enable row level security;
revoke all on public.platform_monitor_http_requests from anon,authenticated;
grant all on public.platform_monitor_http_requests to service_role;

-- This scheduler lives outside Railway and resumes after application restarts.
-- Uses the existing protected scheduler secret, never embeds credentials in migration history.
create function public.invoke_platform_monitor() returns bigint
language plpgsql security definer set search_path=public,extensions as $$
declare s jsonb; q record; r record; v_pass boolean; v_id bigint; v_base text;
begin
 -- Consume external probes from the previous minute. This records app outages
 -- even when Railway cannot execute the monitoring handler at all.
 for q in select * from platform_monitor_http_requests where checked_at < now()-interval '15 seconds' loop
  select * into r from net._http_response where id=q.request_id;
  if r.id is null and q.checked_at > now()-interval '3 minutes' then continue; end if;
  v_pass := coalesce(r.status_code=200 and not coalesce(r.timed_out,false) and r.error_msg is null,false);
  if v_pass and q.service_name='edge_website' then v_pass := position('<html' in coalesce(r.content,''))>0; end if;
  if v_pass and q.service_name='edge_api' then
   begin v_pass := (r.content::jsonb->>'status') in ('healthy','operational'); exception when others then v_pass:=false; end;
  end if;
  perform platform_monitor_save(jsonb_build_array(jsonb_build_object(
    'service_name',q.service_name,'status',case when v_pass then 'operational' else 'major_outage' end,
    'latency_ms',null,'message',case when v_pass then 'External HTTP probe passed' else 'External HTTP probe failed' end,
    'checked_at',q.checked_at,'metadata_json',jsonb_build_object('verified',true,'scope','External HTTP probe'))));
  delete from platform_monitor_http_requests where request_id=q.request_id;
 end loop;
 select settings into s from platform_global_settings where singleton_key='default';
 v_base := rtrim(coalesce(s->>'app_base_url','https://alphaclonesystems.com'),'/');
 v_id := net.http_get(url:=v_base||'/',timeout_milliseconds:=6000);
 insert into platform_monitor_http_requests values(v_id,'edge_website',date_trunc('minute',now()));
 v_id := net.http_get(url:=v_base||'/api/health',timeout_milliseconds:=6000);
 insert into platform_monitor_http_requests values(v_id,'edge_api',date_trunc('minute',now()));
 if nullif(s->>'cron_secret','') is null then raise exception 'Monitoring cron secret missing'; end if;
 return net.http_get(url:=rtrim(coalesce(s->>'app_base_url','https://alphaclonesystems.com'),'/')||'/api/cron/platform-monitoring',
 headers:=jsonb_build_object('Authorization','Bearer '||(s->>'cron_secret')),timeout_milliseconds:=55000);
end; $$;
revoke all on function public.invoke_platform_monitor() from public,anon,authenticated;
grant execute on function public.invoke_platform_monitor() to service_role;
select cron.schedule('platform-health-monitor','* * * * *','select public.invoke_platform_monitor();');
select cron.schedule('platform-health-retention','23 3 * * *',
 $$delete from public.platform_health_checks where checked_at < now()-interval '7 days';
 delete from public.platform_monitor_runs where minute < now()-interval '7 days';
 delete from public.platform_health_daily where day < current_date-90;$$);
notify pgrst,'reload schema';
