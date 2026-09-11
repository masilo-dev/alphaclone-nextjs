-- Fix missing columns in Projects, Deals, and Companies
-- Created: 2026-03-03

-- 1. Update Projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS location TEXT;

-- 2. Update Deals table
-- Migration original defined 'source' but the error says 'lead_source' is missing.
-- Let's add lead_source and also ensure company_id/contact_id are there as expected by the logic.
ALTER TABLE deals ADD COLUMN IF NOT EXISTS lead_source TEXT;

-- 3. Update Companies table
-- businessClientService expects 'location' but companies table (CRM source of truth) used address fields.
-- We'll add a 'location' helper column or ensure the mapping works.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS location TEXT;

-- 4. Update Business Clients (if separate)
-- Checking if business_clients is a view or table. Based on previous research, it's a table.
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'business_clients') THEN
        ALTER TABLE business_clients ADD COLUMN IF NOT EXISTS location TEXT;
    END IF;
END $$;

-- 5. Add Indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_projects_location ON projects(location);
CREATE INDEX IF NOT EXISTS idx_deals_lead_source ON deals(lead_source);
CREATE INDEX IF NOT EXISTS idx_companies_location ON companies(location);
