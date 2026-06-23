-- Alphaclone production fix (run once in Supabase SQL Editor)
-- Fixes: user_presence CORS/RPC, bonnie_logs 404, tickets tenant queries

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Bonnie activity logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bonnie_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    run_id UUID NULL,
    level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'success', 'error')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bonnie_logs_tenant_created_at
    ON public.bonnie_logs (tenant_id, created_at DESC);

ALTER TABLE public.bonnie_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read bonnie logs" ON public.bonnie_logs;
CREATE POLICY "Tenant users can read bonnie logs"
    ON public.bonnie_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = bonnie_logs.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant users can insert bonnie logs" ON public.bonnie_logs;
CREATE POLICY "Tenant users can insert bonnie logs"
    ON public.bonnie_logs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = bonnie_logs.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- 2. User presence (fixes update_user_presence RPC / CORS errors)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_info JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_presence_status_last_seen
    ON public.user_presence (status, last_seen DESC);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read user presence" ON public.user_presence;
CREATE POLICY "Anyone can read user presence"
    ON public.user_presence
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users manage own presence" ON public.user_presence;
CREATE POLICY "Users manage own presence"
    ON public.user_presence
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_user_presence(
    p_user_id UUID,
    p_status TEXT,
    p_device_info JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Not authorized to update this presence record';
    END IF;

    INSERT INTO public.user_presence (user_id, status, last_seen, device_info, updated_at)
    VALUES (p_user_id, COALESCE(p_status, 'online'), NOW(), p_device_info, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        status = EXCLUDED.status,
        last_seen = NOW(),
        device_info = COALESCE(EXCLUDED.device_info, public.user_presence.device_info),
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_online_users(p_exclude_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    user_id UUID,
    status TEXT,
    last_seen TIMESTAMPTZ,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    role TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        up.user_id,
        up.status,
        up.last_seen,
        NULL::TEXT AS name,
        NULL::TEXT AS email,
        NULL::TEXT AS avatar_url,
        NULL::TEXT AS role
    FROM public.user_presence up
    WHERE up.status IN ('online', 'away', 'busy')
      AND up.last_seen >= NOW() - INTERVAL '10 minutes'
      AND (p_exclude_user_id IS NULL OR up.user_id <> p_exclude_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.update_user_presence(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_online_users(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tickets (fixes tenant_id=default queries when table/policies missing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'reopened')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    source TEXT NOT NULL CHECK (source IN ('lead', 'client', 'project', 'invoice', 'contract', 'general')),
    source_id TEXT,
    source_name TEXT,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_internal BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON public.tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_source ON public.tickets(source, source_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view tickets in their tenant" ON public.tickets;
CREATE POLICY "Users can view tickets in their tenant"
    ON public.tickets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = tickets.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create tickets in their tenant" ON public.tickets;
CREATE POLICY "Users can create tickets in their tenant"
    ON public.tickets FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = tickets.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update tickets in their tenant" ON public.tickets;
CREATE POLICY "Users can update tickets in their tenant"
    ON public.tickets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = tickets.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can view comments on tickets in their tenant" ON public.ticket_comments;
CREATE POLICY "Users can view comments on tickets in their tenant"
    ON public.ticket_comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tickets t
            JOIN public.tenant_users tu ON tu.tenant_id = t.tenant_id
            WHERE t.id = ticket_comments.ticket_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create comments on tickets in their tenant" ON public.ticket_comments;
CREATE POLICY "Users can create comments on tickets in their tenant"
    ON public.ticket_comments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tickets t
            JOIN public.tenant_users tu ON tu.tenant_id = t.tenant_id
            WHERE t.id = ticket_comments.ticket_id
              AND tu.user_id = auth.uid()
        )
    );

CREATE OR REPLACE FUNCTION public.update_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_tickets_updated_at ON public.tickets;
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_ticket_updated_at();

COMMIT;
