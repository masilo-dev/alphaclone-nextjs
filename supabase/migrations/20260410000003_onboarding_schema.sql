-- Migration: Wave 4 Growth
-- Adds business_goals column to capture onboarding questionnaire data.

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS business_goals jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tenants.business_goals IS 'Captured business context from onboarding (e.g., goals, company size, niche).';

-- Create an index for faster querying of metadata if needed
CREATE INDEX IF NOT EXISTS idx_tenants_business_goals ON public.tenants USING gin (business_goals);
