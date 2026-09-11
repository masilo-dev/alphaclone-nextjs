-- Migration: Make push subscriptions compatible with both stored shapes
-- Created: 2026-05-21

ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS endpoint TEXT,
    ADD COLUMN IF NOT EXISTS keys JSONB,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.push_subscriptions
SET
    endpoint = COALESCE(endpoint, subscription->>'endpoint'),
    keys = COALESCE(keys, subscription->'keys')
WHERE subscription IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
    ON public.push_subscriptions(endpoint)
    WHERE endpoint IS NOT NULL;
