-- Optional deadlines must remain null instead of inventing dates.
ALTER TABLE public.projects ALTER COLUMN due_date DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS projects_creation_idempotency_unique ON public.projects (tenant_id, (metadata->>'creation_idempotency_key')) WHERE metadata->>'creation_idempotency_key' IS NOT NULL;
