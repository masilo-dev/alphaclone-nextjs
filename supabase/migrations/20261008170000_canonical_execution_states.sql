-- ============================================================================
-- Migration: Canonical Execution States & Notification Synchronization
-- Expands external_actions status check to allow canonical 6-state machine
-- states and adds correlation indexes for single logical notification mutation.
-- ============================================================================

-- 1. Expand external_actions status constraint
ALTER TABLE IF EXISTS public.external_actions
  DROP CONSTRAINT IF EXISTS external_actions_status_check;

ALTER TABLE IF EXISTS public.external_actions
  ADD CONSTRAINT external_actions_status_check CHECK (status IN (
    -- Canonical 6 states
    'queued', 'executing', 'pending_verification', 'succeeded', 'failed', 'cancelled',
    -- Legacy compatibility states
    'pending', 'awaiting_approval', 'running', 'provider_accepted',
    'verification_pending', 'outcome_unknown', 'unknown_execution_state',
    'completed', 'partially_completed'
  )) NOT VALID;

ALTER TABLE IF EXISTS public.external_actions
  VALIDATE CONSTRAINT external_actions_status_check;

-- 2. Index on external_actions for status and created_at for fast background reconciliation
CREATE INDEX IF NOT EXISTS idx_external_actions_status_created
  ON public.external_actions (status, created_at DESC);

-- 3. Index on notifications for tenant and correlation_id to enable instant in-place notification mutation
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_correlation
  ON public.notifications (tenant_id, correlation_id)
  WHERE correlation_id IS NOT NULL;
