-- Create Leads Table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    -- If user-specific
    business_name TEXT NOT NULL,
    industry TEXT,
    location TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    source TEXT DEFAULT 'Manual',
    -- 'AI Agent', 'Bulk Upload', 'Manual'
    stage TEXT DEFAULT 'lead',
    -- 'lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
    value DECIMAL(12, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create Contracts Table
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id),
    -- Creator/Admin
    client_id UUID REFERENCES auth.users(id),
    -- If known
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    -- 'NDA', 'Service Agreement', etc.
    content TEXT,
    -- HTML or Markdown content
    status TEXT DEFAULT 'draft',
    -- 'draft', 'sent', 'client_signed', 'fully_signed'
    client_signature TEXT,
    -- Data URL or Path
    client_signed_at TIMESTAMPTZ,
    admin_signature TEXT,
    admin_signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
-- Policies for Leads (Assume Authenticated Users can see all for now, or own)
CREATE POLICY "Users can view their own leads" ON public.leads FOR
SELECT USING (
        auth.uid() = owner_id
        OR auth.role() = 'service_role'
    );
CREATE POLICY "Users can insert their own leads" ON public.leads FOR
INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update their own leads" ON public.leads FOR
UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete their own leads" ON public.leads FOR DELETE USING (auth.uid() = owner_id);
-- Policies for Contracts
CREATE POLICY "Users can view relevant contracts" ON public.contracts FOR
SELECT USING (
        auth.uid() = owner_id
        OR auth.uid() = client_id
        OR auth.role() = 'service_role'
    );
CREATE POLICY "Admins can insert contracts" ON public.contracts FOR
INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update relevant contracts" ON public.contracts FOR
UPDATE USING (
        auth.uid() = owner_id
        OR auth.uid() = client_id
    );
-- Client needs update permission to sign