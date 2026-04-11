-- Per-user dashboard UI state (widget order, command palette history, etc.)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS dashboard_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.dashboard_preferences IS 'User-scoped UI preferences and ephemeral dashboard state synced across devices.';
