-- Create marketing campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'multi_channel')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
    channels TEXT[] NOT NULL DEFAULT '{email}',
    target_audience TEXT,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create campaign messages table
CREATE TABLE IF NOT EXISTS campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
    subject TEXT,
    content TEXT NOT NULL,
    template_id TEXT,
    variables JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create campaign recipients table
CREATE TABLE IF NOT EXISTS campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_tenant_id ON marketing_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign_id ON campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status);

-- Enable Row Level Security
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for marketing_campaigns
DROP POLICY IF EXISTS "Users can view campaigns in their tenant" ON marketing_campaigns;
CREATE POLICY "Users can view campaigns in their tenant"
    ON marketing_campaigns FOR SELECT
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Users can create campaigns in their tenant" ON marketing_campaigns;
CREATE POLICY "Users can create campaigns in their tenant"
    ON marketing_campaigns FOR INSERT
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Users can update campaigns in their tenant" ON marketing_campaigns;
CREATE POLICY "Users can update campaigns in their tenant"
    ON marketing_campaigns FOR UPDATE
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Users can delete campaigns in their tenant" ON marketing_campaigns;
CREATE POLICY "Users can delete campaigns in their tenant"
    ON marketing_campaigns FOR DELETE
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Create RLS policies for campaign_messages
DROP POLICY IF EXISTS "Users can view campaign messages in their tenant" ON campaign_messages;
CREATE POLICY "Users can view campaign messages in their tenant"
    ON campaign_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM marketing_campaigns
            WHERE marketing_campaigns.id = campaign_messages.campaign_id
            AND marketing_campaigns.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        )
    );

DROP POLICY IF EXISTS "Users can create campaign messages in their tenant" ON campaign_messages;
CREATE POLICY "Users can create campaign messages in their tenant"
    ON campaign_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM marketing_campaigns
            WHERE marketing_campaigns.id = campaign_id
            AND marketing_campaigns.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        )
    );

-- Create RLS policies for campaign_recipients
DROP POLICY IF EXISTS "Users can view campaign recipients in their tenant" ON campaign_recipients;
CREATE POLICY "Users can view campaign recipients in their tenant"
    ON campaign_recipients FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM marketing_campaigns
            WHERE marketing_campaigns.id = campaign_recipients.campaign_id
            AND marketing_campaigns.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        )
    );

DROP POLICY IF EXISTS "Users can create campaign recipients in their tenant" ON campaign_recipients;
CREATE POLICY "Users can create campaign recipients in their tenant"
    ON campaign_recipients FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM marketing_campaigns
            WHERE marketing_campaigns.id = campaign_id
            AND marketing_campaigns.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_campaign_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_marketing_campaigns_updated_at ON marketing_campaigns;
CREATE TRIGGER update_marketing_campaigns_updated_at
    BEFORE UPDATE ON marketing_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_updated_at();
