BEGIN;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS folder_path TEXT,
  ADD COLUMN IF NOT EXISTS auto_named_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_classified_at TIMESTAMPTZ;

ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS is_latest BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY tenant_id, document_id ORDER BY version_number DESC, created_at DESC) AS row_number
  FROM public.document_versions
)
UPDATE public.document_versions versions
SET is_latest = ranked.row_number = 1,
    superseded_at = CASE WHEN ranked.row_number = 1 THEN NULL ELSE COALESCE(versions.superseded_at, NOW()) END
FROM ranked
WHERE ranked.id = versions.id;

CREATE INDEX IF NOT EXISTS idx_documents_folder_path
  ON public.documents (tenant_id, folder_path, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_document_latest_version
  ON public.document_versions (tenant_id, document_id)
  WHERE is_latest = TRUE;

COMMIT;
