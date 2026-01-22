-- Create improvements table for exit-intent feedback
CREATE TABLE IF NOT EXISTS improvements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
  source TEXT DEFAULT 'exit_intent',
  channel TEXT DEFAULT 'web',
  page_url TEXT,
  user_type TEXT CHECK (user_type IN ('visitor', 'client', 'tenant_admin', 'admin')),
  user_id UUID REFERENCES auth.users(id),
  is_pwa BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add user profile flags for exit-intent tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_seen_exit_improvement BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_submitted_exit_improvement BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE improvements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin can read all
CREATE POLICY "Admins can view all improvements"
  ON improvements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Anyone can insert (for anonymous submissions)
CREATE POLICY "Anyone can submit improvements"
  ON improvements FOR INSERT
  WITH CHECK (true);

-- Admin can update
CREATE POLICY "Admins can update improvements"
  ON improvements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_improvements_status ON improvements(status);
CREATE INDEX IF NOT EXISTS idx_improvements_created_at ON improvements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_improvements_user_id ON improvements(user_id);
CREATE INDEX IF NOT EXISTS idx_improvements_severity ON improvements(severity);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_improvements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER improvements_updated_at
  BEFORE UPDATE ON improvements
  FOR EACH ROW
  EXECUTE FUNCTION update_improvements_updated_at();
