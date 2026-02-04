-- Fix test user role mismatch
-- Update TENANT_EMAIL user from 'admin' to 'tenant_admin'

-- Update the profiles table
UPDATE profiles
SET role = 'tenant_admin'
WHERE email = 'bonnie.masilo@gmail.com';

-- Update the auth.users metadata
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"tenant_admin"'
)
WHERE email = 'bonnie.masilo@gmail.com';

-- Verify the update
SELECT 
    email,
    role,
    raw_user_meta_data->>'role' as metadata_role
FROM auth.users
LEFT JOIN profiles ON auth.users.id = profiles.id
WHERE email = 'bonnie.masilo@gmail.com';
