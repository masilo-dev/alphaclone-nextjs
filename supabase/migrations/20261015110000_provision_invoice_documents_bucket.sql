-- Migration: Idempotent provisioning of invoice-documents storage bucket & invoice PDF tracking columns
-- Safe for repeated application on production databases

-- 1. Add PDF tracking columns to public.business_invoices if they do not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'business_invoices' 
      AND column_name = 'pdf_storage_path'
  ) THEN
    ALTER TABLE public.business_invoices ADD COLUMN pdf_storage_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'business_invoices' 
      AND column_name = 'pdf_generated_at'
  ) THEN
    ALTER TABLE public.business_invoices ADD COLUMN pdf_generated_at timestamptz;
  END IF;
END $$;

-- 2. Idempotently insert the private invoice-documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoice-documents', 'invoice-documents', false, 15728640, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. RLS policy to permit authenticated tenant members to view invoice PDFs
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'invoice_documents_tenant_read'
  ) THEN
    CREATE POLICY invoice_documents_tenant_read ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'invoice-documents'
        AND (
          (storage.foldername(name))[1] IN (
            SELECT tenant_id::text FROM public.tenant_users WHERE user_id = auth.uid()
          )
          OR
          (storage.foldername(name))[2] IN (
            SELECT tenant_id::text FROM public.tenant_users WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;
