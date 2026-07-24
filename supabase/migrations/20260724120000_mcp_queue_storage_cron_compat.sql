-- Align mcp_event_queue + automation_runs with cron workers.
-- Create private/documents storage buckets + RLS.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- 1) mcp_event_queue worker columns
ALTER TABLE public.mcp_event_queue
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS result jsonb,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mcp_event_queue'
      AND column_name = 'error'
  ) THEN
    UPDATE public.mcp_event_queue
    SET last_error = COALESCE(last_error, error)
    WHERE last_error IS NULL AND error IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mcp_event_queue_status_available
  ON public.mcp_event_queue (status, available_at ASC);

CREATE OR REPLACE FUNCTION public.reclaim_stuck_mcp_queue(p_stale_minutes integer DEFAULT 15)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.mcp_event_queue
  SET status = 'pending',
      locked_at = NULL,
      locked_by = NULL,
      available_at = now(),
      last_error = COALESCE(last_error, 'reclaimed_stuck_processing'),
      updated_at = now()
  WHERE status = 'processing'
    AND (
      locked_at IS NULL
      OR locked_at < now() - make_interval(mins => GREATEST(p_stale_minutes, 1))
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- 2) automation_runs columns used by retry-failed cron
ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS retries integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS workflow_type text,
  ADD COLUMN IF NOT EXISTS steps jsonb DEFAULT '[]'::jsonb;

-- 3) Storage buckets (service role / dashboard also fine)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('private', 'private', false, 52428800),
  ('documents', 'documents', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- 4) Storage RLS for private + documents
DROP POLICY IF EXISTS "private_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "private_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "private_update_own" ON storage.objects;
DROP POLICY IF EXISTS "private_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "documents_update_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete_own" ON storage.objects;

CREATE POLICY "private_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'private');
CREATE POLICY "private_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'private');
CREATE POLICY "private_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'private' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'private');
CREATE POLICY "private_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'private' AND owner = auth.uid());

CREATE POLICY "documents_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');
CREATE POLICY "documents_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');
CREATE POLICY "documents_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'documents');
CREATE POLICY "documents_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND owner = auth.uid());
