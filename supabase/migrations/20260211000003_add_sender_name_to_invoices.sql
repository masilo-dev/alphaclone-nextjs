-- Add sender_name to business_invoices to allow manual override of organization name
ALTER TABLE business_invoices 
ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- Update existing invoices to have the tenant name (optional, but good for consistency if we can join, otherwise leave null and fallback in code)
-- For now, we'll handle the fallback in the application code (if sender_name is null, use tenant.name)
