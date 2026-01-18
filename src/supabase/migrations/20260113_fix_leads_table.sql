-- 1. Create Leads Table (if missing)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    industry TEXT,
    location TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    source TEXT DEFAULT 'Manual',
    stage TEXT DEFAULT 'lead',
    value DECIMAL(12, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- 2. Add tenant_id for multi-tenancy (safe alter)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'leads'
        AND column_name = 'tenant_id'
) THEN
ALTER TABLE public.leads
ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX idx_leads_tenant ON public.leads(tenant_id);
END IF;
END $$;
-- 3. Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
-- 4. Clean up old policies (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can insert their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.leads;
DROP POLICY IF EXISTS admin_all_access ON public.leads;
-- 5. Apply Robust Policies
-- Policy A: Super Admins see EVERYTHING
CREATE POLICY "admin_all_access" ON public.leads FOR ALL USING (
    auth.uid() IN (
        SELECT id
        FROM public.users
        WHERE role = 'admin'
    )
);
-- Policy B: Tenant Access (Standard Multi-Tenancy)
CREATE POLICY "tenant_isolation_policy" ON public.leads FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id
        FROM public.tenant_users
        WHERE user_id = auth.uid()
    )
);
-- Policy C: Owner Fallback (If tenant_id is null, owner can still see their own leads)
CREATE POLICY "owner_access" ON public.leads FOR ALL USING (auth.uid() = owner_id);