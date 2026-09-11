-- Invoice bank detail fields + auto journal entry on paid status

ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS branch_code TEXT,
  ADD COLUMN IF NOT EXISTS swift_code TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_link TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

ALTER TABLE public.business_projects
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- Also support legacy projects table if present
DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL THEN
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.auto_journal_on_invoice_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_ar_account_id UUID;
  v_revenue_account_id UUID;
  v_entry_id UUID;
  v_amount DECIMAL(15,2);
  v_existing INTEGER;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT COUNT(*) INTO v_existing
    FROM journal_entries
    WHERE tenant_id = NEW.tenant_id
      AND source_type = 'invoice'
      AND source_id = NEW.id
      AND status = 'posted';

    IF v_existing > 0 THEN
      IF NEW.paid_at IS NULL THEN
        NEW.paid_at := NOW();
      END IF;
      RETURN NEW;
    END IF;

    v_amount := COALESCE(NEW.total_amount, NEW.total, 0);

    SELECT id INTO v_ar_account_id
    FROM chart_of_accounts
    WHERE tenant_id = NEW.tenant_id AND account_code = '1100'
    LIMIT 1;

    SELECT id INTO v_revenue_account_id
    FROM chart_of_accounts
    WHERE tenant_id = NEW.tenant_id AND account_code IN ('4100', '4000')
    ORDER BY account_code DESC
    LIMIT 1;

    IF v_ar_account_id IS NOT NULL AND v_revenue_account_id IS NOT NULL AND v_amount > 0 THEN
      IF NEW.paid_at IS NULL THEN
        NEW.paid_at := NOW();
      END IF;

      INSERT INTO journal_entries (
        tenant_id, entry_number, entry_date, description,
        source_type, source_id, status, total_debits, total_credits, posted_at
      ) VALUES (
        NEW.tenant_id,
        'INV-' || LEFT(REPLACE(NEW.id::text, '-', ''), 8),
        COALESCE(NEW.paid_at::date, CURRENT_DATE),
        'Invoice payment: ' || COALESCE(NEW.invoice_number, NEW.id::text),
        'invoice',
        NEW.id,
        'posted',
        v_amount,
        v_amount,
        NOW()
      ) RETURNING id INTO v_entry_id;

      INSERT INTO journal_entry_lines (
        tenant_id, entry_id, line_number, account_id, debit_amount, credit_amount, description
      ) VALUES
        (NEW.tenant_id, v_entry_id, 1, v_ar_account_id, v_amount, 0, 'Accounts receivable'),
        (NEW.tenant_id, v_entry_id, 2, v_revenue_account_id, 0, v_amount, 'Revenue');
    ELSIF NEW.paid_at IS NULL THEN
      NEW.paid_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_journal_on_invoice_paid ON public.business_invoices;
CREATE TRIGGER trigger_journal_on_invoice_paid
  BEFORE UPDATE ON public.business_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_on_invoice_paid();

-- Seed default COA when tenant is created (if not already present)
CREATE OR REPLACE FUNCTION public.seed_coa_on_tenant_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_default_chart_of_accounts(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_seed_coa_on_tenant ON public.tenants;
CREATE TRIGGER trigger_seed_coa_on_tenant
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_coa_on_tenant_insert();
