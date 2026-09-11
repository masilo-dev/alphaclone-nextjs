-- Drop the incorrect foreign key constraint on quotes.contact_id
-- This constraint incorrectly enforced that contact_id must reference public.profiles(id)
-- However, the application uses generic IDs (Business Clients, Leads) in this field.

ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_contact_id_fkey;
