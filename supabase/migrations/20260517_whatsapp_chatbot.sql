-- Migration for AI WhatsApp Chatbot
-- Path: supabase/migrations/20260517_whatsapp_chatbot.sql

CREATE TABLE IF NOT EXISTS public.whatsapp_chatbot_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    chatbot_enabled BOOLEAN NOT NULL DEFAULT false,
    persona_prompt TEXT,
    handoff_rules JSONB DEFAULT '{}'::jsonb,
    auto_outreach_enabled BOOLEAN NOT NULL DEFAULT false,
    outreach_limit_per_day INTEGER NOT NULL DEFAULT 50,
    outreach_delay_seconds INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_outreach_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL, -- references business_clients or leads
    phone_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, replied
    message_content TEXT,
    error_details TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add whatsapp opt-out to clients
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'business_clients' AND COLUMN_NAME = 'whatsapp_dnc') THEN
        ALTER TABLE public.business_clients ADD COLUMN whatsapp_dnc BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'business_clients' AND COLUMN_NAME = 'whatsapp_outreach_sent_at') THEN
        ALTER TABLE public.business_clients ADD COLUMN whatsapp_outreach_sent_at TIMESTAMPTZ;
    END IF;
END $$;

ALTER TABLE public.whatsapp_chatbot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_outreach_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_manage_chatbot_settings" ON public.whatsapp_chatbot_settings
FOR ALL TO authenticated USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
) WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
);

CREATE POLICY "tenant_manage_outreach_logs" ON public.whatsapp_outreach_logs
FOR ALL TO authenticated USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
) WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
);
