-- Native branded forms per tenant (OpnForm-style, hosted on AlphaClone)

CREATE TABLE IF NOT EXISTS public.tenant_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Contact Us',
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]',
  settings JSONB NOT NULL DEFAULT '{"thankYouMessage":"Thank you! We will be in touch soon.","createLead":true}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  submission_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_tenant_forms_tenant ON public.tenant_forms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_forms_active ON public.tenant_forms(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.tenant_forms(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  submitter_name TEXT,
  submitter_email TEXT,
  submitter_phone TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
  source TEXT NOT NULL DEFAULT 'branded_form',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_tenant ON public.form_submissions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON public.form_submissions(form_id, created_at DESC);

ALTER TABLE public.tenant_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_forms_member_all" ON public.tenant_forms;
CREATE POLICY "tenant_forms_member_all" ON public.tenant_forms
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  ) WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "form_submissions_member_read" ON public.form_submissions;
CREATE POLICY "form_submissions_member_read" ON public.form_submissions
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "form_submissions_member_update" ON public.form_submissions;
CREATE POLICY "form_submissions_member_update" ON public.form_submissions
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "service_role_forms" ON public.tenant_forms;
CREATE POLICY "service_role_forms" ON public.tenant_forms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_form_submissions" ON public.form_submissions;
CREATE POLICY "service_role_form_submissions" ON public.form_submissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_forms TO authenticated;
GRANT SELECT, UPDATE ON public.form_submissions TO authenticated;
GRANT ALL ON public.tenant_forms TO service_role;
GRANT ALL ON public.form_submissions TO service_role;
