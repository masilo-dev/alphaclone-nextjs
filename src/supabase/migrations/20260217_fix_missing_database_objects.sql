-- Fix missing database objects causing 400 and 409 errors
-- 1. Create quotes table if it doesn't exist
-- 2. Create get_tenant_dashboard_stats RPC function

-- =====================================================
-- QUOTES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Quote Identification
    quote_number TEXT NOT NULL,
    name TEXT NOT NULL,
    
    -- Relationships
    contact_id UUID,
    deal_id UUID,
    template_id UUID,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
    
    -- Financial Details
    subtotal DECIMAL(15,2) DEFAULT 0.00,
    discount_amount DECIMAL(15,2) DEFAULT 0.00,
    discount_percent DECIMAL(5,2) DEFAULT 0.00,
    tax_amount DECIMAL(15,2) DEFAULT 0.00,
    tax_percent DECIMAL(5,2) DEFAULT 0.00,
    total_amount DECIMAL(15,2) DEFAULT 0.00,
    currency TEXT DEFAULT 'USD',
    
    -- Validity
    valid_until TIMESTAMPTZ,
    
    -- Tracking
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    view_count INTEGER DEFAULT 0,
    
    -- Acceptance/Rejection
    accepted_at TIMESTAMPTZ,
    accepted_by UUID,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Content
    notes TEXT,
    terms_and_conditions TEXT,
    
    -- Files
    signature_url TEXT,
    pdf_url TEXT,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT unique_quote_number_per_tenant UNIQUE (tenant_id, quote_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_tenant ON quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quotes(contact_id);
CREATE INDEX IF NOT EXISTS idx_quotes_deal ON quotes(deal_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at DESC);

-- RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Allow users to see quotes for their tenant
CREATE POLICY tenant_quotes_policy ON quotes
    FOR ALL 
    USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Updated at trigger
CREATE TRIGGER update_quotes_updated_at
    BEFORE UPDATE ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DASHBOARD STATS RPC FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_dashboard_stats(tenant_id_param UUID)
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
        'total_revenue', COALESCE((SELECT SUM(total) FROM invoices WHERE tenant_id = tenant_id_param AND status = 'paid'), 0),
        'pending_revenue', COALESCE((SELECT SUM(total) FROM invoices WHERE tenant_id = tenant_id_param AND status IN ('pending', 'sent')), 0)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_tenant_dashboard_stats(UUID) TO authenticated;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT ALL ON quotes TO authenticated;
