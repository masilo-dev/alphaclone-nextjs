-- Create scraping_jobs table
CREATE TABLE IF NOT EXISTS public.scraping_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  leads_found INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_tenant_id ON public.scraping_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON public.scraping_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_started_at ON public.scraping_jobs(started_at);

-- Enable RLS
ALTER TABLE public.scraping_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for scraping jobs access
CREATE POLICY "Users can view their own tenant scraping jobs" ON public.scraping_jobs
  FOR SELECT USING (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Users can insert scraping jobs for their tenant" ON public.scraping_jobs
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Users can update scraping jobs for their tenant" ON public.scraping_jobs
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_scraping_jobs_updated_at
  BEFORE UPDATE ON public.scraping_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
