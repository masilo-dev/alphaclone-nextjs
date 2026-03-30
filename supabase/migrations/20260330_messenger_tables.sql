-- Create messenger_conversations table
CREATE TABLE IF NOT EXISTS public.messenger_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    page_id TEXT NOT NULL,
    sender_id TEXT NOT NULL, -- PSID (Page Scoped ID)
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL, -- Link to CRM Contact
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_preview TEXT,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, page_id, sender_id)
);

-- Create messenger_messages table
CREATE TABLE IF NOT EXISTS public.messenger_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
    mid TEXT UNIQUE NOT NULL, -- Facebook Message ID
    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    text TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    sender_type TEXT CHECK (sender_type IN ('user', 'page')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messenger_conv_tenant ON public.messenger_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messenger_conv_page_sender ON public.messenger_conversations(page_id, sender_id);
CREATE INDEX IF NOT EXISTS idx_messenger_msg_conv ON public.messenger_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messenger_msg_created ON public.messenger_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.messenger_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Conversations
CREATE POLICY "Users can view their tenant's messenger conversations"
    ON public.messenger_conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.tenant_id = messenger_conversations.tenant_id
        )
    );

-- RLS Policies for Messages
CREATE POLICY "Users can view their tenant's messenger messages"
    ON public.messenger_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.messenger_conversations c
            JOIN public.users u ON u.tenant_id = c.tenant_id
            WHERE c.id = messenger_messages.conversation_id
            AND u.id = auth.uid()
        )
    );

-- Trigger for updated_at on messenger_conversations
CREATE OR REPLACE FUNCTION update_messenger_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_messenger_conversations_updated_at_trigger
    BEFORE UPDATE ON public.messenger_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_messenger_conversations_updated_at();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
