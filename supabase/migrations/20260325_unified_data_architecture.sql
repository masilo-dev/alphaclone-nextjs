-- ============================================================================
-- UNIFIED DATA ARCHITECTURE - Core Tables
-- Migration: 20260325_unified_data_architecture.sql
-- Purpose: Create single source of truth for all customer data
-- ============================================================================

-- ============================================================================
-- 1. COMPANIES TABLE (Organizations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Basic Information
  name TEXT NOT NULL,
  domain TEXT,
  website TEXT,

  -- Classification
  industry TEXT,
  employee_count INTEGER,
  annual_revenue DECIMAL(15, 2),

  -- Lifecycle Management
  lifecycle_stage TEXT DEFAULT 'lead' CHECK (lifecycle_stage IN ('lead', 'prospect', 'customer', 'churned')),
  health_score INTEGER DEFAULT 50 CHECK (health_score BETWEEN 0 AND 100),

  -- Relationships
  parent_company_id UUID REFERENCES companies(id),

  -- Location
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',

  -- Smart Fields (Auto-updated by system)
  last_activity_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,

  -- Assignment
  assigned_to UUID REFERENCES users(id),

  -- Flexible Data
  custom_fields JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT domain_or_name_required CHECK (domain IS NOT NULL OR name IS NOT NULL)
);

-- Indexes for companies
CREATE INDEX idx_companies_tenant ON companies(tenant_id);
CREATE INDEX idx_companies_domain ON companies(domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_companies_health_score ON companies(health_score DESC);
CREATE INDEX idx_companies_lifecycle ON companies(lifecycle_stage);
CREATE INDEX idx_companies_assigned ON companies(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_companies_last_activity ON companies(last_activity_at DESC NULLS LAST);
CREATE INDEX idx_companies_next_followup ON companies(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX idx_companies_tags ON companies USING GIN(tags);
CREATE INDEX idx_companies_created ON companies(created_at DESC);

-- Full-text search for companies
CREATE INDEX idx_companies_search ON companies USING GIN(to_tsvector('english',
  coalesce(name, '') || ' ' ||
  coalesce(domain, '') || ' ' ||
  coalesce(industry, '')
));

-- ============================================================================
-- 2. CONTACTS TABLE (People)
-- ============================================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Identity
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  email TEXT,
  phone TEXT,
  mobile_phone TEXT,

  -- Professional Info
  title TEXT,
  department TEXT,

  -- Social Profiles
  linkedin_url TEXT,
  twitter_handle TEXT,

  -- Engagement Metrics
  lead_score INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  lifecycle_stage TEXT DEFAULT 'lead' CHECK (lifecycle_stage IN ('lead', 'mql', 'sql', 'opportunity', 'customer', 'evangelist', 'churned')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'bounced', 'unsubscribed')),

  -- Smart Tracking
  last_contacted_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,

  -- Communication Preferences
  email_opt_in BOOLEAN DEFAULT true,
  sms_opt_in BOOLEAN DEFAULT false,
  preferred_contact_method TEXT DEFAULT 'email' CHECK (preferred_contact_method IN ('email', 'phone', 'sms', 'linkedin')),

  -- Assignment
  assigned_to UUID REFERENCES users(id),

  -- Flexible Data
  custom_fields JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferences JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT email_or_phone_required CHECK (email IS NOT NULL OR phone IS NOT NULL OR mobile_phone IS NOT NULL),
  CONSTRAINT valid_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for contacts
CREATE UNIQUE INDEX idx_contacts_email_tenant ON contacts(email, tenant_id) WHERE email IS NOT NULL;
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_company ON contacts(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_contacts_full_name ON contacts(full_name);
CREATE INDEX idx_contacts_lead_score ON contacts(lead_score DESC);
CREATE INDEX idx_contacts_lifecycle ON contacts(lifecycle_stage);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_assigned ON contacts(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_contacts_last_activity ON contacts(last_activity_at DESC NULLS LAST);
CREATE INDEX idx_contacts_next_followup ON contacts(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX idx_contacts_created ON contacts(created_at DESC);

-- Full-text search for contacts
CREATE INDEX idx_contacts_search ON contacts USING GIN(to_tsvector('english',
  coalesce(first_name, '') || ' ' ||
  coalesce(last_name, '') || ' ' ||
  coalesce(email, '') || ' ' ||
  coalesce(title, '') || ' ' ||
  coalesce(department, '')
));

-- ============================================================================
-- 3. OPPORTUNITIES TABLE (Sales Pipeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  primary_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Deal Information
  name TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(15, 2),
  currency TEXT DEFAULT 'USD',

  -- Pipeline Management
  stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  probability INTEGER CHECK (probability BETWEEN 0 AND 100),
  expected_close_date DATE,
  actual_close_date DATE,

  -- Source Attribution
  lead_source TEXT,
  campaign_id UUID,
  referral_source TEXT,

  -- Loss Analysis
  lost_reason TEXT,
  lost_reason_detail TEXT,
  competitor TEXT,

  -- Assignment
  owner_id UUID REFERENCES users(id),

  -- Smart Tracking
  last_activity_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  days_in_stage INTEGER DEFAULT 0,
  stage_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Flexible Data
  custom_fields JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id)
);

-- Indexes for opportunities
CREATE INDEX idx_opportunities_tenant ON opportunities(tenant_id);
CREATE INDEX idx_opportunities_company ON opportunities(company_id);
CREATE INDEX idx_opportunities_contact ON opportunities(primary_contact_id) WHERE primary_contact_id IS NOT NULL;
CREATE INDEX idx_opportunities_stage ON opportunities(stage);
CREATE INDEX idx_opportunities_owner ON opportunities(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_opportunities_close_date ON opportunities(expected_close_date) WHERE expected_close_date IS NOT NULL;
CREATE INDEX idx_opportunities_amount ON opportunities(amount DESC) WHERE amount IS NOT NULL;
CREATE INDEX idx_opportunities_probability ON opportunities(probability DESC) WHERE probability IS NOT NULL;
CREATE INDEX idx_opportunities_last_activity ON opportunities(last_activity_at DESC NULLS LAST);
CREATE INDEX idx_opportunities_next_followup ON opportunities(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX idx_opportunities_tags ON opportunities USING GIN(tags);
CREATE INDEX idx_opportunities_created ON opportunities(created_at DESC);

-- Full-text search for opportunities
CREATE INDEX idx_opportunities_search ON opportunities USING GIN(to_tsvector('english',
  coalesce(name, '') || ' ' ||
  coalesce(description, '')
));

-- ============================================================================
-- 4. ACTIVITIES TABLE (Unified Timeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Polymorphic Relations (can link to any entity)
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,

  -- Activity Details
  type TEXT NOT NULL CHECK (type IN (
    'note', 'call', 'email', 'meeting', 'task',
    'contract_signed', 'invoice_sent', 'invoice_paid', 'payment_received',
    'opportunity_won', 'opportunity_lost', 'stage_change',
    'email_opened', 'email_clicked', 'form_submitted',
    'document_viewed', 'churn_risk_detected', 'health_score_change'
  )),
  subject TEXT NOT NULL,
  description TEXT,
  outcome TEXT,

  -- Actors
  created_by UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),

  -- Timing
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  due_date DATE,
  duration_minutes INTEGER,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  is_automated BOOLEAN DEFAULT false,
  source TEXT, -- manual, email, automation, integration, ai

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for activities
CREATE INDEX idx_activities_tenant ON activities(tenant_id);
CREATE INDEX idx_activities_company ON activities(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_activities_contact ON activities(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_activities_opportunity ON activities(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_activities_project ON activities(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_activities_type ON activities(type);
CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_activities_priority ON activities(priority);
CREATE INDEX idx_activities_created_by ON activities(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_activities_assigned_to ON activities(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_activities_scheduled ON activities(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_activities_due_date ON activities(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_activities_created ON activities(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_activities_company_created ON activities(company_id, created_at DESC) WHERE company_id IS NOT NULL;
CREATE INDEX idx_activities_contact_created ON activities(contact_id, created_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_activities_assigned_status ON activities(assigned_to, status) WHERE assigned_to IS NOT NULL;

-- Full-text search for activities
CREATE INDEX idx_activities_search ON activities USING GIN(to_tsvector('english',
  coalesce(subject, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(outcome, '')
));

-- ============================================================================
-- 5. UNIFIED MESSAGES TABLE (All Communication)
-- ============================================================================
CREATE TABLE IF NOT EXISTS unified_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Relations
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,

  -- Source Information
  source TEXT NOT NULL CHECK (source IN ('internal', 'gmail', 'zoho', 'sms', 'slack', 'teams')),
  external_id TEXT, -- Provider's message ID
  thread_id TEXT, -- Group related messages

  -- Message Classification
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'chat', 'sms', 'call')),

  -- Content
  subject TEXT,
  body TEXT,
  html_body TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,

  -- Parties
  from_address TEXT,
  from_name TEXT,
  to_address TEXT,
  to_name TEXT,
  cc_address TEXT,
  bcc_address TEXT,

  -- Status
  read BOOLEAN DEFAULT false,
  replied BOOLEAN DEFAULT false,
  starred BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  folder TEXT DEFAULT 'inbox', -- inbox, sent, archive, trash, spam

  -- Smart Fields (AI-powered)
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  category TEXT, -- support, sales, billing, general
  intent TEXT, -- question, complaint, request, update, feedback
  needs_response BOOLEAN DEFAULT false,
  auto_replied BOOLEAN DEFAULT false,

  -- Timing
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Search Optimization
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body, ''))
  ) STORED,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for unified_messages
CREATE INDEX idx_messages_tenant ON unified_messages(tenant_id);
CREATE INDEX idx_messages_company ON unified_messages(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_messages_contact ON unified_messages(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_messages_opportunity ON unified_messages(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_messages_source ON unified_messages(source);
CREATE INDEX idx_messages_external_id ON unified_messages(source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_messages_thread ON unified_messages(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_messages_direction ON unified_messages(direction);
CREATE INDEX idx_messages_channel ON unified_messages(channel);
CREATE INDEX idx_messages_folder ON unified_messages(folder);
CREATE INDEX idx_messages_read ON unified_messages(read) WHERE read = false;
CREATE INDEX idx_messages_needs_response ON unified_messages(needs_response) WHERE needs_response = true;
CREATE INDEX idx_messages_received ON unified_messages(received_at DESC NULLS LAST);
CREATE INDEX idx_messages_sent ON unified_messages(sent_at DESC NULLS LAST);
CREATE INDEX idx_messages_search ON unified_messages USING GIN(search_vector);
CREATE INDEX idx_messages_tags ON unified_messages USING GIN(tags);

-- Composite indexes for common queries
CREATE INDEX idx_messages_tenant_folder_received ON unified_messages(tenant_id, folder, received_at DESC);
CREATE INDEX idx_messages_contact_received ON unified_messages(contact_id, received_at DESC) WHERE contact_id IS NOT NULL;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Companies RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view their companies"
  ON companies FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can insert their companies"
  ON companies FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can update their companies"
  ON companies FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can delete their companies"
  ON companies FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- Contacts RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view their contacts"
  ON contacts FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can insert their contacts"
  ON contacts FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can update their contacts"
  ON contacts FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can delete their contacts"
  ON contacts FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- Opportunities RLS
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view their opportunities"
  ON opportunities FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can insert their opportunities"
  ON opportunities FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can update their opportunities"
  ON opportunities FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can delete their opportunities"
  ON opportunities FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- Activities RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view their activities"
  ON activities FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can insert their activities"
  ON activities FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can update their activities"
  ON activities FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can delete their activities"
  ON activities FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- Unified Messages RLS
ALTER TABLE unified_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view their messages"
  ON unified_messages FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can insert their messages"
  ON unified_messages FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can update their messages"
  ON unified_messages FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can delete their messages"
  ON unified_messages FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- 7. TRIGGERS FOR AUTO-UPDATES
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update days_in_stage for opportunities
CREATE OR REPLACE FUNCTION update_opportunity_days_in_stage()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_changed_at = NOW();
    NEW.days_in_stage = 0;
  ELSE
    NEW.days_in_stage = EXTRACT(DAY FROM NOW() - NEW.stage_changed_at)::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_opp_stage_tracking
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_days_in_stage();

-- ============================================================================
-- 8. HELPER FUNCTIONS
-- ============================================================================

-- Function to get company activity summary
CREATE OR REPLACE FUNCTION get_company_activity_summary(p_company_id UUID)
RETURNS TABLE (
  total_activities BIGINT,
  last_activity_date TIMESTAMPTZ,
  activity_types JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_activities,
    MAX(created_at) as last_activity_date,
    jsonb_object_agg(type, count) as activity_types
  FROM (
    SELECT type, COUNT(*) as count
    FROM activities
    WHERE company_id = p_company_id
    GROUP BY type
  ) sub;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate contact engagement score
CREATE OR REPLACE FUNCTION calculate_contact_engagement_score(p_contact_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_activity_count INTEGER;
  v_message_count INTEGER;
  v_days_since_contact INTEGER;
BEGIN
  -- Count activities
  SELECT COUNT(*) INTO v_activity_count
  FROM activities
  WHERE contact_id = p_contact_id
  AND created_at > NOW() - INTERVAL '90 days';

  -- Count messages
  SELECT COUNT(*) INTO v_message_count
  FROM unified_messages
  WHERE contact_id = p_contact_id
  AND received_at > NOW() - INTERVAL '90 days';

  -- Calculate days since last contact
  SELECT EXTRACT(DAY FROM NOW() - MAX(last_contacted_at))::INTEGER
  INTO v_days_since_contact
  FROM contacts
  WHERE id = p_contact_id;

  -- Calculate score (0-100)
  v_score := LEAST(100, (v_activity_count * 5) + (v_message_count * 10));

  -- Penalize for inactivity
  IF v_days_since_contact > 30 THEN
    v_score := GREATEST(0, v_score - (v_days_since_contact - 30));
  END IF;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- NOTIFY COMPLETION
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Unified Data Architecture migration completed successfully';
  RAISE NOTICE 'Created tables: companies, contacts, opportunities, activities, unified_messages';
  RAISE NOTICE 'Created indexes, RLS policies, and triggers';
  RAISE NOTICE 'Next step: Run data migration to populate from existing tables';
END $$;
