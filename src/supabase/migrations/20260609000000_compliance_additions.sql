-- Compliance additions for legal pages, consent capture, and data export logging

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS communication_prefs jsonb DEFAULT '{
    "transactional": true,
    "product_updates": true,
    "marketing": false,
    "sms": false
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS gdpr_consent_date timestamptz,
  ADD COLUMN IF NOT EXISTS gdpr_consent_ip text;

CREATE TABLE IF NOT EXISTS public.data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  request_type text NOT NULL,
  details text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_requests_user_type_created_at
  ON public.data_requests (user_id, request_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.dpa_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  email text NOT NULL,
  country text NOT NULL,
  notes text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dpa_requests_created_at
  ON public.dpa_requests (created_at DESC);
