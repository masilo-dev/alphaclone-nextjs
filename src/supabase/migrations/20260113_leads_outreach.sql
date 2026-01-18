-- Add outreach fields to leads table
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'leads'
        AND column_name = 'outreach_message'
) THEN
ALTER TABLE public.leads
ADD COLUMN outreach_message TEXT;
ALTER TABLE public.leads
ADD COLUMN outreach_status TEXT DEFAULT 'pending';
-- pending, sent, replied
END IF;
END $$;