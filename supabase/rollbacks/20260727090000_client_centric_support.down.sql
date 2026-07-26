-- Rollback removes only new support structures. Historical tickets, comments,
-- email records, CRM links and legacy support_tickets are intentionally retained.
BEGIN;
DROP TRIGGER IF EXISTS sync_ticket_waiting_responsibility ON public.tickets;
DROP FUNCTION IF EXISTS public.sync_ticket_waiting_responsibility();
DROP TABLE IF EXISTS public.ticket_time_entries;
DROP TABLE IF EXISTS public.ticket_watchers;
DROP TABLE IF EXISTS public.ticket_linked_records;
DROP TABLE IF EXISTS public.ticket_messages;
DROP TABLE IF EXISTS public.ticket_sla_events;
DROP TABLE IF EXISTS public.support_channels;
DROP TABLE IF EXISTS public.support_knowledge_articles;
DROP TABLE IF EXISTS public.support_team_members;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_team_id_fkey;
DROP TABLE IF EXISTS public.support_teams;
DROP TABLE IF EXISTS public.support_sla_policies;
ALTER TABLE public.tickets
  DROP COLUMN IF EXISTS email_thread_id,
  DROP COLUMN IF EXISTS company_id,
  DROP COLUMN IF EXISTS ticket_type,
  DROP COLUMN IF EXISTS channel,
  DROP COLUMN IF EXISTS waiting_on,
  DROP COLUMN IF EXISTS team_id,
  DROP COLUMN IF EXISTS first_response_due_at,
  DROP COLUMN IF EXISTS resolution_due_at,
  DROP COLUMN IF EXISTS first_responded_at,
  DROP COLUMN IF EXISTS sla_paused_at,
  DROP COLUMN IF EXISTS sla_paused_seconds,
  DROP COLUMN IF EXISTS escalated_at,
  DROP COLUMN IF EXISTS satisfaction_rating,
  DROP COLUMN IF EXISTS satisfaction_comment,
  DROP COLUMN IF EXISTS last_customer_reply_at,
  DROP COLUMN IF EXISTS last_business_reply_at;
NOTIFY pgrst, 'reload schema';
COMMIT;
