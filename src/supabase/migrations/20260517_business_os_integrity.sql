-- ALPHACLONE SYSTEMS - BUSINESS OS INTEGRITY MIGRATION
-- Version: 1.0 (2026-05-17)
-- Fixes: $0 Invoice Bug, Lead Schema Mismatch, Relational Line Items

-- ============================================================================
-- PART 1: STANDARDIZE LEADS TABLE
-- ============================================================================

DO $$ 
BEGIN 
    -- Rename company_name to business_name if it exists (from legacy demo data)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'company_name') THEN
        ALTER TABLE public.leads RENAME COLUMN company_name TO business_name;
    END IF;

    -- Ensure business_name is NOT NULL
    ALTER TABLE public.leads ALTER COLUMN business_name SET NOT NULL;

    -- Add is_test_data column to track demo/junk data
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'is_test_data') THEN
        ALTER TABLE public.leads ADD COLUMN is_test_data BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- ============================================================================
-- PART 2: RELATIONAL INVOICE LINE ITEMS
-- ============================================================================

-- Create invoice_line_items table
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.business_invoices(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(12, 2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    amount DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see/edit items for their tenant
CREATE POLICY "tenant_isolation_policy" ON public.invoice_line_items FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
);

-- ============================================================================
-- PART 3: DATA MIGRATION (JSONB -> RELATIONAL)
-- ============================================================================

DO $$
DECLARE
    inv_record RECORD;
    item RECORD;
BEGIN
    -- Iterate through invoices that have line items in JSONB
    FOR inv_record IN SELECT id, tenant_id, line_items FROM public.business_invoices WHERE line_items IS NOT NULL AND jsonb_array_length(line_items) > 0 LOOP
        FOR item IN SELECT * FROM jsonb_to_recordset(inv_record.line_items) AS x(description TEXT, quantity DECIMAL, rate DECIMAL) LOOP
            -- Avoid duplicates if migration is re-run
            IF NOT EXISTS (SELECT 1 FROM public.invoice_line_items WHERE invoice_id = inv_record.id AND description = item.description) THEN
                INSERT INTO public.invoice_line_items (invoice_id, tenant_id, description, quantity, unit_price)
                VALUES (inv_record.id, inv_record.tenant_id, item.description, COALESCE(item.quantity, 1), COALESCE(item.rate, 0));
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- PART 4: TRIGGERS FOR TOTAL CALCULATION
-- ============================================================================

-- Function to recalculate invoice totals
CREATE OR REPLACE FUNCTION public.recalculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.business_invoices
    SET 
        subtotal = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM public.invoice_line_items 
            WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
        ),
        total = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM public.invoice_line_items 
            WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
        ) * (1 + (tax_rate / 100)) - discount_amount,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for invoice_line_items
DROP TRIGGER IF EXISTS trigger_update_invoice_totals ON public.invoice_line_items;
CREATE TRIGGER trigger_update_invoice_totals
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
FOR EACH ROW EXECUTE FUNCTION public.recalculate_invoice_totals();

-- ============================================================================
-- PART 5: FIX CONVERT_LEAD_TO_CONTACT RPC
-- ============================================================================

-- DROP existing versions of the function to allow changing return type from UUID to JSONB
DROP FUNCTION IF EXISTS public.convert_lead_to_contact(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.convert_lead_to_contact(uuid, boolean, text, text);

CREATE OR REPLACE FUNCTION public.convert_lead_to_contact(
    p_lead_id uuid, 
    p_create_company boolean DEFAULT false, 
    p_company_name text DEFAULT NULL::text,
    p_contact_name_override text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_new_contact_id UUID;
    v_new_company_id UUID;
    v_new_client_id UUID;
    v_lead_record public.leads%ROWTYPE;
    v_first_name TEXT;
    v_last_name TEXT;
BEGIN
    -- Get lead data
    SELECT * INTO v_lead_record FROM public.leads WHERE id = p_lead_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found';
    END IF;

    -- Check if already converted
    IF v_lead_record.stage = 'converted' OR v_lead_record.client_id IS NOT NULL THEN
        RAISE EXCEPTION 'Lead already converted';
    END IF;

    -- Create Company if requested
    IF p_create_company AND p_company_name IS NOT NULL THEN
        INSERT INTO public.companies (
            tenant_id, name, industry, location, phone, email, owner_id
        ) VALUES (
            v_lead_record.tenant_id, p_company_name, v_lead_record.industry, 
            v_lead_record.location, v_lead_record.phone, v_lead_record.email, auth.uid()
        ) RETURNING id INTO v_new_company_id;
    END IF;

    -- Handle names
    IF p_contact_name_override IS NOT NULL THEN
        v_first_name := split_part(p_contact_name_override, ' ', 1);
        v_last_name := substr(p_contact_name_override, length(v_first_name) + 2);
    ELSE
        -- Fallback to business name if no contact name exists
        v_first_name := split_part(v_lead_record.business_name, ' ', 1);
        v_last_name := substr(v_lead_record.business_name, length(v_first_name) + 2);
    END IF;

    -- Create Contact
    INSERT INTO public.contacts (
        tenant_id, first_name, last_name, email, phone, company_id, lead_source, owner_id, original_lead_id
    ) VALUES (
        v_lead_record.tenant_id, v_first_name, v_last_name, v_lead_record.email, 
        v_lead_record.phone, v_new_company_id, v_lead_record.source, auth.uid(), p_lead_id
    ) RETURNING id INTO v_new_contact_id;

    -- Create Business Client (Legacy/Dashboard support)
    INSERT INTO public.business_clients (
        tenant_id, owner_id, name, email, phone, industry, location, lead_source, sales_stage, is_active
    ) VALUES (
        v_lead_record.tenant_id, auth.uid(), COALESCE(p_company_name, v_lead_record.business_name),
        v_lead_record.email, v_lead_record.phone, v_lead_record.industry, v_lead_record.location,
        'Converted Lead', 'customer', true
    ) RETURNING id INTO v_new_client_id;

    -- Update Lead status
    UPDATE public.leads
    SET stage = 'converted', client_id = v_new_client_id, updated_at = NOW()
    WHERE id = p_lead_id;

    -- Log activity
    INSERT INTO public.lead_activities (
        lead_id, type, description, user_id
    ) VALUES (
        p_lead_id, 'conversion', 'Lead converted to Contact and Business Client', auth.uid()
    );

    RETURN jsonb_build_object(
        'contact_id', v_new_contact_id,
        'company_id', v_new_company_id,
        'client_id', v_new_client_id
    );
END;
$function$;

-- ============================================================================
-- PART 6: SCHEMA HARDENING (IS_TEST_DATA)
-- ============================================================================

DO $$
BEGIN
    ALTER TABLE public.business_invoices ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;
    
    -- Mark existing $0 invoices as test data/cleanup
    UPDATE public.business_invoices SET is_test_data = TRUE WHERE total = 0 OR total IS NULL;
END $$;

-- ============================================================================
-- PART 7: INVOICE SENT_AT SAFETY RE-APPLY (Fix for send_invoice NOT_FOUND bug)
-- The 20260513 migration added these columns but may not have been applied.
-- This is idempotent — safe to run multiple times.
-- ============================================================================

DO $$
BEGIN
    -- Critical: sent_at is written by send_invoice MCP tool on every send
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_invoices' AND column_name = 'sent_at') THEN
        ALTER TABLE public.business_invoices ADD COLUMN sent_at TIMESTAMPTZ;
    END IF;

    -- paid_at is written by reconcile_payment and payment webhooks
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_invoices' AND column_name = 'paid_at') THEN
        ALTER TABLE public.business_invoices ADD COLUMN paid_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================================
-- PART 8: LEAD ENRICHMENT COLUMNS (Issue 5 — contact data gaps)
-- Adds linkedin_url and decision_maker_name to enable richer lead records
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'linkedin_url') THEN
        ALTER TABLE public.leads ADD COLUMN linkedin_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'decision_maker_name') THEN
        ALTER TABLE public.leads ADD COLUMN decision_maker_name TEXT;
    END IF;
END $$;

-- Reload PostgREST schema cache so all new columns are immediately queryable
NOTIFY pgrst, 'reload schema';
