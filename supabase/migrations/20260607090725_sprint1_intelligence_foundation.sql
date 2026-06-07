-- ============================================================================
-- ALPHACLONE PLATFORM INTELLIGENCE UPGRADE — SPRINT 1: DATA FOUNDATION
-- ============================================================================
-- Created: 2026-06-03
-- Safe to run: All changes use ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS
-- No tables dropped. No data deleted.
-- ============================================================================

-- ============================================================================
-- PART 1: PROJECTS INTELLIGENCE SCHEMA
-- ============================================================================

-- 1.1 Extend projects table with intelligence columns
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS budget_total       DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS budget_used        DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS velocity_score     DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS health_score       INT CHECK (health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS portal_token       UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS portal_enabled     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_completion_date DATE,
  ADD COLUMN IF NOT EXISTS auto_invoice_enabled BOOLEAN DEFAULT false;

-- 1.2 Extend tasks table with intelligence columns
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS depends_on        UUID[],
  ADD COLUMN IF NOT EXISTS estimated_hours   DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS actual_hours      DECIMAL(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hourly_rate       DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS phase             TEXT,
  ADD COLUMN IF NOT EXISTS start_date        DATE,
  ADD COLUMN IF NOT EXISTS blocked_reason    TEXT;

-- 1.3 Project Time Logs
CREATE TABLE IF NOT EXISTS project_time_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  logged_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  hours       DECIMAL(6,2) NOT NULL CHECK (hours > 0),
  logged_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_logs_project ON project_time_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_task ON project_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_tenant ON project_time_logs(tenant_id);

ALTER TABLE project_time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can manage time logs" ON project_time_logs;
CREATE POLICY "Tenant members can manage time logs"
  ON project_time_logs FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- 1.4 Project Comments (for client portal)
CREATE TABLE IF NOT EXISTS project_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL,
  author_email TEXT,
  content      TEXT NOT NULL,
  is_client    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_comments_project ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_tenant ON project_comments(tenant_id);

ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view project comments" ON project_comments;
CREATE POLICY "Tenant members can view project comments"
  ON project_comments FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- Public insert: allow anon (client portal)
DROP POLICY IF EXISTS "Anyone can submit project comments" ON project_comments;
CREATE POLICY "Anyone can submit project comments"
  ON project_comments FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 1.5 Project Snapshots (for burndown charts)
CREATE TABLE IF NOT EXISTS project_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  tasks_total     INT NOT NULL DEFAULT 0,
  tasks_complete  INT NOT NULL DEFAULT 0,
  budget_used     DECIMAL(12,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_project ON project_snapshots(project_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_tenant ON project_snapshots(tenant_id);

ALTER TABLE project_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view project snapshots" ON project_snapshots;
CREATE POLICY "Tenant members can view project snapshots"
  ON project_snapshots FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- Ensure portal_token is unique (for public portal lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_portal_token ON projects(portal_token) WHERE portal_token IS NOT NULL;

-- ============================================================================
-- PART 2: CRM INTELLIGENCE SCHEMA
-- ============================================================================

-- 2.1 Extend crm_contacts table
ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS health_score       INT CHECK (health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS lead_score         INT CHECK (lead_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS health_updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contacted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_rate      DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_value     DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_source    TEXT,
  ADD COLUMN IF NOT EXISTS referred_by        UUID REFERENCES crm_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_health_score ON crm_contacts(health_score) WHERE health_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_lead_score ON crm_contacts(lead_score) WHERE lead_score IS NOT NULL;

-- 2.2 Contact Interactions (unified activity timeline)
CREATE TABLE IF NOT EXISTS contact_interactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('email', 'whatsapp', 'call', 'meeting', 'note', 'invoice', 'contract', 'deal', 'portal_comment')),
  direction   TEXT CHECK (direction IN ('inbound', 'outbound', 'internal')),
  summary     TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_interactions_contact ON contact_interactions(contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_tenant ON contact_interactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON contact_interactions(type);

ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can manage contact interactions" ON contact_interactions;
CREATE POLICY "Tenant members can manage contact interactions"
  ON contact_interactions FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- 2.3 Strike Intel Log (AI-generated outreach intelligence)
CREATE TABLE IF NOT EXISTS strike_intel_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id        UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  reason            TEXT,
  angle             TEXT,
  suggested_message TEXT,
  best_channel      TEXT,
  best_time         TEXT,
  generated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strike_intel_contact ON strike_intel_log(contact_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_strike_intel_tenant ON strike_intel_log(tenant_id);

ALTER TABLE strike_intel_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view strike intel" ON strike_intel_log;
CREATE POLICY "Tenant members can view strike intel"
  ON strike_intel_log FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- 2.4 Follow-Up Queue
CREATE TABLE IF NOT EXISTS follow_up_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  reason          TEXT,
  priority_score  DECIMAL(8,2) DEFAULT 0,
  action_type     TEXT CHECK (action_type IN ('call', 'email', 'whatsapp', 'review_deal', 'send_invoice', 'check_in')),
  snoozed_until   TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  queue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_tenant_date ON follow_up_queue(tenant_id, queue_date, completed_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_follow_up_contact ON follow_up_queue(contact_id);

ALTER TABLE follow_up_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can manage follow-up queue" ON follow_up_queue;
CREATE POLICY "Tenant members can manage follow-up queue"
  ON follow_up_queue FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- 2.5 Lead Score History
CREATE TABLE IF NOT EXISTS lead_score_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id       UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  score         INT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_lead_score_history_lead ON lead_score_history(lead_id, snapshot_date DESC);

ALTER TABLE lead_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view lead score history" ON lead_score_history;
CREATE POLICY "Tenant members can view lead score history"
  ON lead_score_history FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- PART 3: PLATFORM INTELLIGENCE SCHEMA
-- ============================================================================

-- 3.1 Cross-Module Triggers
CREATE TABLE IF NOT EXISTS cross_module_triggers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_module   TEXT NOT NULL CHECK (trigger_module IN ('contracts', 'invoices', 'projects', 'crm', 'deals')),
  trigger_event    TEXT NOT NULL CHECK (trigger_event IN ('signed', 'paid', 'completed', 'overdue', 'created', 'stage_changed', 'viewed')),
  action_module    TEXT NOT NULL,
  action_type      TEXT NOT NULL,
  action_config    JSONB DEFAULT '{}',
  enabled          BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triggers_tenant ON cross_module_triggers(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_triggers_event ON cross_module_triggers(trigger_module, trigger_event, enabled);

ALTER TABLE cross_module_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can manage triggers" ON cross_module_triggers;
CREATE POLICY "Tenant members can manage triggers"
  ON cross_module_triggers FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- 3.2 Cross-Module Trigger Log
CREATE TABLE IF NOT EXISTS cross_module_trigger_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_id  UUID REFERENCES cross_module_triggers(id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  success     BOOLEAN NOT NULL DEFAULT true,
  error       TEXT,
  context     JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_trigger_log_tenant ON cross_module_trigger_log(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trigger_log_trigger ON cross_module_trigger_log(trigger_id, executed_at DESC);

ALTER TABLE cross_module_trigger_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view trigger log" ON cross_module_trigger_log;
CREATE POLICY "Tenant members can view trigger log"
  ON cross_module_trigger_log FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- 3.3 Business Score Snapshots
CREATE TABLE IF NOT EXISTS business_score_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  total_score        INT NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  revenue_score      INT NOT NULL CHECK (revenue_score BETWEEN 0 AND 25),
  pipeline_score     INT NOT NULL CHECK (pipeline_score BETWEEN 0 AND 25),
  delivery_score     INT NOT NULL CHECK (delivery_score BETWEEN 0 AND 25),
  relationship_score INT NOT NULL CHECK (relationship_score BETWEEN 0 AND 25),
  ai_explanation     TEXT,
  snapshot_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_biz_score_tenant ON business_score_snapshots(tenant_id, snapshot_date DESC);

ALTER TABLE business_score_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view business scores" ON business_score_snapshots;
CREATE POLICY "Tenant members can view business scores"
  ON business_score_snapshots FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- 3.4 Daily Briefs
CREATE TABLE IF NOT EXISTS daily_briefs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brief_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  content      JSONB NOT NULL DEFAULT '{}',
  delivered_at TIMESTAMPTZ,
  opened_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, brief_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_briefs_tenant ON daily_briefs(tenant_id, brief_date DESC);

ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view daily briefs" ON daily_briefs;
CREATE POLICY "Tenant members can view daily briefs"
  ON daily_briefs FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- 3.5 Extend tenants table with platform intelligence settings
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS brief_delivery_time TEXT DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS timezone            TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS revenue_goal        DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS quiet_hours_start   INT CHECK (quiet_hours_start BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS quiet_hours_end     INT CHECK (quiet_hours_end BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS momentum_target     INT DEFAULT 70;

-- ============================================================================
-- PART 4: SEED BUILT-IN CROSS-MODULE TRIGGERS (system defaults)
-- These will be copied per-tenant on first login via the trigger engine
-- ============================================================================

-- Note: These are template triggers (tenant_id = NULL means system default)
-- The trigger engine seeds them per-tenant on first use
CREATE TABLE IF NOT EXISTS system_trigger_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_module TEXT NOT NULL,
  trigger_event  TEXT NOT NULL,
  action_module  TEXT NOT NULL,
  action_type    TEXT NOT NULL,
  action_config  JSONB DEFAULT '{}',
  label          TEXT NOT NULL,
  description    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_trigger_templates (trigger_module, trigger_event, action_module, action_type, action_config, label, description)
VALUES
  ('contracts', 'signed', 'projects', 'create_project', '{"auto_name": true}', 'Contract Signed → Create Project', 'When a contract is signed, automatically create a new project linked to the client'),
  ('contracts', 'signed', 'invoices', 'create_draft_invoice', '{"auto_populate": true}', 'Contract Signed → Draft Invoice', 'When a contract is signed, create a draft invoice for the first payment'),
  ('contracts', 'signed', 'crm', 'log_interaction', '{"type": "contract", "summary": "Contract signed"}', 'Contract Signed → Log CRM Interaction', 'When a contract is signed, log it as a CRM interaction'),
  ('invoices', 'paid', 'crm', 'update_deal_won', '{}', 'Invoice Paid → Close Deal Won', 'When an invoice is paid, mark the associated deal as Closed Won'),
  ('invoices', 'paid', 'crm', 'log_interaction', '{"type": "invoice", "summary": "Invoice paid"}', 'Invoice Paid → Log CRM Interaction', 'When an invoice is paid, log it in the contact timeline'),
  ('invoices', 'overdue', 'crm', 'add_to_follow_up', '{"priority": "high"}', 'Invoice Overdue → Add to Follow-Up Queue', 'When an invoice goes overdue, add the client to the high-priority follow-up queue'),
  ('projects', 'completed', 'invoices', 'create_final_invoice', '{}', 'Project Complete → Final Invoice', 'When all tasks are done, create the final invoice draft'),
  ('projects', 'completed', 'contracts', 'mark_completed', '{}', 'Project Complete → Close Contract', 'When a project completes, update the linked contract to COMPLETED status'),
  ('crm', 'created', 'crm', 'calculate_lead_score', '{}', 'Lead Created → Score Lead', 'When a lead is created, automatically calculate their lead score'),
  ('deals', 'stage_changed', 'crm', 'update_health_score', '{}', 'Deal Stage Changed → Update Health Score', 'When a deal moves stage, recalculate the contact relationship health score')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES (run these to confirm migration success)
-- ============================================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'projects' AND column_name IN ('budget_total', 'health_score', 'portal_token');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks' AND column_name IN ('depends_on', 'estimated_hours', 'phase');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'crm_contacts' AND column_name IN ('health_score', 'lead_score', 'lifetime_value');
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('project_time_logs', 'project_comments', 'project_snapshots', 'contact_interactions', 'strike_intel_log', 'follow_up_queue', 'lead_score_history', 'cross_module_triggers', 'business_score_snapshots', 'daily_briefs', 'system_trigger_templates');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants' AND column_name IN ('brief_delivery_time', 'timezone', 'revenue_goal');
