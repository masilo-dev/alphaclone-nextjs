
-- Migration: Add category string field to expenses for denormalized reporting
-- Date: 2026-05-13

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category TEXT;

-- Seed with 'Uncategorized' for existing rows (if any)
UPDATE expenses SET category = 'Uncategorized' WHERE category IS NULL;

-- Also ensure total_amount vs amount consistency if needed
-- The request mentions total_amount in the report shape.
-- In the DB it is 'amount' and 'total' (generated).
-- I'll keep the DB as is but ensure the code maps it correctly.
