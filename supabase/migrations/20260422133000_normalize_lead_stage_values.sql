update public.leads
set stage = 'lead'
where stage in ('Discovered', 'discovered');

