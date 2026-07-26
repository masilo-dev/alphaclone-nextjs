-- Client-centric Support OS. Additive migration: canonical CRM, email, project,
-- finance and document records are referenced, never copied.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS email_thread_id uuid REFERENCES public.email_threads(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS contact_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS ticket_type text NOT NULL DEFAULT 'question',
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS waiting_on text,
  ADD COLUMN IF NOT EXISTS team_id uuid,
  ADD COLUMN IF NOT EXISTS first_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_paused_seconds bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS satisfaction_rating smallint,
  ADD COLUMN IF NOT EXISTS satisfaction_comment text,
  ADD COLUMN IF NOT EXISTS last_customer_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_business_reply_at timestamptz;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (status IN (
  'new','open','in_progress','waiting_on_customer','waiting_on_business',
  'escalated','resolved','closed','reopened'
));
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_waiting_on_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_waiting_on_check
  CHECK (waiting_on IS NULL OR waiting_on IN ('customer','business'));
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_type_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_type_check CHECK (ticket_type IN (
  'incident','question','problem','request','billing','technical','complaint','feedback'
));
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_satisfaction_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_satisfaction_check
  CHECK (satisfaction_rating IS NULL OR satisfaction_rating BETWEEN 1 AND 5);

CREATE TABLE IF NOT EXISTS public.support_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  default_assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_team_id_fkey;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.support_teams(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.support_team_members (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.support_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('lead','agent','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.support_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('low','medium','high','urgent')),
  first_response_minutes integer NOT NULL CHECK (first_response_minutes > 0),
  resolution_minutes integer NOT NULL CHECK (resolution_minutes > 0),
  business_hours jsonb NOT NULL DEFAULT '{"timezone":"UTC","weekdays":[1,2,3,4,5],"start":"09:00","end":"17:00"}',
  holidays jsonb NOT NULL DEFAULT '[]',
  pause_on_customer boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.ticket_sla_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.support_sla_policies(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'started','paused','resumed','first_response_met','first_response_breached',
    'resolution_met','resolution_breached'
  )),
  due_at timestamptz,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  email_message_id uuid REFERENCES public.email_messages(id) ON DELETE RESTRICT,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_id uuid,
  message_type text NOT NULL CHECK (message_type IN (
    'customer_message','agent_reply','internal_note','system_event'
  )),
  body_text text,
  body_html_storage_key text,
  visibility text NOT NULL DEFAULT 'external' CHECK (visibility IN ('external','internal','system')),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE (tenant_id, email_message_id)
);

CREATE TABLE IF NOT EXISTS public.ticket_linked_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (record_type IN (
    'project','task','invoice','contract','document','meeting','lead','social_conversation'
  )),
  record_id uuid NOT NULL,
  linked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE (ticket_id, record_type, record_id)
);

CREATE TABLE IF NOT EXISTS public.ticket_watchers (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.ticket_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  seconds integer NOT NULL CHECK (seconds > 0),
  note text,
  billable boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  summary text,
  body_storage_key text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','portal','public')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.support_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_account_id uuid REFERENCES public.email_provider_accounts(id) ON DELETE RESTRICT,
  channel_type text NOT NULL CHECK (channel_type IN ('email','form','portal','social','api')),
  name text NOT NULL,
  address text,
  default_team_id uuid REFERENCES public.support_teams(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel_type, name)
);

-- Preserve all legacy support records in the canonical tickets table. The
-- legacy table remains read-only during the verification window.
INSERT INTO public.tickets (
  id, tenant_id, ticket_number, title, description, status, priority, source,
  contact_id, client_id, assigned_to, sla_due_at, resolved_at, closed_at,
  metadata, created_at, updated_at, created_by, channel, ticket_type, waiting_on
)
SELECT
  st.id, st.tenant_id, st.ticket_number, st.title, st.description,
  CASE st.status WHEN 'waiting' THEN 'waiting_on_business' ELSE st.status END,
  st.priority, COALESCE(st.source, 'general'), st.contact_id, st.client_id,
  st.assigned_to, st.sla_due_at, st.resolved_at, st.closed_at,
  COALESCE(st.metadata, '{}') || jsonb_build_object(
    'legacySupportTicketId', st.id, 'migratedAt', now()
  ),
  st.created_at, st.updated_at, COALESCE(st.assigned_to, (
    SELECT tu.user_id FROM public.tenant_users tu
    WHERE tu.tenant_id = st.tenant_id
    ORDER BY
      CASE lower(COALESCE(tu.role, ''))
        WHEN 'owner' THEN 0
        WHEN 'admin' THEN 1
        WHEN 'tenant_admin' THEN 2
        ELSE 3
      END,
      tu.user_id
    LIMIT 1
  )),
  COALESCE(st.source, 'api'),
  CASE
    WHEN st.category IN ('incident','question','problem','request','billing','technical','complaint','feedback')
      THEN st.category
    ELSE 'question'
  END,
  CASE WHEN st.status = 'waiting' THEN 'business' ELSE NULL END
FROM public.support_tickets st
WHERE NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = st.id)
ON CONFLICT (id) DO NOTHING;

-- Preserve comments as the canonical conversation without altering originals.
INSERT INTO public.ticket_messages (
  id, tenant_id, ticket_id, author_user_id, message_type, body_text, visibility, created_at,
  metadata
)
SELECT
  tc.id, t.tenant_id, tc.ticket_id, tc.user_id,
  CASE WHEN tc.is_internal THEN 'internal_note' ELSE 'agent_reply' END,
  tc.content, CASE WHEN tc.is_internal THEN 'internal' ELSE 'external' END,
  tc.created_at, jsonb_build_object('legacyTicketCommentId', tc.id)
FROM public.ticket_comments tc
JOIN public.tickets t ON t.id = tc.ticket_id
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS tickets_support_queue_idx
  ON public.tickets (tenant_id, status, priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS tickets_support_contact_idx ON public.tickets (tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS tickets_support_company_idx ON public.tickets (tenant_id, company_id);
CREATE INDEX IF NOT EXISTS tickets_email_thread_idx ON public.tickets (tenant_id, email_thread_id);
CREATE INDEX IF NOT EXISTS ticket_messages_timeline_idx
  ON public.ticket_messages (tenant_id, ticket_id, created_at);
CREATE INDEX IF NOT EXISTS ticket_linked_records_lookup_idx
  ON public.ticket_linked_records (tenant_id, record_type, record_id);
CREATE INDEX IF NOT EXISTS ticket_sla_events_timeline_idx
  ON public.ticket_sla_events (tenant_id, ticket_id, occurred_at);

CREATE OR REPLACE FUNCTION public.sync_ticket_waiting_responsibility()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.waiting_on := CASE
    WHEN NEW.status = 'waiting_on_customer' THEN 'customer'
    WHEN NEW.status IN ('new','open','in_progress','waiting_on_business','escalated','reopened')
      THEN 'business'
    ELSE NULL
  END;
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    NEW.resolved_at := now();
  END IF;
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    NEW.closed_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_ticket_waiting_responsibility ON public.tickets;
CREATE TRIGGER sync_ticket_waiting_responsibility
  BEFORE INSERT OR UPDATE OF status ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.sync_ticket_waiting_responsibility();

DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'support_teams','support_team_members','support_sla_policies','ticket_sla_events',
    'ticket_messages','ticket_linked_records','ticket_watchers','ticket_time_entries',
    'support_knowledge_articles','support_channels'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format('DROP POLICY IF EXISTS tenant_member_access ON public.%I', target);
    EXECUTE format(
      'CREATE POLICY tenant_member_access ON public.%I FOR ALL TO authenticated ' ||
      'USING (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid())) ' ||
      'WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid()))',
      target, target, target
    );
  END LOOP;
END $$;

-- Internal notes are never exposed to anonymous/portal access; authenticated
-- tenant access above is the sole policy on ticket_messages.
REVOKE ALL ON public.ticket_messages FROM anon;
NOTIFY pgrst, 'reload schema';
COMMIT;
