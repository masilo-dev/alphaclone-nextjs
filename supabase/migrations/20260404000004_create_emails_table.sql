-- Create emails table for email campaigns and communications
CREATE TABLE IF NOT EXISTS public.emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT,
  html_content TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'failed', 'bounced', 'opened', 'clicked')),
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  template_id UUID,
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  bounce_reason TEXT,
  tracking_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_emails_tenant_id ON public.emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON public.emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON public.emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_campaign_id ON public.emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON public.emails(created_at);
CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON public.emails(sent_at);

-- Enable RLS
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Create policies for email access
CREATE POLICY "Users can view their own tenant emails" ON public.emails
  FOR SELECT USING (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Users can insert emails for their tenant" ON public.emails
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Users can update emails for their tenant" ON public.emails
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Users can delete emails for their tenant" ON public.emails
  FOR DELETE USING (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_emails_updated_at
  BEFORE UPDATE ON public.emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
