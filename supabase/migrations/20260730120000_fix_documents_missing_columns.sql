-- ================================================================
-- FIX: documents table missing columns
-- Safe to re-run. Uses ADD COLUMN IF NOT EXISTS throughout.
-- Error observed: "column documents.metadata does not exist" (pg code 42703)
-- Root cause: CREATE TABLE IF NOT EXISTS skips body when table already exists,
--   so tenant DBs created before this migration lack these columns.
-- ================================================================

-- Core columns that the GET query selects
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS owner_user_id UUID,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID,
  ADD COLUMN IF NOT EXISTS mime_type TEXT DEFAULT 'application/octet-stream',
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill: if name is null but title exists, sync them
UPDATE public.documents SET name = title WHERE name IS NULL AND title IS NOT NULL;
UPDATE public.documents SET title = name WHERE title IS NULL AND name IS NOT NULL;

-- Ensure name has a fallback value where both are null
UPDATE public.documents SET name = 'Untitled Document' WHERE name IS NULL;

-- Make name NOT NULL after backfill (only if the column exists but is nullable)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.documents ALTER COLUMN name SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set name NOT NULL: %', SQLERRM;
  END;
END $$;

-- Ensure index exists for the tenant+updated query pattern
CREATE INDEX IF NOT EXISTS idx_documents_tenant_updated
  ON public.documents (tenant_id, updated_at DESC)
  WHERE deleted_at IS NULL;

-- Ensure document_relationships table exists (referenced in the GET handler)
CREATE TABLE IF NOT EXISTS public.document_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'attachment',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_relationships_entity
  ON public.document_relationships (tenant_id, entity_type, entity_id);

ALTER TABLE public.document_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_relationships_tenant_all ON public.document_relationships;
CREATE POLICY document_relationships_tenant_all ON public.document_relationships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = document_relationships.tenant_id AND tu.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = document_relationships.tenant_id AND tu.user_id = auth.uid()
    )
  );

-- Ensure document_activity table exists (used in POST handler)
CREATE TABLE IF NOT EXISTS public.document_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  document_id UUID NOT NULL,
  actor_user_id UUID,
  action TEXT NOT NULL,
  old_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_activity_doc
  ON public.document_activity (document_id, created_at DESC);

ALTER TABLE public.document_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_activity_tenant_select ON public.document_activity;
CREATE POLICY document_activity_tenant_select ON public.document_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = document_activity.tenant_id AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS document_activity_service_insert ON public.document_activity;
CREATE POLICY document_activity_service_insert ON public.document_activity
  FOR INSERT TO service_role WITH CHECK (true);
