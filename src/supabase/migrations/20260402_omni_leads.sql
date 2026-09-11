-- Add social_links field to leads table to store fetched FB/IG/LinkedIn URLs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'social_links') THEN
        ALTER TABLE public.leads ADD COLUMN social_links JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;
