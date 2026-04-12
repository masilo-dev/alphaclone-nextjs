-- OAuth callback upserts use onConflict: 'user_id,page_id'. Postgres requires a unique
-- constraint or index on those columns; without it, saves fail and the UI stays on "Connect".

CREATE UNIQUE INDEX IF NOT EXISTS facebook_integrations_user_id_page_id_key
  ON public.facebook_integrations (user_id, page_id);
