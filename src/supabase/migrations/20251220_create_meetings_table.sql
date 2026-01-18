-- Create meetings table
create table if not exists meetings (
    id uuid default uuid_generate_v4() primary key,
    title text not null,
    host_id uuid references auth.users(id) on delete cascade not null,
    attendee_id uuid references auth.users(id) on delete
    set null,
        scheduled_at timestamp with time zone not null,
        priority text check (priority in ('low', 'medium', 'high')) default 'medium',
        status text check (
            status in ('scheduled', 'completed', 'cancelled')
        ) default 'scheduled',
        created_at timestamp with time zone default now()
);
-- Enable RLS
alter table meetings enable row level security;
-- Policies
create policy "Users can view their own meetings (host or attendee)" on meetings for
select using (
        auth.uid() = host_id
        or auth.uid() = attendee_id
    );
create policy "Admins can view all meetings" on meetings for
select using (
        exists (
            select 1
            from profiles
            where id = auth.uid()
                and role = 'admin'
        )
    );
create policy "Admins and Hosts can insert meetings" on meetings for
insert with check (
        auth.uid() = host_id
        or exists (
            select 1
            from profiles
            where id = auth.uid()
                and role = 'admin'
        )
    );
create policy "Hosts and Admins can update meetings" on meetings for
update using (
        auth.uid() = host_id
        or exists (
            select 1
            from profiles
            where id = auth.uid()
                and role = 'admin'
        )
    );