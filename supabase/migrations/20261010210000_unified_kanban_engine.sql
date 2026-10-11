-- ==============================================================================
-- UNIFIED KANBAN ENGINE MIGRATION
-- Additive, reversible migration for enterprise Kanban standard
-- Tables: board_transition_logs (append-only), board_policies
-- Additive columns: entered_column_at, blocked metadata, class of service, archival
-- ==============================================================================

-- 1. Create append-only transition log table
CREATE TABLE IF NOT EXISTS public.board_transition_logs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  board_type                  TEXT NOT NULL,
  card_id                     UUID NOT NULL,
  from_state                  TEXT NULL,
  to_state                    TEXT NOT NULL,
  actor_id                    UUID NULL,
  reason                      TEXT NULL,
  duration_in_previous_state_ms BIGINT NULL,
  is_override                 BOOLEAN NOT NULL DEFAULT false,
  override_reason             TEXT NULL,
  metadata                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast tenant + board + card queries and flow metrics calculations
CREATE INDEX IF NOT EXISTS idx_board_transition_logs_lookup
  ON public.board_transition_logs (tenant_id, board_type, card_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_board_transition_logs_created_at
  ON public.board_transition_logs (tenant_id, board_type, created_at);

-- Append-only enforcement trigger
CREATE OR REPLACE FUNCTION public.enforce_board_transition_logs_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'board_transition_logs is strictly append-only. Modifying or deleting log rows is forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_board_transition_logs_append_only ON public.board_transition_logs;
CREATE TRIGGER trg_board_transition_logs_append_only
  BEFORE UPDATE OR DELETE ON public.board_transition_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_board_transition_logs_append_only();

-- 2. Create board policies table (WIP limits, required fields, transitions, permissions)
CREATE TABLE IF NOT EXISTS public.board_policies (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  board_type              TEXT NOT NULL,
  column_id               TEXT NOT NULL,
  wip_limit               INTEGER NULL,
  required_fields         TEXT[] NOT NULL DEFAULT '{}'::text[],
  allowed_transitions     TEXT[] NOT NULL DEFAULT '{}'::text[],
  role_permissions        TEXT[] NOT NULL DEFAULT '{}'::text[],
  aging_threshold_hours   INTEGER NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_board_policies_tenant_board_column UNIQUE (tenant_id, board_type, column_id)
);

CREATE INDEX IF NOT EXISTS idx_board_policies_lookup
  ON public.board_policies (tenant_id, board_type, column_id);

-- 3. Additive columns for Deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS entered_column_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS blocked_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unblock_owner_id UUID,
  ADD COLUMN IF NOT EXISTS class_of_service TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS next_action_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID;

-- 4. Additive columns for Tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS entered_column_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS blocked_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unblock_owner_id UUID,
  ADD COLUMN IF NOT EXISTS class_of_service TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS next_action_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID;

-- 5. Additive columns for Leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS entered_column_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS blocked_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unblock_owner_id UUID,
  ADD COLUMN IF NOT EXISTS class_of_service TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS next_action_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID;

-- 6. Enable RLS and Tenant Isolation
ALTER TABLE public.board_transition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_policies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'board_transition_logs' AND policyname = 'board_transition_logs_tenant_isolation'
  ) THEN
    CREATE POLICY board_transition_logs_tenant_isolation ON public.board_transition_logs
      FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'board_policies' AND policyname = 'board_policies_tenant_isolation'
  ) THEN
    CREATE POLICY board_policies_tenant_isolation ON public.board_policies
      FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
END $$;
