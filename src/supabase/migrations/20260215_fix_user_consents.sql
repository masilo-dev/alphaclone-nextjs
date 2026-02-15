DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_consents' AND column_name = 'consent_given') THEN
        ALTER TABLE user_consents RENAME COLUMN consent_given TO granted;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_consents' AND column_name = 'given_at') THEN
        ALTER TABLE user_consents RENAME COLUMN given_at TO granted_at;
    END IF;
END $$;
