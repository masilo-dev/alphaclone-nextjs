-- Migration: Make access_token and refresh_token nullable/defaulted in microsoft_connections to support encrypted vault model
ALTER TABLE public.microsoft_connections 
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN access_token SET DEFAULT '',
  ALTER COLUMN refresh_token DROP NOT NULL,
  ALTER COLUMN refresh_token SET DEFAULT '';

-- Ensure unique constraint on user_id for ON CONFLICT upserting
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.microsoft_connections'::regclass 
      AND contype = 'u' 
      AND conname = 'microsoft_connections_user_id_key'
  ) THEN
    ALTER TABLE public.microsoft_connections 
      ADD CONSTRAINT microsoft_connections_user_id_key UNIQUE (user_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
