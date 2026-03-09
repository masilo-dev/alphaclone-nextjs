-- AUTO-TENANT ASSOCIATION FOR GOOGLE USERS

-- 1. Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS trigger AS $$
DECLARE
  default_tenant_id uuid := '2cd1b4ff-6e84-49cb-9f22-56ea8cf1e57f'; -- "Default Organization"
  user_full_name text;
  user_role_val public.user_role;
BEGIN
  -- Get name from metadata or fallback
  user_full_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User');
  
  -- Determine role (default to tenant_admin for Google sign-ups if they need dashboard access)
  user_role_val := COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'tenant_admin'::public.user_role);

  -- Ensure profile exists (idempotent)
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (new.id, new.email, user_full_name, user_role_val)
  ON CONFLICT (id) DO UPDATE 
  SET email = EXCLUDED.email, 
      name = EXCLUDED.name,
      role = user_role_val;

  -- Automatically link GOOGLE users to the default tenant if they aren't already linked
  IF new.raw_app_meta_data->>'provider' = 'google' THEN
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (default_tenant_id, new.id, 'tenant_admin'::public.user_role)
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-create the trigger (drop if exists for clean state)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_registration();

-- 3. BACKFILL for users from the last 14 days
DO $$
DECLARE
  default_tenant_id uuid := '2cd1b4ff-6e84-49cb-9f22-56ea8cf1e57f';
BEGIN
  -- Link existing Google users from last 14 days who lack accounts
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  SELECT default_tenant_id, id, 'tenant_admin'::public.user_role
  FROM auth.users
  WHERE created_at > now() - interval '14 days'
  AND raw_app_meta_data->>'provider' = 'google'
  AND id NOT IN (SELECT user_id FROM public.tenant_users)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;
  
  -- Also ensure profiles exist for them
  INSERT INTO public.profiles (id, email, name, role)
  SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'User'),
    'tenant_admin'::public.user_role
  FROM auth.users
  WHERE created_at > now() - interval '14 days'
  AND id NOT IN (SELECT id FROM public.profiles)
  ON CONFLICT (id) DO NOTHING;
END $$;
