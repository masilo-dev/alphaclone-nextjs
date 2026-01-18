-- Phase 9: Activity Tracking & Security Schema
-- Creates tables for login tracking, activity logs, and geo-blocking

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  device_type TEXT,
  browser TEXT,
  is_suspicious BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Login Sessions Table
CREATE TABLE IF NOT EXISTS login_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  login_time TIMESTAMPTZ DEFAULT NOW(),
  logout_time TIMESTAMPTZ,
  ip_address INET,
  country TEXT,
  city TEXT,
  device_info JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  session_duration INTEGER, -- in seconds
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocked Countries Table
CREATE TABLE IF NOT EXISTS blocked_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT UNIQUE NOT NULL,
  country_name TEXT NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security Alerts Table
CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'suspicious_login', 'geo_block_attempt', 'multiple_failed_logins', etc.
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  ip_address INET,
  metadata JSONB DEFAULT '{}',
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_suspicious ON activity_logs(is_suspicious) WHERE is_suspicious = TRUE;

CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id ON login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_active ON login_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_login_sessions_login_time ON login_sessions(login_time DESC);

CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_unresolved ON security_alerts(is_resolved) WHERE is_resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);

-- Pre-populate blocked countries
INSERT INTO blocked_countries (country_code, country_name, reason) VALUES
  ('NG', 'Nigeria', 'Business policy - high fraud risk'),
  ('IN', 'India', 'Business policy - spam prevention')
ON CONFLICT (country_code) DO NOTHING;

-- Function to automatically log session duration on logout
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.logout_time IS NOT NULL AND OLD.logout_time IS NULL THEN
    NEW.session_duration := EXTRACT(EPOCH FROM (NEW.logout_time - NEW.login_time))::INTEGER;
    NEW.is_active := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for session duration calculation
DROP TRIGGER IF EXISTS trigger_calculate_session_duration ON login_sessions;
CREATE TRIGGER trigger_calculate_session_duration
  BEFORE UPDATE ON login_sessions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_session_duration();

-- Function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS TRIGGER AS $$
DECLARE
  recent_countries TEXT[];
  country_count INTEGER;
BEGIN
  -- Check if user has logged in from different countries recently
  SELECT ARRAY_AGG(DISTINCT country) INTO recent_countries
  FROM login_sessions
  WHERE user_id = NEW.user_id
    AND login_time > NOW() - INTERVAL '24 hours'
    AND country IS NOT NULL;
  
  country_count := COALESCE(array_length(recent_countries, 1), 0);
  
  -- If user logged in from 3+ different countries in 24h, mark as suspicious
  IF country_count >= 3 THEN
    NEW.is_suspicious := TRUE;
    
    -- Create security alert
    INSERT INTO security_alerts (user_id, alert_type, severity, description, ip_address, metadata)
    VALUES (
      NEW.user_id,
      'suspicious_login',
      'high',
      'Multiple countries detected in 24 hours: ' || array_to_string(recent_countries, ', '),
      NEW.ip_address,
      jsonb_build_object('countries', recent_countries, 'count', country_count)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for suspicious activity detection
DROP TRIGGER IF EXISTS trigger_detect_suspicious_activity ON activity_logs;
CREATE TRIGGER trigger_detect_suspicious_activity
  BEFORE INSERT ON activity_logs
  FOR EACH ROW
  WHEN (NEW.action = 'login')
  EXECUTE FUNCTION detect_suspicious_activity();

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_logs
CREATE POLICY "Admins can view all activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for login_sessions
CREATE POLICY "Admins can view all login sessions"
  ON login_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own login sessions"
  ON login_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can manage login sessions"
  ON login_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for blocked_countries
CREATE POLICY "Everyone can view blocked countries"
  ON blocked_countries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage blocked countries"
  ON blocked_countries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for security_alerts
CREATE POLICY "Admins can view all security alerts"
  ON security_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own security alerts"
  ON security_alerts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create security alerts"
  ON security_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can resolve security alerts"
  ON security_alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
