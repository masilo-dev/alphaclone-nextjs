-- Create automation_tasks table
CREATE TABLE IF NOT EXISTS public.automation_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    schedule JSONB NOT NULL,
    target JSONB,
    ai_enabled BOOLEAN DEFAULT true,
    ai_prompt TEXT,
    status TEXT DEFAULT 'paused',
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    results JSONB DEFAULT '{"total": 0, "successful": 0, "failed": 0}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_tasks ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
-- Using a simpler policy linked to the profiles/tenants structure typical in this repo
CREATE POLICY "Users can view tasks for their tenant" 
    ON public.automation_tasks FOR SELECT 
    USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert tasks for their tenant" 
    ON public.automation_tasks FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update tasks for their tenant" 
    ON public.automation_tasks FOR UPDATE 
    USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete tasks for their tenant" 
    ON public.automation_tasks FOR DELETE 
    USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Create trigger for updated_at if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_automation_tasks_updated_at') THEN
        CREATE TRIGGER set_automation_tasks_updated_at
            BEFORE UPDATE ON public.automation_tasks
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;
