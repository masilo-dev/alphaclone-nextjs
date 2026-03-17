-- Fix audit_lead_assignment trigger to remove reference to non-existent status column
-- The leads table uses 'stage' not 'status', but the trigger was created before this change

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS lead_assignment_audit_trigger ON leads;
DROP FUNCTION IF EXISTS audit_lead_assignment();

-- Recreate the function without status reference
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

-- Recreate the trigger
CREATE TRIGGER lead_assignment_audit_trigger
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION audit_lead_assignment();
