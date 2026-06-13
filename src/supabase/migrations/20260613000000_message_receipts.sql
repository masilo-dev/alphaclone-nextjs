-- Track per-user delivery and read receipts for group/team messages.
CREATE TABLE IF NOT EXISTS public.message_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    delivery_channel TEXT NOT NULL DEFAULT 'email',
    delivered_at TIMESTAMPTZ DEFAULT NULL,
    read_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (message_id, user_id, delivery_channel)
);

ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipients can view their receipts" ON public.message_receipts;
CREATE POLICY "Recipients can view their receipts"
ON public.message_receipts
FOR SELECT
USING (
    auth.uid() = user_id
    OR auth.uid() IN (
        SELECT sender_id FROM public.messages m WHERE m.id = message_id
    )
    OR auth.uid() IN (
        SELECT id FROM public.profiles WHERE role = 'admin'
    )
);

DROP POLICY IF EXISTS "Recipients can update their receipts" ON public.message_receipts;
CREATE POLICY "Recipients can update their receipts"
ON public.message_receipts
FOR UPDATE
USING (
    auth.uid() = user_id
    OR auth.uid() IN (
        SELECT sender_id FROM public.messages m WHERE m.id = message_id
    )
    OR auth.uid() IN (
        SELECT id FROM public.profiles WHERE role = 'admin'
    )
)
WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() IN (
        SELECT sender_id FROM public.messages m WHERE m.id = message_id
    )
    OR auth.uid() IN (
        SELECT id FROM public.profiles WHERE role = 'admin'
    )
);

DROP POLICY IF EXISTS "Senders can create receipts for their messages" ON public.message_receipts;
CREATE POLICY "Senders can create receipts for their messages"
ON public.message_receipts
FOR INSERT
WITH CHECK (
    auth.uid() IN (
        SELECT sender_id FROM public.messages m WHERE m.id = message_id
    )
    OR auth.uid() IN (
        SELECT id FROM public.profiles WHERE role = 'admin'
    )
);

CREATE INDEX IF NOT EXISTS idx_message_receipts_message ON public.message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_receipts_user ON public.message_receipts(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_message_receipts_tenant ON public.message_receipts(tenant_id, created_at DESC);
