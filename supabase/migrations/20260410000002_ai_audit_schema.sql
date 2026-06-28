-- Migration: Wave 3 Observability
-- Ensures audit_logs table exists and has necessary context for AI Agent actions.

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
        CREATE TABLE public.audit_logs (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id uuid REFERENCES auth.users(id),
            action text NOT NULL,
            entity_type text NOT NULL,
            entity_id text,
            old_value jsonb,
            new_value jsonb,
            ip_address text,
            user_agent text,
            city text,
            country text,
            created_at timestamptz DEFAULT now()
        );

        -- Add indexes for common queries
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
        
        -- Enable RLS
        ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

        -- Admin/Service Role Policy
DROP POLICY IF EXISTS "Service role can do everything" ON public.audit_logs;
        CREATE POLICY "Service role can do everything" ON public.audit_logs
            FOR ALL USING (auth.role() = 'service_role');
            
        -- User visibility policy (can see their own logs)
DROP POLICY IF EXISTS "Users can see their own audit logs" ON public.audit_logs;
        CREATE POLICY "Users can see their own audit logs" ON public.audit_logs
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- Ensure RLS is enabled for modern audits
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail for all sensitive system and AI agent actions.';
