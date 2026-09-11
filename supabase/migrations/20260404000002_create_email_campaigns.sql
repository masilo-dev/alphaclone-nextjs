-- Create email_campaigns table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT,
  html_content TEXT,
  template_id UUID,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  list_type TEXT DEFAULT 'manual' CHECK (list_type IN ('manual', 'all_clients', 'all_leads', 'segment')),
  segment_criteria JSONB,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_campaigns_tenant_id ON public.email_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_user_id ON public.email_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_at ON public.email_campaigns(created_at);

-- Enable RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

-- Create policies for email campaign access
DROP POLICY IF EXISTS "Users can view their own tenant campaigns" ON public.email_campaigns;
CREATE POLICY "Users can view their own tenant campaigns" ON public.email_campaigns
  FOR SELECT USING (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

DROP POLICY IF EXISTS "Users can insert campaigns for their tenant" ON public.email_campaigns;
CREATE POLICY "Users can insert campaigns for their tenant" ON public.email_campaigns
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

DROP POLICY IF EXISTS "Users can update campaigns for their tenant" ON public.email_campaigns;
CREATE POLICY "Users can update campaigns for their tenant" ON public.email_campaigns
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

DROP POLICY IF EXISTS "Users can delete campaigns for their tenant" ON public.email_campaigns;
CREATE POLICY "Users can delete campaigns for their tenant" ON public.email_campaigns
  FOR DELETE USING (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_email_campaigns_updated_at ON public.email_campaigns;
CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
