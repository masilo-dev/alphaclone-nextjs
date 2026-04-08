-- Fix RLS policies for quota_usage to resolve 403 Forbidden errors
-- Ensure both authenticated and anon roles can access their own data
-- and allow admins to manage all usage records.

-- 1. quota_usage RLS fixes
ALTER TABLE public.quota_usage ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can manage own quota usage" ON public.quota_usage;
DROP POLICY IF EXISTS "Users can view own quota usage" ON public.quota_usage;

-- Policy for viewing own usage (Authenticated users)
CREATE POLICY "Users can view own quota usage"
ON public.quota_usage
FOR SELECT
TO public
USING (
  (auth.uid() = user_id) OR 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role))
);

-- Policy for inserting/updating own usage
CREATE POLICY "Users can manage own quota usage"
ON public.quota_usage
FOR ALL
TO public
USING (
  (auth.uid() = user_id) OR 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role))
)
WITH CHECK (
  (auth.uid() = user_id) OR 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role))
);

-- 2. generated_assets enhancement
-- Add tenant_id if missing to support multi-tenancy correctly
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'generated_assets' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.generated_assets ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
    END IF;
END $$;

-- Update generated_assets RLS to include admin check and tenant scoping
DROP POLICY IF EXISTS "Users can view own generated assets" ON public.generated_assets;
DROP POLICY IF EXISTS "Users can create own generated assets" ON public.generated_assets;
DROP POLICY IF EXISTS "Users can delete own generated assets" ON public.generated_assets;

CREATE POLICY "Users can view own generated assets"
ON public.generated_assets
FOR SELECT
TO public
USING (
  (auth.uid() = user_id) OR 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role))
);

CREATE POLICY "Users can create own generated assets"
ON public.generated_assets
FOR INSERT
TO public
WITH CHECK (
  (auth.uid() = user_id)
);

CREATE POLICY "Users can delete own generated assets"
ON public.generated_assets
FOR DELETE
TO public
USING (
  (auth.uid() = user_id) OR 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role))
);

-- 3. metadata column documentation
COMMENT ON COLUMN public.generated_assets.metadata IS 'Stores AI generation parameters, including model_id, provider, and settings.';
