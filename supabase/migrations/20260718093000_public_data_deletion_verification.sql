-- Reconcile the public privacy-request schema and require email verification
-- before a public request enters the processing queue.

CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL DEFAULT 'full_deletion',
    status VARCHAR(50) NOT NULL DEFAULT 'verification_pending',
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_deletion_requests
    ALTER COLUMN user_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS requester_email TEXT,
    ADD COLUMN IF NOT EXISTS requester_name TEXT,
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'authenticated',
    ADD COLUMN IF NOT EXISTS confirmation_code TEXT DEFAULT encode(gen_random_bytes(18), 'hex'),
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE public.data_deletion_requests
    DROP CONSTRAINT IF EXISTS data_deletion_requests_status_check;
ALTER TABLE public.data_deletion_requests
    ADD CONSTRAINT data_deletion_requests_status_check CHECK (
        status IN (
            'verification_pending', 'pending', 'under_review', 'approved',
            'processing', 'completed', 'rejected', 'failed'
        )
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_deletion_confirmation_code
    ON public.data_deletion_requests (confirmation_code)
    WHERE confirmation_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_deletion_active_requester
    ON public.data_deletion_requests (lower(requester_email))
    WHERE requester_email IS NOT NULL
      AND status IN ('verification_pending', 'pending', 'under_review', 'approved', 'processing');

