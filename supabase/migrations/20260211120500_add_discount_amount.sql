-- Add discount_amount to business_invoices
ALTER TABLE business_invoices 
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;

-- Refresh the schema cache is handled automagically by Supabase usually, but good to know.
