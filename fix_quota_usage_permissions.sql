-- SQL Script to fix quota_usage table and permissions
-- Run this in your Supabase SQL Editor

-- 1. Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.quota_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    leads INTEGER DEFAULT 0,
    contracts INTEGER DEFAULT 0,
    invoices INTEGER DEFAULT 0,
    receipts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, date)
);

-- 2. Enable Row Level Security
ALTER TABLE public.quota_usage ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies

-- Allow users to view their own quota usage
CREATE POLICY "Users can view own quota usage"
    ON public.quota_usage FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to insert their own quota usage
CREATE POLICY "Users can insert own quota usage"
    ON public.quota_usage FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own quota usage
CREATE POLICY "Users can update own quota usage"
    ON public.quota_usage FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Grant access to authenticated users
GRANT ALL ON public.quota_usage TO authenticated;
GRANT ALL ON public.quota_usage TO service_role;

-- 5. Add trigger for updated_at if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_quota_usage') THEN
        CREATE TRIGGER set_updated_at_quota_usage
        BEFORE UPDATE ON public.quota_usage
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
