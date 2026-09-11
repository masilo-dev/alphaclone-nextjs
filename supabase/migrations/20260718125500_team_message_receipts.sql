CREATE TABLE IF NOT EXISTS public.message_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivery_channel TEXT NOT NULL DEFAULT 'email',
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, delivery_channel)
);

CREATE INDEX IF NOT EXISTS idx_message_receipts_message ON public.message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_receipts_user ON public.message_receipts(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_message_receipts_tenant ON public.message_receipts(tenant_id, created_at DESC);
ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.message_receipts FROM anon, authenticated;
GRANT ALL ON TABLE public.message_receipts TO service_role;
