-- Add payment details columns to business_invoices table to snapshot settings at creation time
ALTER TABLE business_invoices
ADD COLUMN IF NOT EXISTS bank_details TEXT,
ADD COLUMN IF NOT EXISTS mobile_payment_details TEXT;
