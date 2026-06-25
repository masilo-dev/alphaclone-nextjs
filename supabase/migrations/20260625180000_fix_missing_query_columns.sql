-- Fix 400 errors caused by missing columns referenced in frontend queries

-- 1. quotes: add title (alias for name) and client_id (alias for contact_id)
--    These are used by CRM record views that expect generic field names
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS title TEXT GENERATED ALWAYS AS (name) STORED,
  ADD COLUMN IF NOT EXISTS client_id UUID GENERATED ALWAYS AS (contact_id) STORED,
  ADD COLUMN IF NOT EXISTS client_email TEXT;

CREATE INDEX IF NOT EXISTS idx_quotes_client_email ON public.quotes (client_email) WHERE client_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_title ON public.quotes (title);

-- 2. calendar_events: add client_id (company link for CRM timeline views)
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_client_id ON public.calendar_events (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_client ON public.calendar_events (tenant_id, client_id) WHERE client_id IS NOT NULL;

-- 3. companies: add last_activity_at for CRM sorting
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Backfill from updated_at
UPDATE public.companies
SET last_activity_at = updated_at
WHERE last_activity_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_last_activity ON public.companies (tenant_id, last_activity_at DESC NULLS LAST);

-- Keep last_activity_at in sync with updated_at via trigger
CREATE OR REPLACE FUNCTION public.sync_company_last_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.last_activity_at := GREATEST(COALESCE(NEW.last_activity_at, NEW.updated_at), NEW.updated_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_last_activity ON public.companies;
CREATE TRIGGER trg_company_last_activity
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.sync_company_last_activity();

-- 4. expenses: add asset_account_id (FK to chart_of_accounts for accounting join)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS asset_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_asset_account_id ON public.expenses (asset_account_id) WHERE asset_account_id IS NOT NULL;
