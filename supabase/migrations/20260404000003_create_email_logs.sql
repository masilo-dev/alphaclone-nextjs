-- Create email_logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('sendgrid', 'resend')),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  email_id TEXT, -- Provider-specific email ID
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_logs_tenant_id ON public.email_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_provider ON public.email_logs(provider);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for email logs access
CREATE POLICY "Users can view their own tenant email logs" ON public.email_logs
  FOR SELECT USING (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Users can insert email logs for their tenant" ON public.email_logs
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
