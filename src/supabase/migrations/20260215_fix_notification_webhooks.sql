CREATE TABLE IF NOT EXISTS notification_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    secret VARCHAR(255), -- For signature verification
    event_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    enabled BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_webhooks_tenant ON notification_webhooks(tenant_id, enabled);

ALTER TABLE notification_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can manage webhooks" ON notification_webhooks;
CREATE POLICY "Tenant admins can manage webhooks"
    ON notification_webhooks FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );
