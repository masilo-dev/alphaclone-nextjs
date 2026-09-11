CREATE TABLE IF NOT EXISTS public.workflow_processing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_processing_queue
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

UPDATE public.workflow_processing_queue queue
SET tenant_id = workflow.tenant_id
FROM public.workflows workflow
WHERE queue.workflow_id = workflow.id
  AND queue.tenant_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.workflow_processing_queue
    WHERE tenant_id IS NULL OR workflow_id IS NULL OR event_id IS NULL
  ) THEN
    RAISE EXCEPTION 'workflow_processing_queue contains rows without tenant/workflow/event ownership';
  END IF;
END $$;

ALTER TABLE public.workflow_processing_queue
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN workflow_id SET NOT NULL,
  ALTER COLUMN event_id SET NOT NULL,
  ALTER COLUMN attempts SET NOT NULL,
  ALTER COLUMN next_run_at SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workflow_queue_workflow_event_uidx
  ON public.workflow_processing_queue (workflow_id, event_id);
CREATE INDEX IF NOT EXISTS workflow_queue_pending_idx
  ON public.workflow_processing_queue (next_run_at, created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS workflow_queue_tenant_idx
  ON public.workflow_processing_queue (tenant_id, created_at DESC);

ALTER TABLE public.workflow_processing_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage workflow queue" ON public.workflow_processing_queue;
DROP POLICY IF EXISTS "Tenant members view workflow queue" ON public.workflow_processing_queue;
CREATE POLICY "Tenant members view workflow queue" ON public.workflow_processing_queue
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_users member
    WHERE member.tenant_id = workflow_processing_queue.tenant_id
      AND member.user_id = (SELECT auth.uid())
  ));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_processing_queue;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
