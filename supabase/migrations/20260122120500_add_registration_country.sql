-- Add registration_country to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS registration_country TEXT;

-- Update RLS policies to allow users to read their own registration country
-- (Existing policies might already cover select *)
