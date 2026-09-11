-- Add Momentum & Streak tracking to Profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_login_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS login_streak int DEFAULT 0,
ADD COLUMN IF NOT EXISTS momentum_score numeric DEFAULT 0;

-- Function to update login streaks
CREATE OR REPLACE FUNCTION update_user_streak()
RETURNS trigger AS $$
BEGIN
  IF (NEW.last_login_at::date > OLD.last_login_at::date) THEN
    IF (NEW.last_login_at::date = OLD.last_login_at::date + interval '1 day') THEN
      NEW.login_streak := OLD.login_streak + 1;
    ELSE
      NEW.login_streak := 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_login_streak ON profiles;
CREATE TRIGGER on_user_login_streak
  BEFORE UPDATE OF last_login_at ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_streak();
