/**
 * Accounting Core - Enterprise-Grade Double-Entry Bookkeeping
 * Implements Chart of Accounts, General Ledger, Journal Entries
 * GAAP Compliant | Audit Trail | Multi-Currency Ready
 *
 * Architecture:
 * - Chart of Accounts: Hierarchical account structure (assets, liabilities, equity, revenue, expenses)
 * - Journal Entries: Double-entry transactions (debits = credits)
 * - General Ledger: Account balances and transaction history
 * - Accounting Periods: Period management (open, closed, locked)
 */

-- =====================================================
-- ACCOUNT TYPES & CLASSIFICATIONS
-- Standard accounting account types per GAAP
-- =====================================================

-- Account Types ENUM
CREATE TYPE account_type AS ENUM (
    'asset',           -- Assets (Cash, AR, Inventory, etc.)
    'liability',       -- Liabilities (AP, Loans, Credit Cards)
    'equity',          -- Equity (Owner's Equity, Retained Earnings)
    'revenue',         -- Revenue (Sales, Service Revenue)
    'expense',         -- Expenses (Cost of Goods Sold, Operating Expenses)
    'other_income',    -- Other Income (Interest Income, Gains)
    'other_expense'    -- Other Expenses (Interest Expense, Losses)
);

-- Account Sub-Types for classification
CREATE TYPE account_subtype AS ENUM (
    -- Asset subtypes
    'current_asset', 'fixed_asset', 'other_asset',
    -- Liability subtypes
    'current_liability', 'long_term_liability',
    -- Equity subtypes
    'equity', 'retained_earnings',
    -- Revenue subtypes
    'operating_revenue', 'non_operating_revenue',
    -- Expense subtypes
    'cost_of_goods_sold', 'operating_expense', 'non_operating_expense'
);

-- Journal Entry Status
CREATE TYPE journal_status AS ENUM ('draft', 'posted', 'void');

-- Accounting Period Status
CREATE TYPE period_status AS ENUM ('open', 'closed', 'locked');

-- =====================================================
-- CHART OF ACCOUNTS
-- Hierarchical account structure with parent-child relationships
-- =====================================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Account Identification
    account_code TEXT NOT NULL, -- e.g., "1000", "2000", "4000"
    account_name TEXT NOT NULL, -- e.g., "Cash", "Accounts Receivable"
    account_type account_type NOT NULL,
    account_subtype account_subtype,

    -- Hierarchy (for sub-accounts)
    parent_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,

    -- Account Properties
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_system_account BOOLEAN DEFAULT false, -- Cannot be deleted if true

    -- Balance Tracking
    normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    current_balance DECIMAL(15,2) DEFAULT 0.00,

    -- Multi-Currency Support
    currency TEXT DEFAULT 'USD',

    -- Restrictions
    allow_manual_entries BOOLEAN DEFAULT true, -- If false, only auto-posted entries allowed

    -- Audit Trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ, -- Soft delete

    -- Constraints
    CONSTRAINT unique_account_code_per_tenant UNIQUE (tenant_id, account_code),
    CONSTRAINT valid_account_code CHECK (account_code ~ '^[0-9]+$') -- Numeric codes only
);

-- Indexes
CREATE INDEX idx_coa_tenant ON chart_of_accounts(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_coa_type ON chart_of_accounts(account_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_coa_code ON chart_of_accounts(account_code);

-- =====================================================
-- ACCOUNTING PERIODS
-- Period management for financial reporting and closing
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Period Identification
    period_name TEXT NOT NULL, -- e.g., "January 2026", "Q1 2026"
    fiscal_year INTEGER NOT NULL,
    period_number INTEGER NOT NULL, -- 1-12 for monthly, 1-4 for quarterly

    -- Period Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Status Management
    status period_status DEFAULT 'open',
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id),
    locked_at TIMESTAMPTZ,
    locked_by UUID REFERENCES users(id),

    -- Audit Trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    -- Constraints
    CONSTRAINT valid_period_dates CHECK (end_date > start_date),
    CONSTRAINT unique_period_per_tenant UNIQUE (tenant_id, fiscal_year, period_number)
);

-- Indexes
CREATE INDEX idx_periods_tenant ON accounting_periods(tenant_id);
CREATE INDEX idx_periods_status ON accounting_periods(status);
CREATE INDEX idx_periods_dates ON accounting_periods(start_date, end_date);

-- =====================================================
-- JOURNAL ENTRIES
-- Header table for double-entry transactions
-- =====================================================
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Entry Identification
    entry_number TEXT NOT NULL, -- Auto-generated: JE-2026-0001
    entry_date DATE NOT NULL,
    period_id UUID REFERENCES accounting_periods(id),

    -- Entry Details
    description TEXT NOT NULL,
    reference TEXT, -- External reference (invoice number, payment ID, etc.)

    -- Source Tracking
    source_type TEXT, -- 'invoice', 'payment', 'manual', 'adjustment', 'closing'
    source_id UUID, -- ID of source document (invoice_id, payment_id, etc.)

    -- Entry Status
    status journal_status DEFAULT 'draft',
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES users(id),
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES users(id),
    void_reason TEXT,

    -- Totals (for validation)
    total_debits DECIMAL(15,2) DEFAULT 0.00,
    total_credits DECIMAL(15,2) DEFAULT 0.00,

    -- Multi-Currency
    currency TEXT DEFAULT 'USD',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,

    -- Audit Trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),

    -- Constraints
    CONSTRAINT unique_entry_number UNIQUE (tenant_id, entry_number),
    CONSTRAINT balanced_entry CHECK (
        status = 'draft' OR
        (status = 'posted' AND total_debits = total_credits) OR
        status = 'void'
    )
);

-- Indexes
CREATE INDEX idx_je_tenant ON journal_entries(tenant_id);
CREATE INDEX idx_je_status ON journal_entries(status);
CREATE INDEX idx_je_date ON journal_entries(entry_date);
CREATE INDEX idx_je_period ON journal_entries(period_id);
CREATE INDEX idx_je_source ON journal_entries(source_type, source_id);

-- =====================================================
-- JOURNAL ENTRY LINES
-- Detail lines for double-entry bookkeeping
-- =====================================================
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Line Identification
    entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,

    -- Account Reference
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),

    -- Amounts (either debit OR credit, never both)
    debit_amount DECIMAL(15,2) DEFAULT 0.00,
    credit_amount DECIMAL(15,2) DEFAULT 0.00,

    -- Line Details
    description TEXT,

    -- Additional Tracking
    entity_type TEXT, -- 'customer', 'vendor', 'employee', 'project'
    entity_id UUID, -- Reference to customer, vendor, etc.

    -- Multi-Currency
    currency TEXT DEFAULT 'USD',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,

    -- Audit Trail
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_line_amounts CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (credit_amount > 0 AND debit_amount = 0)
    ),
    CONSTRAINT unique_line_number UNIQUE (entry_id, line_number)
);

-- Indexes
CREATE INDEX idx_jel_tenant ON journal_entry_lines(tenant_id);
CREATE INDEX idx_jel_entry ON journal_entry_lines(entry_id);
CREATE INDEX idx_jel_account ON journal_entry_lines(account_id);
CREATE INDEX idx_jel_entity ON journal_entry_lines(entity_type, entity_id);

-- =====================================================
-- GENERAL LEDGER VIEW
-- Materialized view for fast GL reporting
-- =====================================================
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
    je.created_at,
    je.posted_at
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.entry_id = je.id
JOIN chart_of_accounts coa ON jel.account_id = coa.id
WHERE je.status = 'posted'
ORDER BY je.entry_date, je.entry_number, jel.line_number;

-- Index for GL view
CREATE INDEX idx_gl_tenant_account ON general_ledger(tenant_id, account_id);
CREATE INDEX idx_gl_date ON general_ledger(entry_date);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================
CREATE TRIGGER update_coa_updated_at
    BEFORE UPDATE ON chart_of_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_je_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_coa_policy ON chart_of_accounts
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY tenant_periods_policy ON accounting_periods
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY tenant_je_policy ON journal_entries
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY tenant_jel_policy ON journal_entry_lines
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- =====================================================
-- BUSINESS LOGIC FUNCTIONS
-- =====================================================

/**
 * Generate next journal entry number
 * Format: JE-YYYY-NNNN
 */
CREATE OR REPLACE FUNCTION generate_entry_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_year TEXT;
    v_sequence INTEGER;
    v_entry_number TEXT;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

    -- Get next sequence number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM 9) AS INTEGER)), 0) + 1
    INTO v_sequence
    FROM journal_entries
    WHERE tenant_id = p_tenant_id
    AND entry_number LIKE 'JE-' || v_year || '-%';

    v_entry_number := 'JE-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
    RETURN v_entry_number;
END;
$$ LANGUAGE plpgsql;

/**
 * Post journal entry
 * - Validates balanced entry (debits = credits)
 * - Updates account balances
 * - Changes status to posted
 * - Records post timestamp and user
 */
CREATE OR REPLACE FUNCTION post_journal_entry(
    p_entry_id UUID,
    p_posted_by UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_entry RECORD;
    v_line RECORD;
    v_total_debits DECIMAL(15,2);
    v_total_credits DECIMAL(15,2);
BEGIN
    -- Get entry details
    SELECT * INTO v_entry FROM journal_entries WHERE id = p_entry_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Journal entry not found';
    END IF;

    IF v_entry.status = 'posted' THEN
        RAISE EXCEPTION 'Journal entry already posted';
    END IF;

    IF v_entry.status = 'void' THEN
        RAISE EXCEPTION 'Cannot post voided entry';
    END IF;

    -- Calculate totals
    SELECT
        COALESCE(SUM(debit_amount), 0),
        COALESCE(SUM(credit_amount), 0)
    INTO v_total_debits, v_total_credits
    FROM journal_entry_lines
    WHERE entry_id = p_entry_id;

    -- Validate balanced entry
    IF v_total_debits != v_total_credits THEN
        RAISE EXCEPTION 'Entry not balanced: debits=%, credits=%', v_total_debits, v_total_credits;
    END IF;

    -- Update account balances
    FOR v_line IN
        SELECT * FROM journal_entry_lines WHERE entry_id = p_entry_id
    LOOP
        UPDATE chart_of_accounts
        SET current_balance = current_balance +
            CASE
                WHEN normal_balance = 'debit' THEN v_line.debit_amount - v_line.credit_amount
                ELSE v_line.credit_amount - v_line.debit_amount
            END
        WHERE id = v_line.account_id;
    END LOOP;

    -- Mark as posted
    UPDATE journal_entries
    SET
        status = 'posted',
        total_debits = v_total_debits,
        total_credits = v_total_credits,
        posted_at = NOW(),
        posted_by = p_posted_by
    WHERE id = p_entry_id;

    -- Refresh GL view
    REFRESH MATERIALIZED VIEW CONCURRENTLY general_ledger;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Void journal entry
 * - Creates reversing entry
 * - Marks original as void
 */
CREATE OR REPLACE FUNCTION void_journal_entry(
    p_entry_id UUID,
    p_voided_by UUID,
    p_reason TEXT
) RETURNS UUID AS $$
DECLARE
    v_entry RECORD;
    v_reversing_entry_id UUID;
    v_line RECORD;
BEGIN
    -- Get original entry
    SELECT * INTO v_entry FROM journal_entries WHERE id = p_entry_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Journal entry not found';
    END IF;

    IF v_entry.status != 'posted' THEN
        RAISE EXCEPTION 'Can only void posted entries';
    END IF;

    -- Create reversing entry
    INSERT INTO journal_entries (
        tenant_id, entry_number, entry_date, period_id,
        description, reference, source_type, source_id,
        status, currency, exchange_rate
    ) VALUES (
        v_entry.tenant_id,
        generate_entry_number(v_entry.tenant_id),
        CURRENT_DATE,
        v_entry.period_id,
        'VOID: ' || v_entry.description,
        v_entry.reference,
        'void',
        v_entry.id,
        'draft',
        v_entry.currency,
        v_entry.exchange_rate
    ) RETURNING id INTO v_reversing_entry_id;

    -- Create reversing lines (swap debits and credits)
    FOR v_line IN
        SELECT * FROM journal_entry_lines WHERE entry_id = p_entry_id
    LOOP
        INSERT INTO journal_entry_lines (
            tenant_id, entry_id, line_number, account_id,
            debit_amount, credit_amount, description,
            entity_type, entity_id, currency, exchange_rate
        ) VALUES (
            v_line.tenant_id,
            v_reversing_entry_id,
            v_line.line_number,
            v_line.account_id,
            v_line.credit_amount, -- Swap
            v_line.debit_amount,  -- Swap
            'VOID: ' || COALESCE(v_line.description, ''),
            v_line.entity_type,
            v_line.entity_id,
            v_line.currency,
            v_line.exchange_rate
        );
    END LOOP;

    -- Post reversing entry
    PERFORM post_journal_entry(v_reversing_entry_id, p_voided_by);

    -- Mark original as void
    UPDATE journal_entries
    SET
        status = 'void',
        voided_at = NOW(),
        voided_by = p_voided_by,
        void_reason = p_reason
    WHERE id = p_entry_id;

    RETURN v_reversing_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Get account balance at a specific date
 */
CREATE OR REPLACE FUNCTION get_account_balance(
    p_account_id UUID,
    p_as_of_date DATE DEFAULT CURRENT_DATE
) RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_balance DECIMAL(15,2);
    v_normal_balance TEXT;
BEGIN
    SELECT normal_balance INTO v_normal_balance
    FROM chart_of_accounts
    WHERE id = p_account_id;

    SELECT
        CASE
            WHEN v_normal_balance = 'debit' THEN
                COALESCE(SUM(debit_amount - credit_amount), 0)
            ELSE
                COALESCE(SUM(credit_amount - debit_amount), 0)
        END
    INTO v_balance
    FROM general_ledger
    WHERE account_id = p_account_id
    AND entry_date <= p_as_of_date;

    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- DEFAULT CHART OF ACCOUNTS
-- Standard accounts for small business
-- =====================================================
CREATE OR REPLACE FUNCTION create_default_chart_of_accounts(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    -- ASSETS (1000-1999)
    INSERT INTO chart_of_accounts (tenant_id, account_code, account_name, account_type, account_subtype, normal_balance, is_system_account) VALUES
    (p_tenant_id, '1000', 'Cash', 'asset', 'current_asset', 'debit', true),
    (p_tenant_id, '1100', 'Accounts Receivable', 'asset', 'current_asset', 'debit', true),
    (p_tenant_id, '1200', 'Inventory', 'asset', 'current_asset', 'debit', true),
    (p_tenant_id, '1500', 'Equipment', 'asset', 'fixed_asset', 'debit', true),
    (p_tenant_id, '1510', 'Accumulated Depreciation - Equipment', 'asset', 'fixed_asset', 'credit', true),

    -- LIABILITIES (2000-2999)
    (p_tenant_id, '2000', 'Accounts Payable', 'liability', 'current_liability', 'credit', true),
    (p_tenant_id, '2100', 'Credit Card Payable', 'liability', 'current_liability', 'credit', true),
    (p_tenant_id, '2200', 'Sales Tax Payable', 'liability', 'current_liability', 'credit', true),
    (p_tenant_id, '2500', 'Long-term Debt', 'liability', 'long_term_liability', 'credit', true),

    -- EQUITY (3000-3999)
    (p_tenant_id, '3000', 'Owner''s Equity', 'equity', 'equity', 'credit', true),
    (p_tenant_id, '3100', 'Retained Earnings', 'equity', 'retained_earnings', 'credit', true),

    -- REVENUE (4000-4999)
    (p_tenant_id, '4000', 'Sales Revenue', 'revenue', 'operating_revenue', 'credit', true),
    (p_tenant_id, '4100', 'Service Revenue', 'revenue', 'operating_revenue', 'credit', true),

    -- COST OF GOODS SOLD (5000-5999)
    (p_tenant_id, '5000', 'Cost of Goods Sold', 'expense', 'cost_of_goods_sold', 'debit', true),

    -- OPERATING EXPENSES (6000-6999)
    (p_tenant_id, '6000', 'Advertising Expense', 'expense', 'operating_expense', 'debit', true),
    (p_tenant_id, '6100', 'Office Supplies', 'expense', 'operating_expense', 'debit', true),
    (p_tenant_id, '6200', 'Rent Expense', 'expense', 'operating_expense', 'debit', true),
    (p_tenant_id, '6300', 'Utilities Expense', 'expense', 'operating_expense', 'debit', true),
    (p_tenant_id, '6400', 'Insurance Expense', 'expense', 'operating_expense', 'debit', true),
    (p_tenant_id, '6500', 'Professional Fees', 'expense', 'operating_expense', 'debit', true),
    (p_tenant_id, '6600', 'Salaries Expense', 'expense', 'operating_expense', 'debit', true),

    -- OTHER INCOME/EXPENSE (7000-8999)
    (p_tenant_id, '7000', 'Interest Income', 'other_income', 'non_operating_revenue', 'credit', true),
    (p_tenant_id, '8000', 'Interest Expense', 'other_expense', 'non_operating_expense', 'debit', true);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE chart_of_accounts IS 'Hierarchical chart of accounts for double-entry bookkeeping';
COMMENT ON TABLE journal_entries IS 'Journal entry headers with validation for balanced entries';
COMMENT ON TABLE journal_entry_lines IS 'Double-entry journal lines (debit/credit)';
COMMENT ON TABLE accounting_periods IS 'Fiscal periods for financial reporting and closing';
COMMENT ON MATERIALIZED VIEW general_ledger IS 'Fast access to posted transactions by account';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT ALL ON chart_of_accounts TO authenticated;
GRANT ALL ON accounting_periods TO authenticated;
GRANT ALL ON journal_entries TO authenticated;
GRANT ALL ON journal_entry_lines TO authenticated;
GRANT SELECT ON general_ledger TO authenticated;
