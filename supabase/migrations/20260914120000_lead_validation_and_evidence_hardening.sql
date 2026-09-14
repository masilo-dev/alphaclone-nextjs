-- Additive Lead Finder hardening. Candidates remain candidates until deterministic
-- qualification succeeds; this does not delete or auto-promote historical CRM data.
BEGIN;

ALTER TABLE public.lead_candidates
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'candidate',
  ADD COLUMN IF NOT EXISTS entity_resolution_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS qualification_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS qualification_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.lead_candidates
  DROP CONSTRAINT IF EXISTS lead_candidates_lifecycle_status_check,
  ADD CONSTRAINT lead_candidates_lifecycle_status_check CHECK (lifecycle_status IN (
    'candidate','discovered','enriching','enriched','verification_pending','verified',
    'qualified','contacted','engaged','replied','opportunity','customer','disqualified'
  )),
  DROP CONSTRAINT IF EXISTS lead_candidates_entity_resolution_status_check,
  ADD CONSTRAINT lead_candidates_entity_resolution_status_check CHECK (entity_resolution_status IN ('unverified','resolved','quarantined','invalid')),
  DROP CONSTRAINT IF EXISTS lead_candidates_qualification_status_check,
  ADD CONSTRAINT lead_candidates_qualification_status_check CHECK (qualification_status IN ('pending','qualified','disqualified','needs_reverification'));

ALTER TABLE public.lead_qualification_snapshots
  ADD COLUMN IF NOT EXISTS qualified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hard_gate_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scoring_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS disqualification_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.lead_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.lead_candidates(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  attribute TEXT NOT NULL,
  value JSONB NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT,
  observed_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence INTEGER NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  evidence_type TEXT NOT NULL DEFAULT 'observed' CHECK (evidence_type IN ('verified','observed','inference','unknown')),
  extraction_method TEXT,
  model_id TEXT,
  workflow_run_id UUID,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (candidate_id IS NOT NULL OR lead_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS lead_evidence_candidate_idx ON public.lead_evidence(workspace_id, candidate_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS lead_evidence_lead_idx ON public.lead_evidence(workspace_id, lead_id, collected_at DESC);

ALTER TABLE public.lead_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_evidence_workspace_access ON public.lead_evidence;
CREATE POLICY lead_evidence_workspace_access ON public.lead_evidence FOR ALL TO authenticated
  USING (public.lead_finder_workspace_member(workspace_id))
  WITH CHECK (public.lead_finder_workspace_member(workspace_id));
DROP POLICY IF EXISTS lead_evidence_service_access ON public.lead_evidence;
CREATE POLICY lead_evidence_service_access ON public.lead_evidence FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.prevent_lead_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Lead evidence is immutable; append a correction with provenance instead';
END;
$$;
DROP TRIGGER IF EXISTS lead_evidence_immutable ON public.lead_evidence;
CREATE TRIGGER lead_evidence_immutable BEFORE UPDATE OR DELETE ON public.lead_evidence
FOR EACH ROW EXECUTE FUNCTION public.prevent_lead_evidence_mutation();

-- Source audit, intentionally read-only and not an outreach trigger.
CREATE OR REPLACE VIEW public.lead_reverification_report
WITH (security_invoker = true) AS
SELECT workspace_id,
  count(*) AS total_evaluated,
  count(*) FILTER (WHERE public_email IS NULL OR public_email = '') AS missing_email,
  count(*) FILTER (WHERE qualification_status = 'needs_reverification') AS needs_reverification,
  count(*) FILTER (WHERE duplicate_status IN ('possible','duplicate','merged')) AS possible_duplicates,
  count(*) FILTER (WHERE entity_resolution_status IN ('quarantined','invalid')) AS non_business_entities,
  count(*) FILTER (WHERE confidence_score < 50) AS low_confidence
FROM public.lead_candidates
GROUP BY workspace_id;
REVOKE ALL ON public.lead_reverification_report FROM PUBLIC, anon;
GRANT SELECT ON public.lead_reverification_report TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
