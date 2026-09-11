-- Projects V2 client approvals.
-- Additive only: reuses canonical projects/tasks/milestones/deliverables/documents.

CREATE TABLE IF NOT EXISTS public.project_client_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  approval_type text NOT NULL CHECK (approval_type IN ('design','document','proposal','deliverable','milestone','custom')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','viewed','approved','changes_requested','expired')),
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  deliverable_id uuid REFERENCES public.project_deliverables(id) ON DELETE SET NULL,
  document_id uuid,
  requested_from_name text,
  requested_from_email text,
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  decided_at timestamptz,
  expires_at timestamptz,
  version_label text,
  public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, public_token)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_client_approvals_idempotency
  ON public.project_client_approvals (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_client_approvals_project_status
  ON public.project_client_approvals (tenant_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_client_approvals_expires
  ON public.project_client_approvals (tenant_id, expires_at)
  WHERE status IN ('pending','viewed');

CREATE TABLE IF NOT EXISTS public.project_client_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  approval_id uuid NOT NULL REFERENCES public.project_client_approvals(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('requested','viewed','approved','changes_requested','commented','expired')),
  actor_type text NOT NULL DEFAULT 'system',
  actor_user_id uuid,
  actor_name text,
  actor_email text,
  comment text,
  approved_version text,
  ip_address inet,
  session_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_client_approval_history_approval
  ON public.project_client_approval_history (tenant_id, approval_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_client_approval_history_project
  ON public.project_client_approval_history (tenant_id, project_id, created_at DESC);

ALTER TABLE public.project_client_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_client_approval_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_client_approvals_tenant_access ON public.project_client_approvals;
CREATE POLICY project_client_approvals_tenant_access ON public.project_client_approvals FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS project_client_approval_history_tenant_select ON public.project_client_approval_history;
CREATE POLICY project_client_approval_history_tenant_select ON public.project_client_approval_history FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS project_client_approval_history_tenant_insert ON public.project_client_approval_history;
CREATE POLICY project_client_approval_history_tenant_insert ON public.project_client_approval_history FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.project_client_approval_history_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'project_client_approval_history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_project_client_approval_history_immutable ON public.project_client_approval_history;
CREATE TRIGGER trg_project_client_approval_history_immutable
  BEFORE UPDATE OR DELETE ON public.project_client_approval_history
  FOR EACH ROW EXECUTE FUNCTION public.project_client_approval_history_append_only();

CREATE OR REPLACE FUNCTION public.project_client_approval_history_from_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  mapped_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.project_client_approval_history (
      tenant_id, approval_id, project_id, action, actor_type, actor_user_id,
      actor_name, actor_email, approved_version, correlation_id, evidence
    ) VALUES (
      NEW.tenant_id, NEW.id, NEW.project_id, 'requested', 'system', NEW.requested_by,
      NEW.requested_from_name, NEW.requested_from_email, NEW.version_label, NEW.correlation_id,
      jsonb_build_object('approval_type', NEW.approval_type, 'status', NEW.status)
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    mapped_action := CASE NEW.status
      WHEN 'viewed' THEN 'viewed'
      WHEN 'approved' THEN 'approved'
      WHEN 'changes_requested' THEN 'changes_requested'
      WHEN 'expired' THEN 'expired'
      ELSE NULL
    END;
    IF mapped_action IS NOT NULL THEN
      INSERT INTO public.project_client_approval_history (
        tenant_id, approval_id, project_id, action, actor_type, approved_version,
        correlation_id, evidence
      ) VALUES (
        NEW.tenant_id, NEW.id, NEW.project_id, mapped_action, 'system', NEW.version_label,
        NEW.correlation_id, jsonb_build_object('previous_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_client_approval_history_status ON public.project_client_approvals;
CREATE TRIGGER trg_project_client_approval_history_status
  AFTER INSERT OR UPDATE OF status ON public.project_client_approvals
  FOR EACH ROW EXECUTE FUNCTION public.project_client_approval_history_from_status();
