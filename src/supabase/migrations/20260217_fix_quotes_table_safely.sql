-- Fix quotes table 409 conflict
-- The table exists but is missing columns or has wrong schema
-- This migration safely adds missing columns

-- First, ensure the table exists (in case it doesn't)
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Now add all the missing columns (using IF NOT EXISTS equivalent with DO block)
DO $$ 
BEGIN
    -- Quote Identification
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'quote_number') THEN
        ALTER TABLE quotes ADD COLUMN quote_number TEXT NOT NULL DEFAULT 'TEMP-' || gen_random_uuid()::text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'name') THEN
        ALTER TABLE quotes ADD COLUMN name TEXT NOT NULL DEFAULT 'Untitled Quote';
    END IF;
    
    -- Relationships
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'contact_id') THEN
        ALTER TABLE quotes ADD COLUMN contact_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'deal_id') THEN
        ALTER TABLE quotes ADD COLUMN deal_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'template_id') THEN
        ALTER TABLE quotes ADD COLUMN template_id UUID;
    END IF;
    
    -- Status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'status') THEN
        ALTER TABLE quotes ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
    END IF;
    
    -- Financial Details
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'subtotal') THEN
        ALTER TABLE quotes ADD COLUMN subtotal DECIMAL(15,2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'discount_amount') THEN
        ALTER TABLE quotes ADD COLUMN discount_amount DECIMAL(15,2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'discount_percent') THEN
        ALTER TABLE quotes ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'tax_amount') THEN
        ALTER TABLE quotes ADD COLUMN tax_amount DECIMAL(15,2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'tax_percent') THEN
        ALTER TABLE quotes ADD COLUMN tax_percent DECIMAL(5,2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'total_amount') THEN
        ALTER TABLE quotes ADD COLUMN total_amount DECIMAL(15,2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'currency') THEN
        ALTER TABLE quotes ADD COLUMN currency TEXT DEFAULT 'USD';
    END IF;
    
    -- Validity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'valid_until') THEN
        ALTER TABLE quotes ADD COLUMN valid_until TIMESTAMPTZ;
    END IF;
    
    -- Tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'sent_at') THEN
        ALTER TABLE quotes ADD COLUMN sent_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'viewed_at') THEN
        ALTER TABLE quotes ADD COLUMN viewed_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'view_count') THEN
        ALTER TABLE quotes ADD COLUMN view_count INTEGER DEFAULT 0;
    END IF;
    
    -- Acceptance/Rejection
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'accepted_at') THEN
        ALTER TABLE quotes ADD COLUMN accepted_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'accepted_by') THEN
        ALTER TABLE quotes ADD COLUMN accepted_by UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'rejected_at') THEN
        ALTER TABLE quotes ADD COLUMN rejected_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'rejection_reason') THEN
        ALTER TABLE quotes ADD COLUMN rejection_reason TEXT;
    END IF;
    
    -- Content
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'notes') THEN
        ALTER TABLE quotes ADD COLUMN notes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'terms_and_conditions') THEN
        ALTER TABLE quotes ADD COLUMN terms_and_conditions TEXT;
    END IF;
    
    -- Files
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'signature_url') THEN
        ALTER TABLE quotes ADD COLUMN signature_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'pdf_url') THEN
        ALTER TABLE quotes ADD COLUMN pdf_url TEXT;
    END IF;
    
    -- Audit
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'created_by') THEN
        ALTER TABLE quotes ADD COLUMN created_by UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'updated_at') THEN
        ALTER TABLE quotes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'metadata') THEN
        ALTER TABLE quotes ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_tenant_id_fkey') THEN
        ALTER TABLE quotes ADD CONSTRAINT quotes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_created_by_fkey') THEN
        ALTER TABLE quotes ADD CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_quotes_tenant ON quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quotes(contact_id);
CREATE INDEX IF NOT EXISTS idx_quotes_deal ON quotes(deal_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at DESC);

-- Enable RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS tenant_quotes_policy ON quotes;
CREATE POLICY tenant_quotes_policy ON quotes
    FOR ALL 
    USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Add updated_at trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_quotes_updated_at ON quotes;
CREATE TRIGGER update_quotes_updated_at
    BEFORE UPDATE ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Drop existing function first to avoid return type conflict
DROP FUNCTION IF EXISTS get_tenant_dashboard_stats(UUID);

-- Create the dashboard stats function
CREATE FUNCTION get_tenant_dashboard_stats(tenant_id_param UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_projects', COALESCE((SELECT COUNT(*) FROM projects WHERE tenant_id = tenant_id_param), 0),
        'total_invoices', COALESCE((SELECT COUNT(*) FROM invoices WHERE tenant_id = tenant_id_param), 0),
        'total_clients', COALESCE((SELECT COUNT(*) FROM business_clients WHERE tenant_id = tenant_id_param), 0),
        'total_leads', COALESCE((SELECT COUNT(*) FROM leads WHERE tenant_id = tenant_id_param), 0),
        'total_deals', COALESCE((SELECT COUNT(*) FROM deals WHERE tenant_id = tenant_id_param), 0),
        'total_quotes', COALESCE((SELECT COUNT(*) FROM quotes WHERE tenant_id = tenant_id_param), 0),
        'total_messages', COALESCE((SELECT COUNT(*) FROM messages WHERE tenant_id = tenant_id_param), 0),
        'pending_invoices', COALESCE((SELECT COUNT(*) FROM invoices WHERE tenant_id = tenant_id_param AND status = 'pending'), 0),
        'overdue_invoices', COALESCE((SELECT COUNT(*) FROM invoices WHERE tenant_id = tenant_id_param AND status = 'overdue'), 0),
        'total_revenue', COALESCE((SELECT SUM(amount) FROM invoices WHERE tenant_id = tenant_id_param AND status = 'paid'), 0),
        'pending_revenue', COALESCE((SELECT SUM(amount) FROM invoices WHERE tenant_id = tenant_id_param AND status IN ('pending', 'sent')), 0)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_tenant_dashboard_stats(UUID) TO authenticated;
-- =====================================================
-- PROFILES TABLE UPDATES
-- =====================================================
-- Add missing flags for improvement survey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'has_seen_exit_improvement') THEN
        ALTER TABLE profiles ADD COLUMN has_seen_exit_improvement BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'has_submitted_exit_improvement') THEN
        ALTER TABLE profiles ADD COLUMN has_submitted_exit_improvement BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

