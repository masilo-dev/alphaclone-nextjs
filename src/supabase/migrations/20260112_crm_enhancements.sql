-- Client Notes Table for CRM Timeline
CREATE TABLE IF NOT EXISTS client_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_client ON client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_created ON client_notes(created_at DESC);

-- RLS for client notes
DROP POLICY IF EXISTS client_notes_select_policy ON client_notes;
DROP POLICY IF EXISTS client_notes_insert_policy ON client_notes;
DROP POLICY IF EXISTS client_notes_update_policy ON client_notes;
DROP POLICY IF EXISTS client_notes_delete_policy ON client_notes;

-- Only admins can see and manage client notes
CREATE POLICY client_notes_select_policy ON client_notes
  FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

CREATE POLICY client_notes_insert_policy ON client_notes
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

CREATE POLICY client_notes_update_policy ON client_notes
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

CREATE POLICY client_notes_delete_policy ON client_notes
  FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

-- Audit trigger for client notes
CREATE OR REPLACE FUNCTION log_client_note_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
    VALUES (
      auth.uid(),
      'client_note_added',
      'client_note',
      NEW.id,
      to_jsonb(NEW)
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (
      auth.uid(),
      'client_note_updated',
      'client_note',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value)
    VALUES (
      auth.uid(),
      'client_note_deleted',
      'client_note',
      OLD.id,
      to_jsonb(OLD)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS client_note_audit_trigger ON client_notes;
CREATE TRIGGER client_note_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON client_notes
  FOR EACH ROW EXECUTE FUNCTION log_client_note_changes();

GRANT SELECT, INSERT, UPDATE, DELETE ON client_notes TO authenticated;
