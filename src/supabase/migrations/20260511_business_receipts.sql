-- Migration: Add business_receipts table for better expense management
-- Created: 2026-05-11

CREATE TYPE receipt_status AS ENUM ('pending', 'paid', 'void');

CREATE TABLE IF NOT EXISTS business_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Receipt Data
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    category TEXT, -- Suggested category from AI
    vendor TEXT,
    
    -- Status & Payment
    status receipt_status DEFAULT 'pending',
    payment_method TEXT, -- 'cash', 'card', 'bank_transfer'
    paid_at TIMESTAMPTZ,
    
    -- Accounting Link
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    account_id UUID REFERENCES chart_of_accounts(id), -- The expense account
    asset_account_id UUID REFERENCES chart_of_accounts(id), -- The source of funds (cash/bank)
    
    -- Media
    image_url TEXT,
    raw_ai_data JSONB,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE business_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_receipts_policy ON business_receipts
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Index
CREATE INDEX idx_receipts_tenant ON business_receipts(tenant_id);
CREATE INDEX idx_receipts_status ON business_receipts(status);
CREATE INDEX idx_receipts_date ON business_receipts(receipt_date);
