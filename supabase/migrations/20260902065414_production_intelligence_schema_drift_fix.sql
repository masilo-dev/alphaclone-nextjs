-- Repair production schema drift causing Postgres errors in deal intelligence,
-- daily summaries, integration health, and MCP knowledge graph queries.
-- Safe to re-run (IF NOT EXISTS / guarded DO blocks).

BEGIN;

-- ── 1) deal_stakeholders — intelligence + stakeholder API ───────────────────
ALTER TABLE public.deal_stakeholders
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS influence_weight NUMERIC NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_deal_stakeholders_contact
  ON public.deal_stakeholders (tenant_id, contact_id)
  WHERE contact_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_deal_stakeholders_tenant_deal_contact_role
  ON public.deal_stakeholders (tenant_id, deal_id, contact_id, role)
  WHERE contact_id IS NOT NULL;

-- ── 2) leads — compatibility aliases used by summaries / knowledge graph ────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN name TEXT GENERATED ALWAYS AS (
        COALESCE(NULLIF(trim(contact_name), ''), NULLIF(trim(business_name), ''))
      ) STORED;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'company'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN company TEXT GENERATED ALWAYS AS (
        NULLIF(trim(business_name), '')
      ) STORED;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'score'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN score NUMERIC GENERATED ALWAYS AS (
        COALESCE(intelligence_score, 0::numeric)
      ) STORED;
  END IF;
END $$;

-- ── 3) gmail_integrations — integration health checks ───────────────────────
ALTER TABLE public.gmail_integrations
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ── 4) integrations — Calendly / connector metadata reads ───────────────────
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 5) calendly_integrations stub (optional health probe) ───────────────────
ALTER TABLE IF EXISTS public.calendly_integrations
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ── 6) Clear stale deal intelligence queue rows for deleted deals ───────────
UPDATE public.business_automation_events AS bae
SET processed = true
WHERE bae.processed = false
  AND bae.event_type = 'deal_intelligence_requested'
  AND NOT EXISTS (
    SELECT 1
    FROM public.deals AS d
    WHERE d.id::text = bae.payload->>'dealId'
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
