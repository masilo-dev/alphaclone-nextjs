-- ============================================================
-- AlphaClone Outbound Engine — Additive Schema Migration
-- Created: 2026-09-23
-- Safe: adds new tables only, no destructive changes
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. ICP (Ideal Customer Profile) Definitions
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outbound_icps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  name           text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 200),
  description    text,
  is_default     boolean NOT NULL DEFAULT false,

  -- Target company criteria
  industries        text[]    DEFAULT '{}',
  locations         text[]    DEFAULT '{}',
  company_size_min  int,
  company_size_max  int,
  revenue_min       numeric,
  revenue_max       numeric,
  business_types    text[]    DEFAULT '{}',

  -- Target contact criteria
  job_titles        text[]    DEFAULT '{}',
  seniority_levels  text[]    DEFAULT '{}',

  -- Signal criteria
  technology_signals  text[]  DEFAULT '{}',
  website_required    boolean DEFAULT false,
  social_required     boolean DEFAULT false,

  -- Pain point tags
  pain_points       text[]    DEFAULT '{}',

  -- Exclusion criteria
  excluded_industries   text[]  DEFAULT '{}',
  excluded_keywords     text[]  DEFAULT '{}',
  excluded_domains      text[]  DEFAULT '{}',

  -- Custom rules (JSON for extensibility)
  custom_criteria   jsonb     DEFAULT '{}',

  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE INDEX IF NOT EXISTS outbound_icps_tenant_idx ON outbound_icps (tenant_id);
CREATE INDEX IF NOT EXISTS outbound_icps_tenant_default_idx ON outbound_icps (tenant_id, is_default) WHERE is_default = true;

-- RLS
ALTER TABLE outbound_icps ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'outbound_icps' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON outbound_icps
      USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 2. Lead Qualification Results
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outbound_lead_qualifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  lead_id               uuid,
  contact_id            uuid,
  icp_id                uuid REFERENCES outbound_icps(id) ON DELETE SET NULL,

  -- Qualification output
  qualification_score   int     NOT NULL DEFAULT 0 CHECK (qualification_score BETWEEN 0 AND 100),
  qualification_status  text    NOT NULL DEFAULT 'unqualified'
                          CHECK (qualification_status IN ('qualified','unqualified','review_required','disqualified')),
  matched_criteria      text[]  DEFAULT '{}',
  failed_criteria       text[]  DEFAULT '{}',
  confidence            text    NOT NULL DEFAULT 'low'
                          CHECK (confidence IN ('high','medium','low')),

  -- AI output
  reasoning_summary     text,
  recommended_campaign  text,
  data_quality          jsonb DEFAULT '{}',   -- per-field: confirmed | inferred | unknown

  -- Human override
  overridden_by         uuid,
  override_reason       text,
  overridden_at         timestamptz,

  -- Source
  qualification_method  text NOT NULL DEFAULT 'ai'
                          CHECK (qualification_method IN ('ai','manual','rule')),
  model_version         text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obl_qual_tenant_idx    ON outbound_lead_qualifications (tenant_id);
CREATE INDEX IF NOT EXISTS obl_qual_lead_idx      ON outbound_lead_qualifications (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS obl_qual_contact_idx   ON outbound_lead_qualifications (contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS obl_qual_status_idx    ON outbound_lead_qualifications (tenant_id, qualification_status);
CREATE INDEX IF NOT EXISTS obl_qual_score_idx     ON outbound_lead_qualifications (tenant_id, qualification_score DESC);

ALTER TABLE outbound_lead_qualifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'outbound_lead_qualifications' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON outbound_lead_qualifications
      USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 3. Email Verification Records
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outbound_email_verifications (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL,
  email                   text NOT NULL,
  normalized_email        text NOT NULL,

  -- Verification result
  verification_status     text NOT NULL DEFAULT 'unknown'
                            CHECK (verification_status IN ('valid','invalid','risky','catch_all','unknown')),
  verification_provider   text,                      -- e.g. 'dns_mx', 'manual', 'zerobounce', 'neverbounce'
  verified_at             timestamptz,
  expires_at              timestamptz,               -- re-verify after this

  -- DNS checks (can be run without external provider)
  mx_check                boolean,                   -- MX records exist
  smtp_check              boolean,                   -- SMTP handshake
  disposable_check        boolean,                   -- known disposable domain
  role_based_check        boolean,                   -- postmaster@, admin@, etc.

  -- Provider raw response
  verification_metadata   jsonb DEFAULT '{}',

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_outbound_email_verif UNIQUE (tenant_id, normalized_email)
);

CREATE INDEX IF NOT EXISTS obe_verif_tenant_idx  ON outbound_email_verifications (tenant_id);
CREATE INDEX IF NOT EXISTS obe_verif_email_idx   ON outbound_email_verifications (tenant_id, normalized_email);
CREATE INDEX IF NOT EXISTS obe_verif_status_idx  ON outbound_email_verifications (tenant_id, verification_status);

ALTER TABLE outbound_email_verifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'outbound_email_verifications' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON outbound_email_verifications
      USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 4. Outbound Mailboxes
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outbound_mailboxes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  name                  text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),

  -- Provider
  provider              text NOT NULL
                          CHECK (provider IN ('microsoft','zoho','brevo','resend','sendgrid','smtp','other')),
  email_address         text NOT NULL,
  from_name             text,
  reply_to              text,
  domain                text,

  -- Connection
  is_primary_domain     boolean NOT NULL DEFAULT false,  -- warn if used for cold outreach
  connection_state      text NOT NULL DEFAULT 'unchecked'
                          CHECK (connection_state IN ('connected','disconnected','error','unchecked')),
  sending_enabled       boolean NOT NULL DEFAULT true,
  last_connection_check timestamptz,
  last_connection_error text,

  -- Sending limits (tenant-configurable, not hardcoded)
  daily_limit           int NOT NULL DEFAULT 100,
  hourly_limit          int,
  messages_sent_today   int NOT NULL DEFAULT 0,
  sent_today_reset_at   date,

  -- Health metrics
  bounce_count_7d       int NOT NULL DEFAULT 0,
  complaint_count_7d    int NOT NULL DEFAULT 0,
  last_successful_send  timestamptz,
  last_error            text,
  last_error_at         timestamptz,

  -- DNS health (cached result)
  spf_status            text DEFAULT 'unknown' CHECK (spf_status IN ('healthy','warning','critical','unknown')),
  dkim_status           text DEFAULT 'unknown' CHECK (dkim_status IN ('healthy','warning','critical','unknown')),
  dmarc_status          text DEFAULT 'unknown' CHECK (dmarc_status IN ('healthy','warning','critical','unknown')),
  mx_status             text DEFAULT 'unknown' CHECK (mx_status IN ('healthy','warning','critical','unknown')),
  dns_checked_at        timestamptz,
  dns_remediation       jsonb DEFAULT '{}',   -- per-check remediation hints

  -- Metadata
  created_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,

  CONSTRAINT uq_outbound_mailbox UNIQUE (tenant_id, email_address)
);

CREATE INDEX IF NOT EXISTS obm_tenant_idx     ON outbound_mailboxes (tenant_id);
CREATE INDEX IF NOT EXISTS obm_provider_idx   ON outbound_mailboxes (tenant_id, provider);
CREATE INDEX IF NOT EXISTS obm_status_idx     ON outbound_mailboxes (tenant_id, connection_state);

ALTER TABLE outbound_mailboxes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'outbound_mailboxes' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON outbound_mailboxes
      USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 5. Prospect Research Records
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outbound_prospect_research (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  lead_id           uuid,
  contact_id        uuid,
  company_id        uuid,
  domain            text,

  -- Research output
  company_description   text,
  services_summary      text,
  website_status        text CHECK (website_status IN ('active','parked','offline','unknown')),
  public_email          text,
  public_phone          text,
  social_links          jsonb DEFAULT '{}',
  business_category     text,
  employee_count_est    text,
  founded_year          int,

  -- Signals found
  signals               jsonb DEFAULT '[]',   -- [{type, source, detected_at, confidence, metadata}]

  -- Data quality
  source_urls           text[]  DEFAULT '{}',
  research_method       text    DEFAULT 'automated',
  researched_at         timestamptz NOT NULL DEFAULT now(),
  data_quality          jsonb DEFAULT '{}',   -- per-field: confirmed | inferred | unknown

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obpr_tenant_idx  ON outbound_prospect_research (tenant_id);
CREATE INDEX IF NOT EXISTS obpr_lead_idx    ON outbound_prospect_research (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS obpr_domain_idx  ON outbound_prospect_research (tenant_id, domain) WHERE domain IS NOT NULL;

ALTER TABLE outbound_prospect_research ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'outbound_prospect_research' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON outbound_prospect_research
      USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 6. Outbound Signals
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outbound_signals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  lead_id         uuid,
  contact_id      uuid,
  company_id      uuid,

  signal_type     text NOT NULL,   -- website_change, job_posting, social_activity, crm_event, campaign_interaction
  source          text,
  confidence      text DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  detected_at     timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb DEFAULT '{}',
  is_actionable   boolean NOT NULL DEFAULT true,

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obs_tenant_idx       ON outbound_signals (tenant_id);
CREATE INDEX IF NOT EXISTS obs_lead_idx         ON outbound_signals (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS obs_type_idx         ON outbound_signals (tenant_id, signal_type);
CREATE INDEX IF NOT EXISTS obs_detected_idx     ON outbound_signals (tenant_id, detected_at DESC);

ALTER TABLE outbound_signals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'outbound_signals' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON outbound_signals
      USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 7. Audit trail for outbound actions
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outbound_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  actor_id      uuid,
  action        text NOT NULL,   -- campaign_created, campaign_activated, lead_qualified, email_sent, reply_classified, etc.
  entity_type   text,
  entity_id     uuid,
  metadata      jsonb DEFAULT '{}',
  occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obal_tenant_idx    ON outbound_audit_log (tenant_id);
CREATE INDEX IF NOT EXISTS obal_entity_idx    ON outbound_audit_log (tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS obal_occurred_idx  ON outbound_audit_log (tenant_id, occurred_at DESC);

ALTER TABLE outbound_audit_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'outbound_audit_log' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON outbound_audit_log
      USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- Triggers: updated_at auto-maintenance
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'outbound_icps',
    'outbound_lead_qualifications',
    'outbound_email_verifications',
    'outbound_mailboxes',
    'outbound_prospect_research'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_' || tbl
    ) THEN
      EXECUTE format('
        CREATE TRIGGER set_updated_at_%I
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      ', tbl, tbl);
    END IF;
  END LOOP;
END $$;
