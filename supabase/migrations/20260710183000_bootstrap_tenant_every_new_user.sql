-- Every new signup is a business owner with their own tenant workspace by default.

CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_full_name text;
  workspace_name text;
  workspace_slug text;
  random_suffix text;
BEGIN
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'User'
  );

  INSERT INTO public.profiles (id, email, name, role)
  VALUES (NEW.id, NEW.email, user_full_name, 'tenant_admin')
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = 'tenant_admin';

  IF NOT EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = NEW.id) THEN
    workspace_name := COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'business_name'), ''),
      user_full_name || '''s Organization'
    );
    random_suffix := substring(md5(random()::text) from 1 for 5);
    workspace_slug := left(
      regexp_replace(lower(workspace_name), '[^a-z0-9]+', '-', 'g'),
      60
    ) || '-' || random_suffix;

    PERFORM public.create_tenant(
      workspace_name,
      workspace_slug,
      NEW.id,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'plan', ''), 'free')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_registration();
