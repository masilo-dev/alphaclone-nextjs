-- Optimize RLS policy for business_settings to use tenant_users table
-- This is faster and more secure than checking profiles (which has no tenant_id)

-- Drop existing inefficient policy
DROP POLICY IF EXISTS "Tenants can manage their own settings" ON business_settings;

-- Create new optimized policy
CREATE POLICY "Tenants can manage their own settings"
ON business_settings
FOR ALL
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid()
  )
);

-- Ensure index exists on tenant_users(user_id) for fast lookups
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
