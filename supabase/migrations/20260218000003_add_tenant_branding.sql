-- Add branding fields to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS legal_name TEXT,
ADD COLUMN IF NOT EXISTS tax_id TEXT,
ADD COLUMN IF NOT EXISTS business_address TEXT,
ADD COLUMN IF NOT EXISTS brand_color_primary TEXT DEFAULT '#0f172a', -- Default slate-900
ADD COLUMN IF NOT EXISTS brand_color_secondary TEXT DEFAULT '#14b8a6', -- Default teal-500
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Ensure RLS allows updating these for tenant admins (existing policies likely cover UPDATE, but good to verify if granular columns are needed)
-- Assuming existing policy "Tenant admins can update their own tenant" exists and covers all columns or specific definition. 
-- Usually policies are defined on the table level for operations.

-- Create invoices table if not exists (using business_invoices as seen in previous migrations, but confirming standard name)
-- If business_invoices is the main one, we stick with it. 
-- Let's just focus on tenants first.
