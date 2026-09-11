-- Native, tenant-isolated Lead Finder. Legacy scraper_* tables are intentionally retained.
BEGIN;

CREATE OR REPLACE FUNCTION public.lead_finder_workspace_member(target_workspace UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_id = target_workspace AND user_id = auth.uid()
  );
$$;

CREATE TABLE IF NOT EXISTS public.lead_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  search_type TEXT NOT NULL DEFAULT 'businesses_by_location',
  query TEXT, business_keywords TEXT[] NOT NULL DEFAULT '{}',
  location TEXT, country TEXT, city TEXT, region TEXT, industry TEXT,
  company_size_min INT, company_size_max INT,
  source_filters JSONB NOT NULL DEFAULT '["openstreetmap","website"]',
  requirements JSONB NOT NULL DEFAULT '{}', exclusions JSONB NOT NULL DEFAULT '{}',
  result_limit INT NOT NULL DEFAULT 50 CHECK (result_limit BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','running','paused','completed','partially_completed','failed','cancelled')),
  progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  discovered_count INT NOT NULL DEFAULT 0, accepted_count INT NOT NULL DEFAULT 0,
  rejected_count INT NOT NULL DEFAULT 0, duplicate_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ, configuration JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_search_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  search_id UUID NOT NULL REFERENCES public.lead_searches(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL, source_type TEXT, source_cursor TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','retrying','completed','failed','cancelled')),
  attempt_count INT NOT NULL DEFAULT 0, max_attempts INT NOT NULL DEFAULT 5,
  progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  records_found INT NOT NULL DEFAULT 0, records_processed INT NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(), locked_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, error_code TEXT, error_message TEXT,
  trace_id UUID NOT NULL DEFAULT gen_random_uuid(), idempotency_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id, idempotency_key)
);

-- Expand the legacy lead_search_jobs table without replacing its 72+ existing
-- jobs. Older production uses tenant_id/user_id and a different payload shape.
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS search_id UUID REFERENCES public.lead_searches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_type TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_cursor TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS records_found INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS records_processed INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS trace_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

UPDATE public.lead_search_jobs
SET workspace_id = COALESCE(workspace_id, NULLIF(to_jsonb(lead_search_jobs)->>'tenant_id', '')::uuid),
    created_by = COALESCE(created_by, NULLIF(to_jsonb(lead_search_jobs)->>'user_id', '')::uuid),
    job_type = COALESCE(job_type, 'legacy_search'),
    idempotency_key = COALESCE(idempotency_key, 'legacy:' || id::text)
WHERE workspace_id IS NULL OR created_by IS NULL OR job_type IS NULL OR idempotency_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lead_search_jobs_workspace_idempotency_uidx
  ON public.lead_search_jobs(workspace_id, idempotency_key)
  WHERE workspace_id IS NOT NULL AND idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lead_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  search_id UUID REFERENCES public.lead_searches(id) ON DELETE SET NULL,
  source_id UUID, source_type TEXT NOT NULL, source_url TEXT, source_external_id TEXT,
  business_name TEXT NOT NULL, contact_name TEXT, job_title TEXT,
  public_email TEXT, public_phone TEXT, website TEXT, domain TEXT,
  address_line_1 TEXT, address_line_2 TEXT, city TEXT, region TEXT, postal_code TEXT, country TEXT,
  latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, industry TEXT, business_category TEXT,
  company_size_estimate INT, description TEXT, facebook_url TEXT, linkedin_url TEXT,
  instagram_url TEXT, youtube_url TEXT, other_social_urls JSONB NOT NULL DEFAULT '[]',
  raw_data JSONB NOT NULL DEFAULT '{}', normalized_data JSONB NOT NULL DEFAULT '{}',
  confidence_score INT NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  quality_score INT NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  fit_score INT NOT NULL DEFAULT 0 CHECK (fit_score BETWEEN 0 AND 100),
  score_explanation JSONB NOT NULL DEFAULT '[]',
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  review_status TEXT NOT NULL DEFAULT 'new' CHECK (review_status IN ('new','reviewing','accepted','rejected','converted')),
  duplicate_status TEXT NOT NULL DEFAULT 'unique' CHECK (duplicate_status IN ('unique','possible','duplicate','merged')),
  duplicate_of_id UUID REFERENCES public.lead_candidates(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ, rejected_at TIMESTAMPTZ, rejection_reason TEXT,
  converted_lead_id UUID, converted_contact_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lead_candidates_source_unique
  ON public.lead_candidates(workspace_id, source_type, source_external_id)
  WHERE source_external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lead_candidates_results
  ON public.lead_candidates(workspace_id, search_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_candidates_domain ON public.lead_candidates(workspace_id, domain) WHERE domain IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, name TEXT NOT NULL, source_type TEXT NOT NULL,
  base_url TEXT, enabled BOOLEAN NOT NULL DEFAULT true, configuration JSONB NOT NULL DEFAULT '{}',
  rate_limit_per_minute INT NOT NULL DEFAULT 10, daily_limit INT NOT NULL DEFAULT 500,
  last_run_at TIMESTAMPTZ, health_status TEXT NOT NULL DEFAULT 'unknown', last_error TEXT,
  terms_reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id, source_type)
);

CREATE TABLE IF NOT EXISTS public.lead_contact_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  candidate_id UUID REFERENCES public.lead_candidates(id) ON DELETE CASCADE, crm_lead_id UUID,
  type TEXT NOT NULL CHECK (type IN ('email','phone','website','social','address')),
  value TEXT NOT NULL, normalized_value TEXT NOT NULL, source_url TEXT, is_public BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false, verification_status TEXT NOT NULL DEFAULT 'unverified',
  confidence_score INT NOT NULL DEFAULT 0, verified_at TIMESTAMPTZ, failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  candidate_id UUID NOT NULL REFERENCES public.lead_candidates(id) ON DELETE CASCADE,
  contact_point_id UUID REFERENCES public.lead_contact_points(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL, status TEXT NOT NULL, confidence INT NOT NULL DEFAULT 0,
  evidence JSONB NOT NULL DEFAULT '{}', checked_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, name TEXT NOT NULL, description TEXT,
  colour TEXT, is_dynamic BOOLEAN NOT NULL DEFAULT false, dynamic_filters JSONB NOT NULL DEFAULT '{}',
  lead_count INT NOT NULL DEFAULT 0, last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.lead_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  list_id UUID NOT NULL REFERENCES public.lead_lists(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.lead_candidates(id) ON DELETE CASCADE, crm_lead_id UUID,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (candidate_id IS NOT NULL OR crm_lead_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS lead_list_candidate_unique ON public.lead_list_members(list_id, candidate_id) WHERE candidate_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lead_list_crm_unique ON public.lead_list_members(list_id, crm_lead_id) WHERE crm_lead_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lead_candidate_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  candidate_id UUID REFERENCES public.lead_candidates(id) ON DELETE CASCADE, crm_lead_id UUID,
  activity_type TEXT NOT NULL, actor_type TEXT NOT NULL DEFAULT 'user', actor_id UUID, channel TEXT,
  title TEXT NOT NULL, description TEXT, metadata JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, name TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'email',
  sender_connection_id UUID, subject TEXT, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
  target_list_id UUID REFERENCES public.lead_lists(id) ON DELETE SET NULL, schedule_type TEXT NOT NULL DEFAULT 'manual',
  scheduled_at TIMESTAMPTZ, daily_send_limit INT NOT NULL DEFAULT 20 CHECK (daily_send_limit BETWEEN 1 AND 200),
  send_window JSONB NOT NULL DEFAULT '{}', timezone TEXT NOT NULL DEFAULT 'UTC',
  sent_count INT NOT NULL DEFAULT 0, delivered_count INT NOT NULL DEFAULT 0, bounced_count INT NOT NULL DEFAULT 0,
  replied_count INT NOT NULL DEFAULT 0, unsubscribed_count INT NOT NULL DEFAULT 0,
  configuration JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  campaign_id UUID REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES public.lead_candidates(id) ON DELETE SET NULL, crm_lead_id UUID,
  channel TEXT NOT NULL DEFAULT 'email', sender_identity TEXT NOT NULL, recipient TEXT NOT NULL,
  subject TEXT, body TEXT NOT NULL, provider_message_id TEXT, provider_thread_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued', scheduled_at TIMESTAMPTZ, sent_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ, clicked_at TIMESTAMPTZ, replied_at TIMESTAMPTZ, bounced_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ, error_message TEXT, metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  suppression_type TEXT NOT NULL CHECK (suppression_type IN ('email','domain','phone','company','contact','source_url')),
  value TEXT NOT NULL, normalized_value TEXT NOT NULL, reason TEXT, source TEXT, expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, suppression_type, normalized_value)
);
CREATE TABLE IF NOT EXISTS public.lead_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, filename TEXT NOT NULL, storage_path TEXT,
  file_type TEXT NOT NULL, mapping JSONB NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'queued',
  total_rows INT NOT NULL DEFAULT 0, processed_rows INT NOT NULL DEFAULT 0, accepted_rows INT NOT NULL DEFAULT 0,
  rejected_rows INT NOT NULL DEFAULT 0, duplicate_rows INT NOT NULL DEFAULT 0, error_file_path TEXT,
  started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.lead_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, format TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}', fields JSONB NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'queued',
  record_count INT NOT NULL DEFAULT 0, storage_path TEXT, expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.lead_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, source_type TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL, request_count INT NOT NULL DEFAULT 0, record_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, source_type, period_start)
);
CREATE TABLE IF NOT EXISTS public.lead_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, actor_id UUID, actor_type TEXT NOT NULL DEFAULT 'user',
  action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id UUID, before_data JSONB, after_data JSONB,
  ip_address INET, user_agent TEXT, trace_id UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['lead_searches','lead_search_jobs','lead_candidates','lead_sources','lead_contact_points',
    'lead_verifications','lead_lists','lead_list_members','lead_candidate_activities','outreach_campaigns','outreach_messages',
    'lead_suppressions','lead_imports','lead_exports','lead_rate_limits','lead_audit_logs']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS lead_finder_workspace_access ON public.%I', t);
    EXECUTE format('CREATE POLICY lead_finder_workspace_access ON public.%I FOR ALL TO authenticated USING (public.lead_finder_workspace_member(workspace_id)) WITH CHECK (public.lead_finder_workspace_member(workspace_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS lead_finder_service_access ON public.%I', t);
    EXECUTE format('CREATE POLICY lead_finder_service_access ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Persistent, skip-locked queue claim used by Railway workers.
CREATE OR REPLACE FUNCTION public.claim_lead_search_jobs(worker_id TEXT, claim_limit INT DEFAULT 5)
RETURNS SETOF public.lead_search_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.lead_search_jobs j SET status='running', locked_at=now(), started_at=COALESCE(j.started_at,now()),
    attempt_count=j.attempt_count+1, metadata=j.metadata || jsonb_build_object('worker_id',worker_id), updated_at=now()
  WHERE j.id IN (
    SELECT id FROM public.lead_search_jobs
    WHERE status IN ('queued','retrying') AND next_run_at <= now()
      AND (locked_at IS NULL OR locked_at < now()-interval '15 minutes')
    ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(claim_limit,25))
  ) RETURNING j.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_lead_search_jobs(TEXT,INT) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_lead_search_jobs(TEXT,INT) TO service_role;

-- Seed safe public sources per existing workspace without enabling prohibited networks.
INSERT INTO public.lead_sources(workspace_id, created_by, name, source_type, base_url, rate_limit_per_minute, daily_limit, terms_reviewed_at)
SELECT tu.tenant_id, (array_agg(tu.user_id))[1], s.name, s.kind, s.url, s.rpm, s.daily, now()
FROM public.tenant_users tu
CROSS JOIN (VALUES
 ('OpenStreetMap','openstreetmap','https://overpass-api.de',2,500),
 ('Public websites','website',NULL,10,500),
 ('CSV / manual import','manual',NULL,60,5000)
) AS s(name,kind,url,rpm,daily)
GROUP BY tu.tenant_id,s.name,s.kind,s.url,s.rpm,s.daily
ON CONFLICT(workspace_id,source_type) DO NOTHING;

COMMIT;
