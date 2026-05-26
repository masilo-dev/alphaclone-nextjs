-- ============================================================================
-- AlphaClone MCP Unified Power Upgrade Migration
-- Timestamp: 20260524181600_mcp_power_upgrade.sql
-- ============================================================================

-- ── 1. ALTER mcp_sessions FOR TOOL METRICS LOGGING ─────────────────────────
ALTER TABLE public.mcp_sessions ADD COLUMN IF NOT EXISTS tool_name TEXT NULL;
ALTER TABLE public.mcp_sessions ADD COLUMN IF NOT EXISTS duration_ms INTEGER NULL;
ALTER TABLE public.mcp_sessions ADD COLUMN IF NOT EXISTS success BOOLEAN NULL;
ALTER TABLE public.mcp_sessions ADD COLUMN IF NOT EXISTS error_message TEXT NULL;

-- ── 2. CREATE CRM TABLES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT NULL,
  company     TEXT NULL,
  status      TEXT NOT NULL DEFAULT 'lead',
  deleted_at  TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL, -- call/email/meeting/note
  notes       TEXT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. CREATE OUTREACH TABLES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_sequences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_sequence_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  delay_days  INTEGER NOT NULL DEFAULT 1,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_sequence_enrollments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  sequence_id  UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_step INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active' -- active, paused, completed, unsubscribed
);

CREATE TABLE IF NOT EXISTS public.email_batch_jobs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  anthropic_batch_id TEXT NOT NULL,
  template           TEXT NOT NULL,
  contact_ids        JSONB NOT NULL DEFAULT '[]'::jsonb,
  status             TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. CREATE WORKSPACE FILES TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_files (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id            UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  anthropic_file_id  TEXT NOT NULL,
  filename           TEXT NOT NULL,
  mime_type          TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. CREATE DEAL PIPELINE AUDIT TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_stage_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_stage  TEXT NULL,
  to_stage    TEXT NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by  UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ── 6. CREATE SOCIAL PUBLISHING & ANALYTICS TABLES ─────────────────────────
CREATE TABLE IF NOT EXISTS public.social_post_analytics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks      INTEGER NOT NULL DEFAULT 0,
  reactions   INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  platform     TEXT NOT NULL, -- linkedin, x, facebook
  content      TEXT NOT NULL,
  asset_id     TEXT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.facebook_tokens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id             TEXT NOT NULL,
  page_name           TEXT NULL,
  page_access_token   TEXT NOT NULL,
  token_expires_at    TIMESTAMPTZ NULL,
  scopes              TEXT[] NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sku         TEXT NULL,
  stock       INTEGER NOT NULL DEFAULT 0,
  price       NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gamification_profiles (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  xp          INTEGER NOT NULL DEFAULT 0,
  streak      INTEGER NOT NULL DEFAULT 0,
  badges      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gamification_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  points      INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 8. ENABLE ROW LEVEL SECURITY ───────────────────────────────────────────
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_logs ENABLE ROW LEVEL SECURITY;

-- ── 9. CREATE ROW LEVEL SECURITY POLICIES ───────────────────────────────────

-- Helper macro-like logic inside an anonymous block to cleanly setup policies
DO $$
BEGIN
  -- crm_contacts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'crm_contacts' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.crm_contacts
      FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);
  END IF;

  -- crm_activities
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'crm_activities' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.crm_activities
      FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);
  END IF;

  -- email_sequences
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_sequences' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.email_sequences
      FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);
  END IF;

  -- email_sequence_steps (inherits read through email_sequences)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_sequence_steps' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.email_sequence_steps
      FOR ALL USING (
        sequence_id IN (
          SELECT id FROM public.email_sequences
          WHERE tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid
        )
      );
  END IF;

  -- email_sequence_enrollments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_sequence_enrollments' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.email_sequence_enrollments
      FOR ALL USING (
        contact_id IN (
          SELECT id FROM public.crm_contacts
          WHERE tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid
        )
      );
  END IF;

  -- email_batch_jobs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_batch_jobs' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.email_batch_jobs
      FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);
  END IF;

  -- workspace_files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workspace_files' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.workspace_files
      FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);
  END IF;

  -- deal_stage_history
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'deal_stage_history' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.deal_stage_history
      FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);
  END IF;

  -- social_post_analytics
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'social_post_analytics' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.social_post_analytics
      FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);
  END IF;

  -- scheduled_posts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'scheduled_posts' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.scheduled_posts
      FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);
  END IF;

  -- facebook_tokens
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'facebook_tokens' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.facebook_tokens
      FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);
  END IF;

  -- inventory_items
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inventory_items' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.inventory_items
      FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);
  END IF;

  -- gamification_profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gamification_profiles' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.gamification_profiles
      FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);
  END IF;

  -- gamification_logs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gamification_logs' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON public.gamification_logs
      FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);
  END IF;

END $$;
