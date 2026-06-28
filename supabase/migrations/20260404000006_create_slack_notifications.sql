-- Create slack_notifications table
CREATE TABLE IF NOT EXISTS public.slack_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  channel TEXT DEFAULT '#general',
  slack_message_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'resent')),
  type TEXT DEFAULT 'custom' CHECK (type IN ('project_created', 'client_added', 'task_completed', 'invoice_sent', 'deal_won', 'custom')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  resent_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_slack_notifications_tenant_id ON public.slack_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_status ON public.slack_notifications(status);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_created_at ON public.slack_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_type ON public.slack_notifications(type);

-- Enable RLS
ALTER TABLE public.slack_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for slack notifications access
DROP POLICY IF EXISTS "Users can view their own tenant slack notifications" ON public.slack_notifications;
CREATE POLICY "Users can view their own tenant slack notifications" ON public.slack_notifications
  FOR SELECT USING (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

DROP POLICY IF EXISTS "Users can insert slack notifications for their tenant" ON public.slack_notifications;
CREATE POLICY "Users can insert slack notifications for their tenant" ON public.slack_notifications
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

DROP POLICY IF EXISTS "Users can update slack notifications for their tenant" ON public.slack_notifications;
CREATE POLICY "Users can update slack notifications for their tenant" ON public.slack_notifications
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_slack_notifications_updated_at ON public.slack_notifications;
CREATE TRIGGER update_slack_notifications_updated_at
  BEFORE UPDATE ON public.slack_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
