-- Enable public access to business_invoices where is_public is true
CREATE POLICY "Public invoices are viewable by everyone"
ON business_invoices
FOR SELECT
TO anon
USING (is_public = true);

-- Enable public access to linked Profiles (Tenants)
CREATE POLICY "Public invoice tenants are viewable"
ON profiles
FOR SELECT
TO anon
USING (
  id IN (
    SELECT tenant_id 
    FROM business_invoices 
    WHERE is_public = true
  )
);

-- Enable public access to linked Business Clients
ALTER TABLE business_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public invoice clients are viewable"
ON business_clients
FOR SELECT
TO anon
USING (
  id IN (
    SELECT client_id 
    FROM business_invoices 
    WHERE is_public = true
  )
);

-- Enable public access to linked Projects
-- Note: 'projects' table already has RLS enabled
CREATE POLICY "Public invoice projects are viewable"
ON projects
FOR SELECT
TO anon
USING (
  id IN (
    SELECT project_id 
    FROM business_invoices 
    WHERE is_public = true
  )
);

-- Add missing index on project_id for performance
CREATE INDEX IF NOT EXISTS idx_business_invoices_project ON business_invoices(project_id);
