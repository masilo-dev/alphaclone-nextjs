-- Booking System 3.0 Schema

-- 1. Booking Types (Services)
create table if not exists public.booking_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  name text not null,
  slug text not null, -- generic slug like '30-min-call', unique per tenant
  description text,
  duration integer not null default 30, -- in minutes
  price decimal(10,2) default 0,
  currency text default 'USD',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(tenant_id, slug)
);

-- 2. Availability Schedules - Weekly Definitions
create table if not exists public.availability_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null, -- Optional: if tied to specific team member
  name text not null default 'Working Hours',
  is_default boolean default false,
  
  -- JSON Structure:
  -- {
  --   "mon": [{ "start": "09:00", "end": "17:00" }],
  --   "tue": [], -- Closed
  --   "wed": [{ "start": "09:00", "end": "12:00" }, { "start": "13:00", "end": "17:00" }]
  -- }
  schedule_json jsonb not null default '{}'::jsonb,
  
  -- Overrides: Specific dates that differ from weekly schedule
  -- [{"date": "2024-12-25", "slots": []}] 
  date_overrides jsonb default '[]'::jsonb,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Bookings Table (New)
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  booking_type_id uuid references public.booking_types(id) on delete set null,
  
  -- Client Details
  client_name text not null,
  client_email text not null,
  client_phone text,
  client_notes text,
  
  -- Timing
  start_time timestamptz not null,
  end_time timestamptz not null,
  time_zone text, -- Client's timezone
  
  -- Status
  status text not null default 'confirmed', -- confirmed, cancelled, completed, no_show
  
  -- Links to other systems (Legacy/Integration)
  calendar_event_id uuid references public.calendar_events(id) on delete set null,
  video_call_id uuid references public.video_calls(id) on delete set null,
  
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS Policies
alter table public.booking_types enable row level security;
alter table public.availability_schedules enable row level security;
alter table public.bookings enable row level security;

-- Types: Read public (for booking page), Write tenant_admin
create policy "Public can view active booking types"
  on public.booking_types for select
  using (true);

create policy "Tenants manage their own booking types"
  on public.booking_types for all
  using (auth.uid() in (
    select user_id from public.tenant_users where tenant_id = booking_types.tenant_id
  ));

-- Schedules: Read public (to check availability), Write tenant_admin
create policy "Public can view schedules"
  on public.availability_schedules for select
  using (true);

create policy "Tenants manage their own schedules"
  on public.availability_schedules for all
  using (auth.uid() in (
    select user_id from public.tenant_users where tenant_id = availability_schedules.tenant_id
  ));

-- Bookings: 
-- Public: create (insert) only
-- Tenant: all access
create policy "Public can create bookings"
  on public.bookings for insert
  with check (true);

create policy "Tenants manage their own bookings"
  on public.bookings for all
  using (auth.uid() in (
    select user_id from public.tenant_users where tenant_id = bookings.tenant_id
  ));
