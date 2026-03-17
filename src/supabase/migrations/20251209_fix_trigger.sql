-- Migration to fix registration trigger
-- 1. Redefine handle_new_user with safer string handling for enums

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_role public.user_role;
  raw_role text;
BEGIN
  -- Get the role from metadata, default to client
  raw_role := NEW.raw_user_meta_data->>'role';
  
  -- Safely assign role
  IF raw_role = 'admin' THEN
    new_role := 'admin';
  ELSIF raw_role = 'visitor' THEN
    new_role := 'visitor';
  ELSE
    new_role := 'client';
  END IF;

  INSERT INTO public.profiles (id, email, name, role, avatar)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    new_role,
    COALESCE(NEW.raw_user_meta_data->>'avatar', '')
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error (visible in Supabase logs)
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    -- Reraise to fail the transaction so the user knows
    RAISE EXCEPTION 'Database error saving new user: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure the trigger is attached (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
