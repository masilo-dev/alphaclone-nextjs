-- Standalone WhatsApp message store for the WhatsApp module.
-- GREEN-API webhooks and manual/API sends write here directly instead of
-- relying on unified_messages as the primary WhatsApp inbox.

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES public.whatsapp_integrations(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    client_id UUID,
    chat_id TEXT,
    phone_number TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT NOT NULL DEFAULT 'text',
    body TEXT NOT NULL DEFAULT '',
    media JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider TEXT NOT NULL DEFAULT 'green-api',
    provider_message_id TEXT,
    provider_receipt_id TEXT,
    status TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'received')),
    sent_by TEXT NOT NULL DEFAULT 'unknown'
        CHECK (sent_by IN ('contact', 'human', 'api', 'bot', 'phone', 'unknown')),
    needs_response BOOLEAN NOT NULL DEFAULT false,
    auto_replied BOOLEAN NOT NULL DEFAULT false,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, provider_message_id)
);

ALTER TABLE public.whatsapp_outreach_logs
    ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.whatsapp_outreach_logs
    ALTER COLUMN lead_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_tenant_created
    ON public.whatsapp_messages (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_thread
    ON public.whatsapp_messages (tenant_id, phone_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status
    ON public.whatsapp_messages (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact
    ON public.whatsapp_messages (contact_id, created_at DESC)
    WHERE contact_id IS NOT NULL;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_whatsapp_messages_read" ON public.whatsapp_messages;
CREATE POLICY "tenant_whatsapp_messages_read"
    ON public.whatsapp_messages FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "tenant_whatsapp_messages_manage" ON public.whatsapp_messages;
CREATE POLICY "tenant_whatsapp_messages_manage"
    ON public.whatsapp_messages FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_messages_updated_at ON public.whatsapp_messages;
CREATE TRIGGER trg_whatsapp_messages_updated_at
    BEFORE UPDATE ON public.whatsapp_messages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
