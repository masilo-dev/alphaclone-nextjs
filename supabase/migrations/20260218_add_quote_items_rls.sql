-- Enable RLS on quote_items (if not already enabled, though likely is)
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- Policy for Tenant Users (Admins, etc) to manage items
-- Requires quote_items to have tenant_id populated or we join with quotes
-- Since we are fixing quoteService to populate tenant_id, we can use that.
-- However, for robustness, we can also check the parent quote ownership if tenant_id is missing on item?
-- For now, let's enforce tenant_id check.

CREATE POLICY "Tenant users can ALL quote_items" ON quote_items
FOR ALL
USING (
  (select auth.uid()) in (
    select user_id from tenant_users where tenant_id = quote_items.tenant_id
  )
)
WITH CHECK (
  (select auth.uid()) in (
    select user_id from tenant_users where tenant_id = quote_items.tenant_id
  )
);
