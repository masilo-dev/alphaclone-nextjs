/**
 * ============================================================
 * ALPHACLONE - CRITICAL DATABASE DEPLOYMENT
 * ============================================================
 * Run this ENTIRE script in your Supabase SQL Editor
 *
 * This deploys:
 * 1. CRM Architecture (companies, contacts tables)
 * 2. Accounting Core (chart_of_accounts, journal_entries, general_ledger)
 *
 * Instructions:
 * 1. Open your Supabase project
 * 2. Go to SQL Editor
 * 3. Copy and paste this ENTIRE file
 * 4. Click "Run" button
 * 5. Refresh your dashboard - accounting pages will now work!
 * ============================================================
 */

-- =====================================================
-- PART 1: CRM ARCHITECTURE
-- =====================================================

-- COMPANIES TABLE
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    legal_name TEXT,
    website TEXT,
    industry TEXT,
    company_size TEXT,
    annual_revenue DECIMAL(15,2),
    phone TEXT,
    email TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'United States',
    linkedin_url TEXT,
    facebook_url TEXT,
    twitter_url TEXT,
    tax_id TEXT,
    description TEXT,
    notes TEXT,
    stage TEXT DEFAULT 'lead',
    source TEXT,
    owner_id UUID REFERENCES users(id),
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT valid_company_size CHECK (company_size IN ('startup', 'small', 'medium', 'enterprise', NULL)),
    CONSTRAINT valid_stage CHECK (stage IN ('lead', 'prospect', 'customer', 'partner', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_owner ON companies(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_stage ON companies(stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name) WHERE deleted_at IS NULL;

-- CONTACTS TABLE
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    title TEXT,
    department TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    mobile TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,
    linkedin_url TEXT,
    facebook_url TEXT,
    twitter_url TEXT,
    bio TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    lead_source TEXT,
    owner_id UUID REFERENCES users(id),
    original_lead_id UUID REFERENCES leads(id),
    converted_from_lead_at TIMESTAMPTZ,
    email_opt_in BOOLEAN DEFAULT true,
    sms_opt_in BOOLEAN DEFAULT false,
    preferred_contact_method TEXT DEFAULT 'email',
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'unsubscribed', 'bounced')),
    CONSTRAINT valid_contact_method CHECK (preferred_contact_method IN ('email', 'phone', 'sms', 'any'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE deleted_at IS NULL;

-- Link deals to contacts/companies
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);

-- RLS for companies and contacts
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_companies_policy ON companies;
CREATE POLICY tenant_companies_policy ON companies
    FOR ALL
    USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS tenant_contacts_policy ON contacts;
CREATE POLICY tenant_contacts_policy ON contacts
    FOR ALL
    USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

GRANT ALL ON companies TO authenticated;
GRANT ALL ON contacts TO authenticated;

-- =====================================================
-- PART 2: ACCOUNTING CORE
-- =====================================================

-- Account Types
DO $$ BEGIN
    CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense', 'other_income', 'other_expense');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_subtype AS ENUM (
        'current_asset', 'fixed_asset', 'other_asset',
        'current_liability', 'long_term_liability',
        'equity', 'retained_earnings',
        'operating_revenue', 'non_operating_revenue',
        'cost_of_goods_sold', 'operating_expense', 'non_operating_expense'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE journal_status AS ENUM ('draft', 'posted', 'void');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE period_status AS ENUM ('open', 'closed', 'locked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CHART OF ACCOUNTS
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type account_type NOT NULL,
    account_subtype account_subtype,
    parent_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_system_account BOOLEAN DEFAULT false,
    normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    current_balance DECIMAL(15,2) DEFAULT 0.00,
    currency TEXT DEFAULT 'USD',
    allow_manual_entries BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT unique_account_code_per_tenant UNIQUE (tenant_id, account_code),
    CONSTRAINT valid_account_code CHECK (account_code ~ '^[0-9]+$')
);

CREATE INDEX IF NOT EXISTS idx_coa_tenant ON chart_of_accounts(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_coa_type ON chart_of_accounts(account_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_coa_code ON chart_of_accounts(account_code);

-- ACCOUNTING PERIODS
CREATE TABLE IF NOT EXISTS accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_name TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    period_number INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status period_status DEFAULT 'open',
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id),
    locked_at TIMESTAMPTZ,
    locked_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    CONSTRAINT valid_period_dates CHECK (end_date > start_date),
    CONSTRAINT unique_period_per_tenant UNIQUE (tenant_id, fiscal_year, period_number)
);

CREATE INDEX IF NOT EXISTS idx_periods_tenant ON accounting_periods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_periods_status ON accounting_periods(status);

-- JOURNAL ENTRIES
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entry_number TEXT NOT NULL,
    entry_date DATE NOT NULL,
    period_id UUID REFERENCES accounting_periods(id),
    description TEXT NOT NULL,
    reference TEXT,
    source_type TEXT,
    source_id UUID,
    status journal_status DEFAULT 'draft',
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES users(id),
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES users(id),
    void_reason TEXT,
    total_debits DECIMAL(15,2) DEFAULT 0.00,
    total_credits DECIMAL(15,2) DEFAULT 0.00,
    currency TEXT DEFAULT 'USD',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    CONSTRAINT unique_entry_number UNIQUE (tenant_id, entry_number),
    CONSTRAINT balanced_entry CHECK (
        status = 'draft' OR
        (status = 'posted' AND total_debits = total_credits) OR
        status = 'void'
    )
);

CREATE INDEX IF NOT EXISTS idx_je_tenant ON journal_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(entry_date);

-- JOURNAL ENTRY LINES
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    debit_amount DECIMAL(15,2) DEFAULT 0.00,
    credit_amount DECIMAL(15,2) DEFAULT 0.00,
    description TEXT,
    entity_type TEXT,
    entity_id UUID,
    currency TEXT DEFAULT 'USD',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_line_number UNIQUE (entry_id, line_number),
    CONSTRAINT valid_amounts CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (credit_amount > 0 AND debit_amount = 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_jel_entry ON journal_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_jel_tenant ON journal_entry_lines(tenant_id);

-- GENERAL LEDGER (Materialized View)
CREATE MATERIALIZED VIEW IF NOT EXISTS general_ledger AS
SELECT
    jel.tenant_id,
    jel.account_id,
    coa.account_code,
    coa.account_name,
    coa.account_type,
    je.entry_number,
    je.entry_date,
    je.period_id,
    je.description AS entry_description,
    jel.description AS line_description,
    jel.debit_amount,
    jel.credit_amount,
    je.source_type,
    je.source_id,
    je.reference,
    jel.entity_type,
    jel.entity_id,
    jel.created_at,
    je.posted_at
FROM journal_entry_lines jel
INNER JOIN journal_entries je ON jel.entry_id = je.id
INNER JOIN chart_of_accounts coa ON jel.account_id = coa.id
WHERE je.status = 'posted' AND je.voided_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gl_unique ON general_ledger(tenant_id, entry_number, line_number);
CREATE INDEX IF NOT EXISTS idx_gl_account ON general_ledger(account_id);
CREATE INDEX IF NOT EXISTS idx_gl_date ON general_ledger(entry_date);
CREATE INDEX IF NOT EXISTS idx_gl_tenant ON general_ledger(tenant_id);

-- RLS Policies
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_coa_policy ON chart_of_accounts;
CREATE POLICY tenant_coa_policy ON chart_of_accounts
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS tenant_periods_policy ON accounting_periods;
CREATE POLICY tenant_periods_policy ON accounting_periods
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS tenant_je_policy ON journal_entries;
CREATE POLICY tenant_je_policy ON journal_entries
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS tenant_jel_policy ON journal_entry_lines;
CREATE POLICY tenant_jel_policy ON journal_entry_lines
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Grants
GRANT ALL ON chart_of_accounts TO authenticated;
GRANT ALL ON accounting_periods TO authenticated;
GRANT ALL ON journal_entries TO authenticated;
GRANT ALL ON journal_entry_lines TO authenticated;
GRANT SELECT ON general_ledger TO authenticated;

-- =====================================================
-- BUSINESS FUNCTIONS
-- =====================================================

-- Generate journal entry number
CREATE OR REPLACE FUNCTION generate_entry_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_year TEXT := TO_CHAR(NOW(), 'YYYY');
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO v_count
    FROM journal_entries
    WHERE tenant_id = p_tenant_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    RETURN 'JE-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get account balance
CREATE OR REPLACE FUNCTION get_account_balance(
    p_account_id UUID,
    p_as_of_date DATE DEFAULT NULL
)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_total_debits DECIMAL(15,2);
    v_total_credits DECIMAL(15,2);
    v_balance DECIMAL(15,2);
    v_normal_balance TEXT;
BEGIN
    SELECT normal_balance INTO v_normal_balance
    FROM chart_of_accounts
    WHERE id = p_account_id;

    IF p_as_of_date IS NULL THEN
        SELECT
            COALESCE(SUM(debit_amount), 0),
            COALESCE(SUM(credit_amount), 0)
        INTO v_total_debits, v_total_credits
        FROM general_ledger
        WHERE account_id = p_account_id;
    ELSE
        SELECT
            COALESCE(SUM(debit_amount), 0),
            COALESCE(SUM(credit_amount), 0)
        INTO v_total_debits, v_total_credits
        FROM general_ledger
        WHERE account_id = p_account_id
        AND entry_date <= p_as_of_date;
    END IF;

    IF v_normal_balance = 'debit' THEN
        v_balance := v_total_debits - v_total_credits;
    ELSE
        v_balance := v_total_credits - v_total_debits;
    END IF;

    RETURN v_balance;
END;
$$ LANGUAGE plpgsql STABLE;

-- Post journal entry
CREATE OR REPLACE FUNCTION post_journal_entry(
    p_entry_id UUID,
    p_posted_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_total_debits DECIMAL(15,2);
    v_total_credits DECIMAL(15,2);
BEGIN
    SELECT total_debits, total_credits
    INTO v_total_debits, v_total_credits
    FROM journal_entries
    WHERE id = p_entry_id;

    IF v_total_debits != v_total_credits THEN
        RAISE EXCEPTION 'Entry not balanced: debits=%, credits=%', v_total_debits, v_total_credits;
    END IF;

    UPDATE journal_entries
    SET
        status = 'posted',
        posted_at = NOW(),
        posted_by = p_posted_by
    WHERE id = p_entry_id;

    REFRESH MATERIALIZED VIEW CONCURRENTLY general_ledger;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Void journal entry
CREATE OR REPLACE FUNCTION void_journal_entry(
    p_entry_id UUID,
    p_voided_by UUID,
    p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
    v_entry RECORD;
    v_reversing_entry_id UUID;
BEGIN
    SELECT * INTO v_entry FROM journal_entries WHERE id = p_entry_id;

    IF v_entry.status != 'posted' THEN
        RAISE EXCEPTION 'Only posted entries can be voided';
    END IF;

    UPDATE journal_entries
    SET
        status = 'void',
        voided_at = NOW(),
        voided_by = p_voided_by,
        void_reason = p_reason
    WHERE id = p_entry_id;

    INSERT INTO journal_entries (
        tenant_id, entry_number, entry_date, description, reference,
        source_type, source_id, status, total_debits, total_credits
    )
    VALUES (
        v_entry.tenant_id,
        generate_entry_number(v_entry.tenant_id),
        CURRENT_DATE,
        'VOID: ' || v_entry.description,
        v_entry.reference,
        'void',
        p_entry_id,
        'posted',
        v_entry.total_credits,
        v_entry.total_debits
    )
    RETURNING id INTO v_reversing_entry_id;

    INSERT INTO journal_entry_lines (
        tenant_id, entry_id, line_number, account_id,
        debit_amount, credit_amount, description
    )
    SELECT
        tenant_id, v_reversing_entry_id, line_number, account_id,
        credit_amount, debit_amount, 'VOID: ' || description
    FROM journal_entry_lines
    WHERE entry_id = p_entry_id;

    REFRESH MATERIALIZED VIEW CONCURRENTLY general_ledger;

    RETURN v_reversing_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh GL view
CREATE OR REPLACE FUNCTION refresh_general_ledger()
RETURNS BOOLEAN AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY general_ledger;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DEPLOYMENT SUCCESSFUL!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CRM tables created: companies, contacts';
    RAISE NOTICE 'Accounting tables created: chart_of_accounts, journal_entries, general_ledger';
    RAISE NOTICE 'RLS policies enabled for multi-tenant isolation';
    RAISE NOTICE 'Refresh your dashboard - accounting pages now work!';
    RAISE NOTICE '========================================';
END $$;
