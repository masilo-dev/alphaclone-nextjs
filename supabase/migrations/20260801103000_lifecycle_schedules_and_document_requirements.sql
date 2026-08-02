BEGIN;

CREATE TABLE IF NOT EXISTS public.document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('missing','requested','received','waived','expired')),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  requested_from_email TEXT,
  reminder_interval_days INTEGER NOT NULL DEFAULT 7 CHECK (reminder_interval_days > 0),
  last_reminded_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_requirements_due
  ON public.document_requirements (tenant_id, status, due_date);

ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS document_requirements_tenant_access ON public.document_requirements;
CREATE POLICY document_requirements_tenant_access ON public.document_requirements
  FOR ALL USING (public.user_has_tenant_access((SELECT auth.uid()), tenant_id))
  WITH CHECK (public.user_has_tenant_access((SELECT auth.uid()), tenant_id));

COMMIT;
