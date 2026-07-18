ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoice-documents', 'invoice-documents', false, 15728640, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_documents_tenant_read ON storage.objects;
CREATE POLICY invoice_documents_tenant_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoice-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );
