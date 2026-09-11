-- Migration: 20260308_accounting_compliance_enhancements.sql
-- Description: Adds immutable audit capabilities (fingerprinting) and strict period locking support.

-- Enable pgcrypto for SHA-256 hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add fingerprinting columns to journal_entries
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS fingerprint TEXT,
ADD COLUMN IF NOT EXISTS previous_fingerprint TEXT;

-- 2. Add fingerprinting columns to audit_logs
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS fingerprint TEXT,
ADD COLUMN IF NOT EXISTS previous_fingerprint TEXT;

-- 3. Create fingerprint generation function
CREATE OR REPLACE FUNCTION generate_record_fingerprint()
RETURNS TRIGGER AS $$
DECLARE
    prev_fingerprint TEXT;
    content_to_hash TEXT;
BEGIN
    -- Get the last fingerprint for the same tenant and table
    EXECUTE format('SELECT fingerprint FROM %I WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1', TG_TABLE_NAME)
    INTO prev_fingerprint
    USING NEW.tenant_id;

    NEW.previous_fingerprint := COALESCE(prev_fingerprint, '0000000000000000000000000000000000000000000000000000000000000000');

    -- Concatenate relevant fields for hashing
    -- For journal_entries
    IF TG_TABLE_NAME = 'journal_entries' THEN
        content_to_hash := concat_ws('|', 
            NEW.tenant_id, 
            NEW.entry_number, 
            NEW.entry_date, 
            NEW.total_debits, 
            NEW.total_credits, 
            NEW.status, 
            NEW.previous_fingerprint
        );
    -- For audit_logs
    ELSIF TG_TABLE_NAME = 'audit_logs' THEN
        content_to_hash := concat_ws('|', 
            NEW.tenant_id, 
            NEW.user_id, 
            NEW.action, 
            NEW.resource_type, 
            NEW.resource_id, 
            NEW.new_values::text, 
            NEW.previous_fingerprint
        );
    ELSE
        content_to_hash := concat_ws('|', NEW.id, NEW.previous_fingerprint);
    END IF;

    -- Generate SHA-256 fingerprint
    NEW.fingerprint := encode(digest(content_to_hash, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Apply triggers
DROP TRIGGER IF EXISTS trg_journal_entries_fingerprint ON journal_entries;
CREATE TRIGGER trg_journal_entries_fingerprint
BEFORE INSERT ON journal_entries
FOR EACH ROW EXECUTE FUNCTION generate_record_fingerprint();

DROP TRIGGER IF EXISTS trg_audit_logs_fingerprint ON audit_logs;
CREATE TRIGGER trg_audit_logs_fingerprint
BEFORE INSERT ON audit_logs
FOR EACH ROW EXECUTE FUNCTION generate_record_fingerprint();

-- 5. Add indices for fast chain verification
CREATE INDEX IF NOT EXISTS idx_journal_entries_fingerprint ON journal_entries(fingerprint);
CREATE INDEX IF NOT EXISTS idx_audit_logs_fingerprint ON audit_logs(fingerprint);

-- 6. Add Audit Trail for Accounting Periods (Strict Logging)
ALTER TABLE accounting_periods 
ADD COLUMN IF NOT EXISTS unlock_reason TEXT,
ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS unlocked_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN journal_entries.fingerprint IS 'SHA-256 chain-hash for 2026 compliance audit trail.';
