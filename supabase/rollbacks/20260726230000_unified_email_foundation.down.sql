-- Only use before unified-only writes are enabled. Legacy provider connections,
-- messages, logs, sender addresses and suppressions are intentionally untouched.
BEGIN;
DROP TABLE IF EXISTS public.email_delivery_events;
DROP TABLE IF EXISTS public.email_outbound_jobs;
DROP TABLE IF EXISTS public.email_message_recipients;
DROP TABLE IF EXISTS public.email_messages;
DROP TABLE IF EXISTS public.email_threads;
DROP TABLE IF EXISTS public.email_default_rules;
DROP TABLE IF EXISTS public.email_sender_identities;
DROP TABLE IF EXISTS public.email_provider_accounts;
NOTIFY pgrst, 'reload schema';
COMMIT;
