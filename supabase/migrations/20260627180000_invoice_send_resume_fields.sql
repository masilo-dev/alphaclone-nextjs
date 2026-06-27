-- Invoice send resume tracking

ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_step TEXT CHECK (last_step IN ('pdf_generated', 'email_sent', 'status_updated'));

COMMENT ON COLUMN public.business_invoices.last_step IS 'Last completed step when send flow failed — used for resume';
COMMENT ON COLUMN public.business_invoices.failed_at IS 'Timestamp when invoice send flow last failed';
