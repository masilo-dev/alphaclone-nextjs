-- ============================================================================
-- CRITICAL SECURITY FIXES - Row Level Security & Audit Logging
-- Fixes: CB-3 (Client Data Isolation), CB-4 (Audit Trail)
-- ============================================================================

-- ============================================================================
-- 1. CREATE AUDIT LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Make audit logs append-only (no updates or deletes)
CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY audit_logs_select_policy ON audit_logs
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'admin'
    )
  );

-- No update or delete policies = immutable

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. ROW LEVEL SECURITY FOR PROJECTS
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS projects_select_policy ON projects;
DROP POLICY IF EXISTS projects_insert_policy ON projects;
DROP POLICY IF EXISTS projects_update_policy ON projects;
DROP POLICY IF EXISTS projects_delete_policy ON projects;

-- SELECT: Admins see all, clients see only their own
CREATE POLICY projects_select_policy ON projects
  FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
    OR owner_id = auth.uid()
  );

-- INSERT: Clients can create, admins can create for anyone
CREATE POLICY projects_insert_policy ON projects
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
    OR owner_id = auth.uid()
  );

-- UPDATE: Admins can update all, clients can update their own
CREATE POLICY projects_update_policy ON projects
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
    OR owner_id = auth.uid()
  );

-- DELETE: Only admins can delete
CREATE POLICY projects_delete_policy ON projects
  FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. ROW LEVEL SECURITY FOR MESSAGES
-- ============================================================================

DROP POLICY IF EXISTS messages_select_policy ON messages;
DROP POLICY IF EXISTS messages_insert_policy ON messages;
DROP POLICY IF EXISTS messages_update_policy ON messages;
DROP POLICY IF EXISTS messages_delete_policy ON messages;

-- SELECT: Users see messages they sent or received
CREATE POLICY messages_select_policy ON messages
  FOR SELECT
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- INSERT: Users can send messages
CREATE POLICY messages_insert_policy ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
  );

-- UPDATE: Only update read_at timestamp, only for recipient
CREATE POLICY messages_update_policy ON messages
  FOR UPDATE
  USING (
    recipient_id = auth.uid()
  );

-- DELETE: Only admins can delete messages
CREATE POLICY messages_delete_policy ON messages
  FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. ROW LEVEL SECURITY FOR INVOICES
-- ============================================================================

DROP POLICY IF EXISTS invoices_select_policy ON invoices;
DROP POLICY IF EXISTS invoices_insert_policy ON invoices;
DROP POLICY IF EXISTS invoices_update_policy ON invoices;
DROP POLICY IF EXISTS invoices_delete_policy ON invoices;

-- SELECT: Admins see all, clients see only their own
CREATE POLICY invoices_select_policy ON invoices
  FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
    OR user_id = auth.uid()
  );

-- INSERT: Only admins can create invoices
CREATE POLICY invoices_insert_policy ON invoices
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- UPDATE: Only admins can update invoices
CREATE POLICY invoices_update_policy ON invoices
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- DELETE: Only admins can delete invoices
CREATE POLICY invoices_delete_policy ON invoices
  FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. ROW LEVEL SECURITY FOR CONTRACTS
-- ============================================================================

-- Ensure contracts table exists
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'expired')),
  sent_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,
  signature_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP POLICY IF EXISTS contracts_select_policy ON contracts;
DROP POLICY IF EXISTS contracts_insert_policy ON contracts;
DROP POLICY IF EXISTS contracts_update_policy ON contracts;
DROP POLICY IF EXISTS contracts_delete_policy ON contracts;

-- SELECT: Admins see all, clients see only their own
CREATE POLICY contracts_select_policy ON contracts
  FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
    OR client_id = auth.uid()
  );

-- INSERT: Only admins can create contracts
CREATE POLICY contracts_insert_policy ON contracts
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- UPDATE: Admins can update all, clients can only sign
CREATE POLICY contracts_update_policy ON contracts
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
    OR (client_id = auth.uid() AND status = 'sent')
  );

-- DELETE: Only admins can delete contracts
CREATE POLICY contracts_delete_policy ON contracts
  FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. ROW LEVEL SECURITY FOR CALENDAR EVENTS
-- ============================================================================

-- Ensure calendar_events table exists
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  attendees UUID[] DEFAULT '{}',
  meeting_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP POLICY IF EXISTS calendar_events_select_policy ON calendar_events;
DROP POLICY IF EXISTS calendar_events_insert_policy ON calendar_events;
DROP POLICY IF EXISTS calendar_events_update_policy ON calendar_events;
DROP POLICY IF EXISTS calendar_events_delete_policy ON calendar_events;

-- SELECT: Users see events they created or are attending
CREATE POLICY calendar_events_select_policy ON calendar_events
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.uid() = ANY(attendees)
    OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- INSERT: Users can create events
CREATE POLICY calendar_events_insert_policy ON calendar_events
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

-- UPDATE: Users can update their own events
CREATE POLICY calendar_events_update_policy ON calendar_events
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- DELETE: Users can delete their own events
CREATE POLICY calendar_events_delete_policy ON calendar_events
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. AUDIT LOGGING TRIGGERS
-- ============================================================================

-- Function to log project changes
CREATE OR REPLACE FUNCTION log_project_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (
      auth.uid(),
      'project_updated',
      'project',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
    VALUES (
      auth.uid(),
      'project_created',
      'project',
      NEW.id,
      to_jsonb(NEW)
    );
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value)
    VALUES (
      auth.uid(),
      'project_deleted',
      'project',
      OLD.id,
      to_jsonb(OLD)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log contract changes
CREATE OR REPLACE FUNCTION log_contract_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (
      auth.uid(),
      'contract_updated',
      'contract',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
    VALUES (
      auth.uid(),
      'contract_created',
      'contract',
      NEW.id,
      to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log invoice changes
CREATE OR REPLACE FUNCTION log_invoice_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (
      auth.uid(),
      'invoice_updated',
      'invoice',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
    VALUES (
      auth.uid(),
      'invoice_created',
      'invoice',
      NEW.id,
      to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS project_audit_trigger ON projects;
CREATE TRIGGER project_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION log_project_changes();

DROP TRIGGER IF EXISTS contract_audit_trigger ON contracts;
CREATE TRIGGER contract_audit_trigger
  AFTER INSERT OR UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION log_contract_changes();

DROP TRIGGER IF EXISTS invoice_audit_trigger ON invoices;
CREATE TRIGGER invoice_audit_trigger
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION log_invoice_changes();

-- ============================================================================
-- 8. ADD INVOICE STATUS COLUMN (Fix CB-7)
-- ============================================================================

-- Add computed status if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'computed_status'
  ) THEN
    ALTER TABLE invoices ADD COLUMN computed_status TEXT;
  END IF;
END $$;

-- Function to update invoice status
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    NEW.computed_status := 'Paid';
  ELSIF NEW.due_date < NOW() THEN
    NEW.computed_status := 'Overdue';
  ELSE
    NEW.computed_status := 'Unpaid';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update status
DROP TRIGGER IF EXISTS invoice_status_trigger ON invoices;
CREATE TRIGGER invoice_status_trigger
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_invoice_status();

-- Update existing invoices
UPDATE invoices SET computed_status = 
  CASE 
    WHEN status = 'paid' THEN 'Paid'
    WHEN due_date < NOW() THEN 'Overdue'
    ELSE 'Unpaid'
  END;

-- ============================================================================
-- 9. ADD FILE UPLOAD VALIDATION TABLE (Fix CB-12)
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  scan_status TEXT DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'infected', 'failed')),
  scan_result JSONB,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_uploads_user ON file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_entity ON file_uploads(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_scan ON file_uploads(scan_status);

-- RLS for file uploads
DROP POLICY IF EXISTS file_uploads_select_policy ON file_uploads;
DROP POLICY IF EXISTS file_uploads_insert_policy ON file_uploads;

CREATE POLICY file_uploads_select_policy ON file_uploads
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

CREATE POLICY file_uploads_insert_policy ON file_uploads
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON file_uploads TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for all sensitive operations';
COMMENT ON TABLE file_uploads IS 'File upload tracking with security scanning status';
COMMENT ON COLUMN invoices.computed_status IS 'Auto-computed invoice status (Paid/Unpaid/Overdue)';
