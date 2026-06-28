-- Create twilio_integrations table for per-tenant Twilio credential storage
-- Credentials are entered manually by each tenant and never hardcoded.

CREATE TABLE IF NOT EXISTS public.twilio_integrations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL UNIQUE,
    account_sid  TEXT NOT NULL,
    auth_token   TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast tenant lookups
CREATE INDEX IF NOT EXISTS idx_twilio_integrations_tenant_id
    ON public.twilio_integrations(tenant_id);

-- Row Level Security
ALTER TABLE public.twilio_integrations ENABLE ROW LEVEL SECURITY;

-- Service role (used by API routes) has full access
DROP POLICY IF EXISTS "Service role full access to twilio_integrations" ON public.twilio_integrations;
CREATE POLICY "Service role full access to twilio_integrations"
    ON public.twilio_integrations FOR ALL
    USING (true)
    WITH CHECK (true);

-- auto-update updated_at on every write
CREATE OR REPLACE FUNCTION update_twilio_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS twilio_integrations_updated_at_trigger ON public.twilio_integrations;
CREATE TRIGGER twilio_integrations_updated_at_trigger
    BEFORE UPDATE ON public.twilio_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_twilio_integrations_updated_at();

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
