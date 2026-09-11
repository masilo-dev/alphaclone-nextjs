-- =====================================================
-- VIDEO CALLS TENANT ISOLATION & DURATION FIX
-- Purpose: Add tenant isolation and allow 24h permanent rooms
-- =====================================================

-- 1. Add tenant_id to video_calls if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'video_calls' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.video_calls ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    END IF;
END $$;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_video_calls_tenant_id ON public.video_calls(tenant_id);

-- 3. Relax duration limit constraint to 24 hours (1440 mins)
-- First drop the old 40min constraint
ALTER TABLE public.video_calls DROP CONSTRAINT IF EXISTS duration_limit_max;

-- Add new 24h constraint
ALTER TABLE public.video_calls ADD CONSTRAINT duration_limit_max CHECK (duration_limit_minutes <= 1440);

-- 4. Update the auto-end trigger function
-- This ensures the auto-end behavior works with the new larger limits
CREATE OR REPLACE FUNCTION public.set_meeting_auto_end()
RETURNS TRIGGER AS $$
BEGIN
    -- When status changes to 'active' and started_at is set
    IF NEW.status = 'active' AND NEW.started_at IS NOT NULL AND OLD.started_at IS NULL THEN
        -- Default to 40 mins if not specified, but allow up to duration_limit_minutes
        NEW.auto_end_scheduled_at := NEW.started_at + (COALESCE(NEW.duration_limit_minutes, 40) || ' minutes')::INTERVAL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Backfill tenant_id for existing meetings based on host (best effort)
UPDATE public.video_calls vc
SET tenant_id = t.id
FROM public.tenants t
WHERE vc.host_id = t.admin_user_id
AND vc.tenant_id IS NULL;
