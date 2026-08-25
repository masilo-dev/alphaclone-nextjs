-- Tenant business event inbox for digest aggregation + expanded platform email templates

CREATE TABLE IF NOT EXISTS public.tenant_business_event_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  entity_type TEXT,
  entity_id TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  actor TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL UNIQUE,
  digest_status TEXT NOT NULL DEFAULT 'pending' CHECK (digest_status IN ('pending', 'sent', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_business_event_inbox_tenant_pending
  ON public.tenant_business_event_inbox (tenant_id, digest_status, created_at DESC);

ALTER TABLE public.tenant_business_event_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_business_event_inbox_select ON public.tenant_business_event_inbox;
CREATE POLICY tenant_business_event_inbox_select ON public.tenant_business_event_inbox
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = tenant_business_event_inbox.tenant_id
      AND tu.user_id = auth.uid()
  ));

REVOKE INSERT, UPDATE, DELETE ON public.tenant_business_event_inbox FROM anon, authenticated;

-- Reusable template seeds (system / tenant_id IS NULL). Insert if missing.
INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'Verify Your Email', 'Confirm your AlphaClone account', '<p>Hi {{name}}, confirm your email: <a href="{{verification_url}}">Verify</a></p>', 'Verify: {{verification_url}}', 'security', '["name","verification_url"]'::jsonb, true, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Verify Your Email' AND e.tenant_id IS NULL);

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'Verification Reminder', 'Reminder: verify your AlphaClone email', '<p><a href="{{verification_url}}">Verify now</a></p>', 'Verify: {{verification_url}}', 'security', '["name","verification_url"]'::jsonb, true, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Verification Reminder' AND e.tenant_id IS NULL);

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'Complete Workspace Setup', 'Finish setting up {{workspace_name}}', '<p>Hi {{name}}, complete onboarding to unlock CRM, invoicing, and Bonnie.</p>', 'Complete setup: {{dashboard_url}}', 'lifecycle', '["name","workspace_name","dashboard_url"]'::jsonb, true, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Complete Workspace Setup' AND e.tenant_id IS NULL);

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'End of Day Summary', 'AlphaClone handled {{actions_count}} actions today', '<p>Hi {{name}},</p><p>{{summary_html}}</p>', '{{summary_text}}', 'digest', '["name","summary_html","summary_text","actions_count","dashboard_url"]'::jsonb, true, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'End of Day Summary' AND e.tenant_id IS NULL);

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'Weekly Business Review', 'Your week in AlphaClone', '<p>{{summary_html}}</p>', '{{summary_text}}', 'digest', '["name","summary_html","summary_text","dashboard_url"]'::jsonb, true, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Weekly Business Review' AND e.tenant_id IS NULL);

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'Lead Replied', 'A lead replied — action needed', '<p>{{message}}</p>', '{{message}}', 'crm', '["name","message","action_url"]'::jsonb, true, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Lead Replied' AND e.tenant_id IS NULL);

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'Campaign Failed', 'Campaign failed: {{campaign_name}}', '<p>{{message}}</p>', '{{message}}', 'marketing', '["name","campaign_name","message","action_url"]'::jsonb, true, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Campaign Failed' AND e.tenant_id IS NULL);

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'Social Post Failed', 'Publishing failed on {{platform}}', '<p>{{message}}</p>', '{{message}}', 'social', '["name","platform","message","action_url"]'::jsonb, true, NULL, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Social Post Failed' AND e.tenant_id IS NULL);

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'Integration Disconnected', '{{integration_name}} needs reconnection', '<p>{{message}}</p>', '{{message}}', 'integrations', '["name","integration_name","message","action_url"]'::jsonb, true, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Integration Disconnected' AND e.tenant_id IS NULL);

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'MCP Action Failed', 'Automation failed: {{title}}', '<p>{{message}}</p>', '{{message}}', 'automation', '["name","title","message","action_url"]'::jsonb, true, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'MCP Action Failed' AND e.tenant_id IS NULL);

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'Inactive 3 Days', 'Your workspace still has open opportunities', '<p>{{message}}</p>', '{{message}}', 'lifecycle', '["name","message","dashboard_url"]'::jsonb, true, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Inactive 3 Days' AND e.tenant_id IS NULL);

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'Inactive 7 Days', 'While you were away in AlphaClone', '<p>{{summary_html}}</p>', '{{summary_text}}', 'lifecycle', '["name","summary_html","summary_text","dashboard_url"]'::jsonb, true, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Inactive 7 Days' AND e.tenant_id IS NULL);

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'Inactive 14 Days', 'Unused capabilities in your workspace', '<p>{{message}}</p>', '{{message}}', 'lifecycle', '["name","message","dashboard_url"]'::jsonb, true, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Inactive 14 Days' AND e.tenant_id IS NULL);

-- Enrich welcome email with notification + MCP transparency copy
UPDATE public.email_templates
SET body_html = replace(
  body_html,
  'Your AI assistant reads your workspace and surfaces the highest-leverage next action.',
  'Your AI assistant reads your workspace and surfaces the highest-leverage next action. When Bonnie or MCP changes CRM, outreach, invoices, or social data, you''ll see it in your dashboard and in your daily brief — not as spam, only when it matters.'
)
WHERE tenant_id IS NULL AND name = 'Welcome Email';
