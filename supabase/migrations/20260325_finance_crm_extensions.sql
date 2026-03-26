-- ============================================================
-- Finance & CRM Extensions
-- Inspired by: Crater (github.com/crater-invoice/crater, 7.5k⭐)
--              Akaunting (github.com/akaunting/akaunting, 7k⭐)
--              Invoice Ninja (github.com/invoiceninja/invoiceninja, 8k⭐)
-- Date: 2026-03-25
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- CRM CORE: companies + contacts (fixes lead conversion gap)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    domain          TEXT,
    industry        TEXT,
    company_size    TEXT,
    website         TEXT,
    phone           TEXT,
    email           TEXT,
    address         JSONB DEFAULT '{}',
    stage           TEXT DEFAULT 'lead'
                    CHECK (stage IN ('lead','prospect','customer','churned','partner')),
    annual_revenue  DECIMAL(15,2),
    owner_id        UUID REFERENCES auth.users(id),
    tags            TEXT[] DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    zoho_crm_id     TEXT,          -- Zoho CRM sync key
    zoho_books_id   TEXT,          -- Zoho Books contact key
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
    first_name      TEXT NOT NULL,
    last_name       TEXT,
    email           TEXT,
    phone           TEXT,
    mobile          TEXT,
    job_title       TEXT,
    department      TEXT,
    is_primary      BOOLEAN DEFAULT false,
    lifecycle_stage TEXT DEFAULT 'lead'
                    CHECK (lifecycle_stage IN ('lead','prospect','customer','evangelist','other')),
    lead_score      INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
    owner_id        UUID REFERENCES auth.users(id),
    tags            TEXT[] DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    zoho_crm_id     TEXT,
    zoho_books_id   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for companies + contacts
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_companies" ON companies FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
);
CREATE POLICY "tenant_contacts" ON contacts FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant  ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_zoho   ON companies(zoho_crm_id) WHERE zoho_crm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_zoho    ON contacts(zoho_crm_id)  WHERE zoho_crm_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- FINANCE: expense_categories  (Crater pattern)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expense_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    account_code    TEXT,           -- Link to chart_of_accounts code
    color           TEXT DEFAULT '#6366f1',
    icon            TEXT DEFAULT 'receipt',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_expense_categories" ON expense_categories FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
);

-- Default categories (seeded on first tenant setup via trigger or app code)


-- ────────────────────────────────────────────────────────────
-- FINANCE: expenses  (Crater + Akaunting pattern)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id      UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
    contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL, -- vendor contact
    company_id       UUID REFERENCES companies(id) ON DELETE SET NULL,
    expense_number   TEXT,
    date             DATE NOT NULL DEFAULT CURRENT_DATE,
    amount           DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
    tax_amount       DECIMAL(15,2) DEFAULT 0,
    total            DECIMAL(15,2) GENERATED ALWAYS AS (amount + tax_amount) STORED,
    currency         CHAR(3) DEFAULT 'USD',
    description      TEXT,
    vendor_name      TEXT,
    payment_method   TEXT DEFAULT 'card'
                     CHECK (payment_method IN ('cash','card','bank_transfer','check','other')),
    status           TEXT DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','reimbursed')),
    billable         BOOLEAN DEFAULT false,
    client_id        UUID,          -- If billable, link to client
    receipt_url      TEXT,          -- Storage URL
    notes            TEXT,
    journal_entry_id UUID,          -- GL reference after posting
    zoho_books_id    TEXT,          -- Zoho Books sync key
    created_by       UUID REFERENCES auth.users(id),
    approved_by      UUID REFERENCES auth.users(id),
    approved_at      TIMESTAMPTZ,
    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_expenses" ON expenses FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant   ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status   ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_zoho     ON expenses(zoho_books_id) WHERE zoho_books_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- FINANCE: vendor_bills  (Accounts Payable — Akaunting pattern)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_bills (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
    company_id       UUID REFERENCES companies(id) ON DELETE SET NULL,
    bill_number      TEXT NOT NULL,
    reference        TEXT,          -- Vendor's invoice number
    issue_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date         DATE,
    status           TEXT DEFAULT 'draft'
                     CHECK (status IN ('draft','open','partial','paid','void','overdue')),
    subtotal         DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_amount       DECIMAL(15,2) DEFAULT 0,
    discount_amount  DECIMAL(15,2) DEFAULT 0,
    total            DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_paid      DECIMAL(15,2) DEFAULT 0,
    balance_due      DECIMAL(15,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
    currency         CHAR(3) DEFAULT 'USD',
    line_items       JSONB DEFAULT '[]',
    notes            TEXT,
    terms            TEXT,
    journal_entry_id UUID,
    zoho_books_id    TEXT,
    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vendor_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_vendor_bills" ON vendor_bills FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_vendor_bills_tenant  ON vendor_bills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_bills_status  ON vendor_bills(status);
CREATE INDEX IF NOT EXISTS idx_vendor_bills_due     ON vendor_bills(due_date);
CREATE INDEX IF NOT EXISTS idx_vendor_bills_zoho    ON vendor_bills(zoho_books_id) WHERE zoho_books_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- FINANCE: bank_accounts  (Akaunting pattern)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_accounts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    account_number_last4 TEXT,
    bank_name            TEXT,
    account_type         TEXT DEFAULT 'checking'
                         CHECK (account_type IN ('checking','savings','credit_card','loan','investment','other')),
    currency             CHAR(3) DEFAULT 'USD',
    opening_balance      DECIMAL(15,2) DEFAULT 0,
    current_balance      DECIMAL(15,2) DEFAULT 0,
    coa_account_id       UUID,          -- Link to chart_of_accounts
    is_active            BOOLEAN DEFAULT true,
    last_synced_at       TIMESTAMPTZ,
    zoho_books_id        TEXT,          -- Zoho Books bank account ID
    metadata             JSONB DEFAULT '{}',
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_bank_accounts" ON bank_accounts FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant ON bank_accounts(tenant_id);


-- ────────────────────────────────────────────────────────────
-- FINANCE: bank_transactions  (reconciliation — Akaunting pattern)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_transactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bank_account_id  UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    date             DATE NOT NULL,
    description      TEXT,
    amount           DECIMAL(15,2) NOT NULL,  -- negative = debit
    type             TEXT CHECK (type IN ('credit','debit')),
    category         TEXT,
    reconciled       BOOLEAN DEFAULT false,
    reconciled_at    TIMESTAMPTZ,
    journal_entry_id UUID,
    expense_id       UUID REFERENCES expenses(id) ON DELETE SET NULL,
    invoice_id       UUID,                    -- business_invoices.id
    external_id      TEXT UNIQUE,             -- Bank/Zoho sync dedup key
    zoho_books_id    TEXT,
    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_bank_transactions" ON bank_transactions FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_bank_tx_tenant   ON bank_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_account  ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_date     ON bank_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_tx_external ON bank_transactions(external_id) WHERE external_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- AUTO-UPDATE TIMESTAMPS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
    CREATE TRIGGER trg_companies_updated   BEFORE UPDATE ON companies        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    CREATE TRIGGER trg_contacts_updated    BEFORE UPDATE ON contacts         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    CREATE TRIGGER trg_expenses_updated    BEFORE UPDATE ON expenses         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    CREATE TRIGGER trg_vendor_bills_updated BEFORE UPDATE ON vendor_bills    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON bank_accounts  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────
-- HELPER: generate expense number  JE-2026-0001 style
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_expense_number(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_count INTEGER;
    v_year  TEXT := TO_CHAR(NOW(), 'YYYY');
BEGIN
    SELECT COUNT(*) + 1 INTO v_count
    FROM expenses
    WHERE tenant_id = p_tenant_id
      AND TO_CHAR(created_at, 'YYYY') = v_year;
    RETURN 'EXP-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_bill_number(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_count INTEGER;
    v_year  TEXT := TO_CHAR(NOW(), 'YYYY');
BEGIN
    SELECT COUNT(*) + 1 INTO v_count
    FROM vendor_bills
    WHERE tenant_id = p_tenant_id
      AND TO_CHAR(created_at, 'YYYY') = v_year;
    RETURN 'BILL-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;
