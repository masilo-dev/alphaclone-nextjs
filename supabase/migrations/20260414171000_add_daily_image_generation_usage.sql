CREATE TABLE IF NOT EXISTS public.daily_image_generation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT ((timezone('utc', now()))::date),
  generated_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_image_generation_usage_unique_user_day UNIQUE (user_id, usage_date),
  CONSTRAINT daily_image_generation_usage_count_non_negative CHECK (generated_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_daily_image_generation_usage_user_date
  ON public.daily_image_generation_usage(user_id, usage_date);

ALTER TABLE public.daily_image_generation_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_image_generation_usage_select_own ON public.daily_image_generation_usage;
CREATE POLICY daily_image_generation_usage_select_own
  ON public.daily_image_generation_usage
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_image_generation_usage_insert_own ON public.daily_image_generation_usage;
CREATE POLICY daily_image_generation_usage_insert_own
  ON public.daily_image_generation_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_image_generation_usage_update_own ON public.daily_image_generation_usage;
CREATE POLICY daily_image_generation_usage_update_own
  ON public.daily_image_generation_usage
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
