CREATE TABLE IF NOT EXISTS public.scheduled_ai_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  prompt text NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 20000),
  schedule text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  notification_preference jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scheduled_ai_task_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.scheduled_ai_tasks(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  output text,
  status text NOT NULL CHECK (status IN ('success', 'failure')),
  error text,
  ran_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_ai_tasks_due_idx ON public.scheduled_ai_tasks(status, next_run_at);
CREATE INDEX IF NOT EXISTS scheduled_ai_tasks_tenant_idx ON public.scheduled_ai_tasks(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scheduled_ai_task_results_task_idx ON public.scheduled_ai_task_results(task_id, ran_at DESC);

ALTER TABLE public.scheduled_ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_ai_task_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scheduled_ai_tasks, public.scheduled_ai_task_results FROM anon, authenticated;
GRANT ALL ON public.scheduled_ai_tasks, public.scheduled_ai_task_results TO service_role;

CREATE OR REPLACE FUNCTION public.claim_due_scheduled_ai_tasks(p_limit integer DEFAULT 20)
RETURNS SETOF public.scheduled_ai_tasks
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH due AS (
    SELECT id
    FROM public.scheduled_ai_tasks
    WHERE status = 'active' AND next_run_at <= now()
    ORDER BY next_run_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  ), claimed AS (
    UPDATE public.scheduled_ai_tasks AS task
    SET next_run_at = now() + interval '15 minutes', updated_at = now()
    FROM due
    WHERE task.id = due.id
    RETURNING task.*
  )
  SELECT * FROM claimed;
$$;

REVOKE ALL ON FUNCTION public.claim_due_scheduled_ai_tasks(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_scheduled_ai_tasks(integer) TO service_role;
