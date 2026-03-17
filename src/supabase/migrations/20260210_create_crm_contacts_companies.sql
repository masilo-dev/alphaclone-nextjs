/**
 * CRM Architecture Foundation
 * Creates the single source of truth for customer data
 *
 * Architecture:
 * - Companies: Business entities (1 company has many contacts)
 * - Contacts: Individual people (belongs to 1 company, has many leads/deals)
 * - Leads: Marketing qualified leads (converts to contact)
 * - Deals: Sales opportunities (belongs to contact/company)
 */

-- =====================================================
-- COMPANIES TABLE
-- Single source of truth for business entities
-- =====================================================
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Basic Information
    name TEXT NOT NULL,
    legal_name TEXT, -- Full legal entity name
    website TEXT,
    industry TEXT,
    company_size TEXT, -- 'startup', 'small', 'medium', 'enterprise'
    annual_revenue DECIMAL(15,2),

    -- Contact Information
    phone TEXT,
    email TEXT,

    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'United States',

    -- Social Media
    linkedin_url TEXT,
    facebook_url TEXT,
    twitter_url TEXT,

    -- Business Details
    tax_id TEXT, -- EIN for US companies
    description TEXT,
    notes TEXT,

    -- CRM Fields
    stage TEXT DEFAULT 'lead', -- lead, prospect, customer, partner, inactive
    source TEXT, -- 'website', 'referral', 'cold_outreach', 'event', etc.
    owner_id UUID REFERENCES users(id), -- Account manager/owner

    -- Metadata
    tags TEXT[], -- Flexible tagging
    custom_fields JSONB DEFAULT '{}', -- Extensible custom data

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ, -- Soft delete

    -- Constraints
    CONSTRAINT valid_company_size CHECK (company_size IN ('startup', 'small', 'medium', 'enterprise', NULL)),
    CONSTRAINT valid_stage CHECK (stage IN ('lead', 'prospect', 'customer', 'partner', 'inactive'))
);

-- Indexes for performance
CREATE INDEX idx_companies_tenant ON companies(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_owner ON companies(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_stage ON companies(stage) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_name ON companies(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_created_at ON companies(created_at DESC);

-- Full-text search
CREATE INDEX idx_companies_search ON companies USING gin(to_tsvector('english',
    COALESCE(name, '') || ' ' ||
    COALESCE(industry, '') || ' ' ||
    COALESCE(description, '')
));

-- =====================================================
-- CONTACTS TABLE
-- Single source of truth for individual people
-- =====================================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

    -- Basic Information
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    title TEXT, -- Job title
    department TEXT,

    -- Contact Information
    email TEXT NOT NULL,
    phone TEXT,
    mobile TEXT,

    -- Address (if different from company)
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,

    -- Social Media
    linkedin_url TEXT,
    facebook_url TEXT,
    twitter_url TEXT,

    -- Professional Details
    bio TEXT,
    notes TEXT,

    -- CRM Fields
    status TEXT DEFAULT 'active', -- active, inactive, unsubscribed, bounced
    lead_source TEXT, -- Where did they come from?
    owner_id UUID REFERENCES users(id), -- Account manager/owner

    -- Lead Conversion Tracking
    original_lead_id UUID REFERENCES leads(id), -- Link back to original lead
    converted_from_lead_at TIMESTAMPTZ, -- When was lead converted?

    -- Communication Preferences
    email_opt_in BOOLEAN DEFAULT true,
    sms_opt_in BOOLEAN DEFAULT false,
    preferred_contact_method TEXT DEFAULT 'email', -- email, phone, sms

    -- Metadata
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ, -- Soft delete

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'unsubscribed', 'bounced')),
    CONSTRAINT valid_contact_method CHECK (preferred_contact_method IN ('email', 'phone', 'sms', 'any'))
);

-- Indexes
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_company ON contacts(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_owner ON contacts(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_email ON contacts(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_name ON contacts(last_name, first_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_status ON contacts(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_lead_id ON contacts(original_lead_id) WHERE deleted_at IS NULL;

-- Full-text search
CREATE INDEX idx_contacts_search ON contacts USING gin(to_tsvector('english',
    COALESCE(first_name, '') || ' ' ||
    COALESCE(last_name, '') || ' ' ||
    COALESCE(email, '') || ' ' ||
    COALESCE(title, '') || ' ' ||
    COALESCE(bio, '')
));

-- =====================================================
-- UPDATE EXISTING TABLES
-- Add foreign keys to link deals/contracts to contacts/companies
-- =====================================================

-- Add contact_id to deals table (if not exists)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);

-- Add company_id to deals table (if not exists)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);

-- Add contact_id to contracts table (if not exists)
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_contact ON contracts(contact_id);

-- Add company_id to contracts table (if not exists)
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_company ON contracts(company_id);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- Automatically update updated_at timestamps
-- =====================================================
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

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- Enforce multi-tenant isolation
-- =====================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Companies policies
CREATE POLICY tenant_companies_policy ON companies
    FOR ALL
    USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    ));

-- Contacts policies
CREATE POLICY tenant_contacts_policy ON contacts
    FOR ALL
    USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    ));

-- =====================================================
-- HELPER FUNCTIONS
-- Business logic encapsulated in database
-- =====================================================

/**
 * Convert lead to contact
 * Creates contact record and optionally company record
 * Marks original lead as converted
 */
CREATE OR REPLACE FUNCTION convert_lead_to_contact(
    p_lead_id UUID,
    p_create_company BOOLEAN DEFAULT false,
    p_company_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_lead RECORD;
    v_contact_id UUID;
    v_company_id UUID;
BEGIN
    -- Get lead data
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;

    -- Check if already converted
    IF v_lead.status = 'converted' THEN
        RAISE EXCEPTION 'Lead already converted';
    END IF;

    -- Create company if requested
    IF p_create_company AND p_company_name IS NOT NULL THEN
        INSERT INTO companies (
            tenant_id,
            name,
            industry,
            phone,
            email,
            address_line1,
            city,
            state,
            postal_code,
            country,
            stage,
            source,
            owner_id,
            created_by
        ) VALUES (
            v_lead.tenant_id,
            p_company_name,
            v_lead.industry,
            v_lead.phone,
            v_lead.email,
            v_lead.address,
            v_lead.city,
            v_lead.state,
            v_lead.postal_code,
            v_lead.country,
            'prospect',
            v_lead.source,
            v_lead.assigned_to,
            auth.uid()
        ) RETURNING id INTO v_company_id;
    END IF;

    -- Create contact
    INSERT INTO contacts (
        tenant_id,
        company_id,
        first_name,
        last_name,
        email,
        phone,
        title,
        address_line1,
        city,
        state,
        postal_code,
        country,
        status,
        lead_source,
        owner_id,
        original_lead_id,
        converted_from_lead_at,
        notes,
        created_by
    ) VALUES (
        v_lead.tenant_id,
        v_company_id,
        SPLIT_PART(v_lead.name, ' ', 1), -- First name
        CASE
            WHEN ARRAY_LENGTH(STRING_TO_ARRAY(v_lead.name, ' '), 1) > 1
            THEN SUBSTRING(v_lead.name FROM LENGTH(SPLIT_PART(v_lead.name, ' ', 1)) + 2)
            ELSE ''
        END, -- Last name
        v_lead.email,
        v_lead.phone,
        v_lead.job_title,
        v_lead.address,
        v_lead.city,
        v_lead.state,
        v_lead.postal_code,
        v_lead.country,
        'active',
        v_lead.source,
        v_lead.assigned_to,
        v_lead.id,
        NOW(),
        v_lead.notes,
        auth.uid()
    ) RETURNING id INTO v_contact_id;

    -- Update lead status
    UPDATE leads
    SET
        status = 'converted',
        updated_at = NOW()
    WHERE id = p_lead_id;

    RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Get contact with company details
 */
CREATE OR REPLACE FUNCTION get_contact_with_company(p_contact_id UUID)
RETURNS JSON AS $$
    SELECT json_build_object(
        'contact', row_to_json(c.*),
        'company', row_to_json(co.*)
    )
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    WHERE c.id = p_contact_id
    AND c.deleted_at IS NULL;
$$ LANGUAGE sql STABLE;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE companies IS 'Business entities - single source of truth for companies';
COMMENT ON TABLE contacts IS 'Individual people - single source of truth for contacts';
COMMENT ON COLUMN contacts.original_lead_id IS 'Links back to the lead that was converted to this contact';
COMMENT ON FUNCTION convert_lead_to_contact IS 'Converts a lead to a contact, optionally creating a company';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT ALL ON companies TO authenticated;
GRANT ALL ON contacts TO authenticated;
