-- Fix Lead Finder Results: persist discovered candidates with a non-partial unique key
-- so Supabase upsert onConflict(workspace_id, dedupe_key) works in the worker.

BEGIN;

UPDATE public.lead_candidates
SET dedupe_key = COALESCE(
  NULLIF(dedupe_key, ''),
  CASE
    WHEN source_external_id IS NOT NULL THEN source_type || ':' || source_external_id
    WHEN domain IS NOT NULL THEN source_type || ':domain:' || domain
    ELSE source_type || ':legacy:' || id::text
  END
)
WHERE dedupe_key IS NULL OR dedupe_key = '';

ALTER TABLE public.lead_candidates
  ALTER COLUMN dedupe_key SET DEFAULT '';

ALTER TABLE public.lead_candidates
  ALTER COLUMN dedupe_key SET NOT NULL;

ALTER TABLE public.lead_candidates
  DROP CONSTRAINT IF EXISTS lead_candidates_workspace_dedupe_key;

ALTER TABLE public.lead_candidates
  ADD CONSTRAINT lead_candidates_workspace_dedupe_key
  UNIQUE (workspace_id, dedupe_key);

COMMIT;
