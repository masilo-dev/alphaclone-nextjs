-- AlphaClone System - Complete Database Schema for All New Services
-- Migration: 20260112_complete_system_services.sql
-- Fixed for Supabase: uses auth.users, pgcrypto, and creates audit_logs

-- Enable pgcrypto for gen_random_uuid() (Supabase standard)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- AUDIT LOGS TABLE (Required by triggers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- RLS for audit_logs (admin only)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
CREATE POLICY audit_logs_select_policy ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
  FOR INSERT
  WITH CHECK (true); -- Allow inserts from triggers

-- ============================================================================
-- QUOTE VERSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS quote_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL,
  version INTEGER NOT NULL,
  data JSONB NOT NULL,
  changes TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_quote_versions_quote_id ON quote_versions(quote_id);
CREATE INDEX idx_quote_versions_version ON quote_versions(quote_id, version);

-- ============================================================================
-- AI USAGE TRACKING TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('gemini', 'openai', 'claude')),
  operation TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cost DECIMAL(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX idx_ai_usage_created_at ON ai_usage(created_at DESC);

CREATE TABLE IF NOT EXISTS ai_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_limit INTEGER NOT NULL DEFAULT 1000000,
  current_usage INTEGER NOT NULL DEFAULT 0,
  cost_limit DECIMAL(10, 2) NOT NULL DEFAULT 100,
  current_cost DECIMAL(10, 4) NOT NULL DEFAULT 0,
  reset_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_quotas_user_id ON ai_quotas(user_id);

-- ============================================================================
-- SECURITY THREAT DETECTION TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_threats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('failed_login', 'suspicious_activity', 'data_breach_attempt', 'unauthorized_access', 'rate_limit_exceeded')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  description TEXT NOT NULL,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'investigating', 'resolved', 'false_positive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_security_threats_type ON security_threats(type);
CREATE INDEX idx_security_threats_severity ON security_threats(severity);
CREATE INDEX idx_security_threats_status ON security_threats(status);
CREATE INDEX idx_security_threats_created_at ON security_threats(created_at DESC);

CREATE TABLE IF NOT EXISTS blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_blocked_ips_ip ON blocked_ips(ip_address);
CREATE INDEX idx_blocked_ips_expires ON blocked_ips(expires_at);

-- ============================================================================
-- LEAD AUTO-ASSIGNMENT TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_at TIMESTAMP WITH TIME ZONE,
  contacted_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);

-- ============================================================================
-- SCHEDULED BACKUPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduled_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  entities TEXT[] NOT NULL,
  active BOOLEAN DEFAULT true,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Quote Versions RLS
ALTER TABLE quote_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quote_versions_select_policy ON quote_versions;
CREATE POLICY quote_versions_select_policy ON quote_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- AI Usage RLS
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_select_policy ON ai_usage;
CREATE POLICY ai_usage_select_policy ON ai_usage
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS ai_usage_insert_policy ON ai_usage;
CREATE POLICY ai_usage_insert_policy ON ai_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- AI Quotas RLS
ALTER TABLE ai_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_quotas_select_policy ON ai_quotas;
CREATE POLICY ai_quotas_select_policy ON ai_quotas
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS ai_quotas_update_policy ON ai_quotas;
CREATE POLICY ai_quotas_update_policy ON ai_quotas
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Security Threats RLS (Admin only)
ALTER TABLE security_threats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_threats_select_policy ON security_threats;
CREATE POLICY security_threats_select_policy ON security_threats
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS security_threats_insert_policy ON security_threats;
CREATE POLICY security_threats_insert_policy ON security_threats
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Blocked IPs RLS (Admin only)
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blocked_ips_select_policy ON blocked_ips;
CREATE POLICY blocked_ips_select_policy ON blocked_ips
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Leads RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_select_policy ON leads;
CREATE POLICY leads_select_policy ON leads
  FOR SELECT
  USING (
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'sales')
    )
  );

DROP POLICY IF EXISTS leads_insert_policy ON leads;
CREATE POLICY leads_insert_policy ON leads
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'sales')
    )
  );

DROP POLICY IF EXISTS leads_update_policy ON leads;
CREATE POLICY leads_update_policy ON leads
  FOR UPDATE
  USING (
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'sales')
    )
  );

-- ============================================================================
-- AUDIT TRIGGERS
-- ============================================================================

-- AI Usage Audit Trigger
CREATE OR REPLACE FUNCTION audit_ai_usage()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    new_value,
    created_at
  ) VALUES (
    NEW.user_id,
    'ai_usage_tracked',
    'ai_usage',
    NEW.id,
    jsonb_build_object(
      'service', NEW.service,
      'operation', NEW.operation,
      'tokens_used', NEW.tokens_used,
      'cost', NEW.cost
    ),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_usage_audit_trigger ON ai_usage;
CREATE TRIGGER ai_usage_audit_trigger
  AFTER INSERT ON ai_usage
  FOR EACH ROW
  EXECUTE FUNCTION audit_ai_usage();

-- Security Threat Audit Trigger
CREATE OR REPLACE FUNCTION audit_security_threat()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    new_value,
    created_at
  ) VALUES (
    NEW.user_id,
    'security_threat_detected',
    'security_threat',
    NEW.id,
    jsonb_build_object(
      'type', NEW.type,
      'severity', NEW.severity,
      'ip_address', NEW.ip_address::text
    ),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS security_threat_audit_trigger ON security_threats;
CREATE TRIGGER security_threat_audit_trigger
  AFTER INSERT ON security_threats
  FOR EACH ROW
  EXECUTE FUNCTION audit_security_threat();

-- Lead Assignment Audit Trigger
CREATE OR REPLACE FUNCTION audit_lead_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      old_value,
      new_value,
      created_at
    ) VALUES (
      NEW.assigned_to,
      'lead_assigned',
      'lead',
      NEW.id,
      jsonb_build_object('assigned_to', OLD.assigned_to),
      jsonb_build_object('assigned_to', NEW.assigned_to),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lead_assignment_audit_trigger ON leads;
CREATE TRIGGER lead_assignment_audit_trigger
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION audit_lead_assignment();

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_service_operation ON ai_usage(service, operation);
CREATE INDEX IF NOT EXISTS idx_security_threats_user_id ON security_threats(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE quote_versions IS 'Stores version history of quotes for tracking changes and comparisons';
COMMENT ON TABLE ai_usage IS 'Tracks AI service usage for cost monitoring and quota enforcement';
COMMENT ON TABLE ai_quotas IS 'Stores monthly AI usage quotas and limits per user';
COMMENT ON TABLE security_threats IS 'Logs detected security threats and suspicious activities';
COMMENT ON TABLE blocked_ips IS 'Stores blocked IP addresses with expiration dates';
COMMENT ON TABLE leads IS 'Stores sales leads with auto-assignment and SLA tracking';
COMMENT ON TABLE scheduled_backups IS 'Configuration for automated data backups';
