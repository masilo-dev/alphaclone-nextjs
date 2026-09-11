-- Canonical, evidence-backed commercial intelligence for Lead Finder and CRM.
BEGIN;

CREATE TABLE IF NOT EXISTS public.lead_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.lead_candidates(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  signal_category TEXT NOT NULL,
  signal_value TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'system',
  source_url TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  weight INTEGER NOT NULL DEFAULT 0 CHECK (weight BETWEEN -100 AND 100),
  raw_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (candidate_id IS NOT NULL OR lead_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS lead_signals_candidate_idx ON public.lead_signals(workspace_id, candidate_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS lead_signals_lead_idx ON public.lead_signals(workspace_id, lead_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS lead_signals_expiry_idx ON public.lead_signals(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lead_qualification_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.lead_candidates(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  fit_score INTEGER NOT NULL DEFAULT 0 CHECK (fit_score BETWEEN 0 AND 100),
  need_score INTEGER NOT NULL DEFAULT 0 CHECK (need_score BETWEEN 0 AND 100),
  intent_score INTEGER NOT NULL DEFAULT 0 CHECK (intent_score BETWEEN 0 AND 100),
  why_now_score INTEGER NOT NULL DEFAULT 0 CHECK (why_now_score BETWEEN 0 AND 100),
  reachability_score INTEGER NOT NULL DEFAULT 0 CHECK (reachability_score BETWEEN 0 AND 100),
  freshness_score INTEGER NOT NULL DEFAULT 0 CHECK (freshness_score BETWEEN 0 AND 100),
  confidence_score INTEGER NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  alphaclone_opportunity_score INTEGER NOT NULL DEFAULT 0 CHECK (alphaclone_opportunity_score BETWEEN 0 AND 100),
  digital_maturity_score INTEGER NOT NULL DEFAULT 0 CHECK (digital_maturity_score BETWEEN 0 AND 100),
  business_maturity TEXT NOT NULL DEFAULT 'unknown' CHECK (business_maturity IN ('new','early','established','mature','unknown')),
  business_maturity_confidence INTEGER NOT NULL DEFAULT 0 CHECK (business_maturity_confidence BETWEEN 0 AND 100),
  master_score INTEGER NOT NULL DEFAULT 0 CHECK (master_score BETWEEN 0 AND 100),
  grade TEXT NOT NULL DEFAULT 'Reject' CHECK (grade IN ('A','B','C','D','Reject')),
  priority_band TEXT NOT NULL DEFAULT 'ignore' CHECK (priority_band IN ('immediate','high','medium','low','ignore')),
  relationship_state TEXT NOT NULL DEFAULT 'unknown',
  buying_stage TEXT NOT NULL DEFAULT 'unqualified',
  qualification_reason TEXT NOT NULL,
  why_now TEXT NOT NULL,
  qualification_summary TEXT NOT NULL,
  recommended_offer JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_action TEXT NOT NULL DEFAULT 'review',
  next_best_action_reason TEXT NOT NULL,
  outreach_angle TEXT,
  decision_maker_name TEXT,
  decision_maker_title TEXT,
  decision_maker_source TEXT,
  decision_maker_confidence INTEGER NOT NULL DEFAULT 0 CHECK (decision_maker_confidence BETWEEN 0 AND 100),
  recommended_role TEXT NOT NULL DEFAULT 'Owner / Managing Director',
  personalization_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  detected_opportunities JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_activity_at TIMESTAMPTZ,
  last_activity_source TEXT,
  activity_confidence INTEGER NOT NULL DEFAULT 0 CHECK (activity_confidence BETWEEN 0 AND 100),
  activity_state TEXT NOT NULL DEFAULT 'uncertain',
  last_contact_at TIMESTAMPTZ,
  last_contact_channel TEXT,
  last_contact_outcome TEXT,
  contact_attempt_count INTEGER NOT NULL DEFAULT 0,
  last_enriched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_qualified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_requalification_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  rules_version TEXT NOT NULL DEFAULT 'qualification-rules-v1',
  model_version TEXT NOT NULL DEFAULT 'deterministic-v1',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (candidate_id IS NOT NULL OR lead_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS lead_qualification_candidate_current_uidx
  ON public.lead_qualification_snapshots(workspace_id, candidate_id) WHERE candidate_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lead_qualification_lead_current_uidx
  ON public.lead_qualification_snapshots(workspace_id, lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lead_qualification_priority_idx
  ON public.lead_qualification_snapshots(workspace_id, master_score DESC, calculated_at DESC);

ALTER TABLE public.lead_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_qualification_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Tenant members read lead intelligence" ON public.lead_signals FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = workspace_id AND tu.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Tenant members read qualification snapshots" ON public.lead_qualification_snapshots FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = workspace_id AND tu.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.get_top_lead_opportunities(p_workspace_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS SETOF public.lead_qualification_snapshots
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.* FROM public.lead_qualification_snapshots q
  WHERE q.workspace_id = p_workspace_id
    AND q.relationship_state NOT IN ('customer', 'do_not_contact', 'unsubscribed')
  ORDER BY q.master_score DESC, q.calculated_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;
REVOKE ALL ON FUNCTION public.get_top_lead_opportunities(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_lead_opportunities(UUID, INTEGER) TO authenticated, service_role;

COMMIT;
