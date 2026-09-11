-- Add missing columns to business_invoices table
-- Detected missing: project_id, tax_rate

ALTER TABLE business_invoices 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0;
