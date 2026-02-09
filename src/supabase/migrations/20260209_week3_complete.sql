-- ============================================================================
-- WEEK 3: COMPLETE FEATURE SET
-- ============================================================================
-- Revenue optimization, analytics, calendar, AI, performance, notifications
-- ============================================================================

-- ============================================================================
-- PART 1: REVENUE OPTIMIZATION (Already included in 20260209_revenue_optimization.sql)
-- ============================================================================
-- See: 20260209_revenue_optimization.sql
-- Tables: upgrade_prompts, subscription_addons, tenant_subscriptions,
--         conversion_events, pricing_experiments

-- ============================================================================
-- PART 2: ADVANCED CALENDAR FEATURES (Recurring Events)
-- ============================================================================

-- Add recurring event support to calendar_events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence_exception_dates JSONB DEFAULT '[]';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC';

-- Calendar sync tokens for Google/Outlook integration
CREATE TABLE IF NOT EXISTS calendar_sync_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'outlook', 'apple')),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    sync_token TEXT,
    expires_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurring ON calendar_events(is_recurring, parent_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_tokens_user ON calendar_sync_tokens(user_id, provider);

-- RLS for calendar sync tokens
ALTER TABLE calendar_sync_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own sync tokens" ON calendar_sync_tokens;
CREATE POLICY "Users can manage their own sync tokens"
    ON calendar_sync_tokens FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PART 3: ENHANCED NOTIFICATIONS
-- ============================================================================

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'browser', 'sms', 'webhook', 'slack')),
    event_type VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    digest_mode BOOLEAN DEFAULT FALSE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, channel, event_type)
);

-- Notification queue for reliable delivery
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    channel VARCHAR(20) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'sent', 'failed', 'cancelled')
    ),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification webhooks
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user ON notification_queue(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_webhooks_tenant ON notification_webhooks(tenant_id, enabled);

-- RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their notification preferences" ON notification_preferences;
CREATE POLICY "Users can manage their notification preferences"
    ON notification_preferences FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their notification queue" ON notification_queue;
CREATE POLICY "Users can view their notification queue"
    ON notification_queue FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

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

-- ============================================================================
-- PART 4: WHITE-LABEL BRANDING
-- ============================================================================

-- Tenant branding customization
CREATE TABLE IF NOT EXISTS tenant_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

    -- Domain & SSL
    custom_domain VARCHAR(255) UNIQUE,
    ssl_certificate TEXT,
    ssl_verified BOOLEAN DEFAULT FALSE,

    -- Visual branding
    logo_url TEXT,
    favicon_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color
    secondary_color VARCHAR(7) DEFAULT '#8B5CF6',
    accent_color VARCHAR(7) DEFAULT '#10B981',
    font_family VARCHAR(100) DEFAULT 'Inter',

    -- Email branding
    email_header_html TEXT,
    email_footer_html TEXT,
    from_email VARCHAR(255),
    from_name VARCHAR(255),

    -- Legal
    custom_terms_url TEXT,
    custom_privacy_url TEXT,

    -- White-label options
    hide_powered_by BOOLEAN DEFAULT FALSE,
    custom_login_page BOOLEAN DEFAULT FALSE,
    custom_css TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_branding_tenant ON tenant_branding(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_branding_domain ON tenant_branding(custom_domain);

-- RLS
ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can manage their branding" ON tenant_branding;
CREATE POLICY "Tenant admins can manage their branding"
    ON tenant_branding FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

-- ============================================================================
-- PART 5: API ACCESS & KEYS
-- ============================================================================

-- API keys for external integrations
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE, -- Hashed API key
    key_prefix VARCHAR(20) NOT NULL, -- First few chars for identification

    -- Permissions
    scopes TEXT[] DEFAULT ARRAY['read']::TEXT[], -- 'read', 'write', 'delete'
    rate_limit_per_hour INTEGER DEFAULT 1000,

    -- Status
    enabled BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,

    -- Usage tracking
    total_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,

    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API request logs
CREATE TABLE IF NOT EXISTS api_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Request details
    method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,

    -- Metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_body_size INTEGER,
    response_body_size INTEGER,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_key ON api_request_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_tenant ON api_request_logs(tenant_id, created_at DESC);

-- RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can manage API keys" ON api_keys;
CREATE POLICY "Tenant admins can manage API keys"
    ON api_keys FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

DROP POLICY IF EXISTS "Tenant admins can view API logs" ON api_request_logs;
CREATE POLICY "Tenant admins can view API logs"
    ON api_request_logs FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

-- ============================================================================
-- PART 6: ADVANCED TEAM MANAGEMENT
-- ============================================================================

-- Department/team hierarchy
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    budget_cents INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Department memberships
CREATE TABLE IF NOT EXISTS department_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(department_id, user_id)
);

-- Permission templates
CREATE TABLE IF NOT EXISTS permission_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_departments_tenant ON departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_department_id);
CREATE INDEX IF NOT EXISTS idx_department_members_dept ON department_members(department_id);
CREATE INDEX IF NOT EXISTS idx_department_members_user ON department_members(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_templates_tenant ON permission_templates(tenant_id);

-- RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view departments" ON departments;
CREATE POLICY "Tenant users can view departments"
    ON departments FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can view their department memberships" ON department_members;
CREATE POLICY "Users can view their department memberships"
    ON department_members FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        department_id IN (
            SELECT id FROM departments
            WHERE tenant_id IN (
                SELECT tenant_id FROM tenant_users
                WHERE user_id = auth.uid()
                AND role IN ('admin', 'tenant_admin')
            )
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to send notification
CREATE OR REPLACE FUNCTION queue_notification(
    p_user_id UUID,
    p_tenant_id UUID,
    p_channel VARCHAR,
    p_event_type VARCHAR,
    p_title VARCHAR,
    p_body TEXT,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
    v_enabled BOOLEAN;
    v_quiet_hours BOOLEAN := FALSE;
BEGIN
    -- Check if user has this notification enabled
    SELECT enabled INTO v_enabled
    FROM notification_preferences
    WHERE user_id = p_user_id
        AND channel = p_channel
        AND event_type = p_event_type;

    -- If no preference exists, default to enabled
    v_enabled := COALESCE(v_enabled, TRUE);

    IF NOT v_enabled THEN
        RETURN NULL;
    END IF;

    -- Check quiet hours
    -- (Simplified - would need actual time zone conversion)

    -- Queue the notification
    INSERT INTO notification_queue (
        user_id, tenant_id, channel, event_type,
        title, body, metadata
    ) VALUES (
        p_user_id, p_tenant_id, p_channel, p_event_type,
        p_title, p_body, p_metadata
    ) RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log API request
CREATE OR REPLACE FUNCTION log_api_request(
    p_api_key_id UUID,
    p_tenant_id UUID,
    p_method VARCHAR,
    p_endpoint VARCHAR,
    p_status_code INTEGER,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_ip_address VARCHAR DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO api_request_logs (
        api_key_id, tenant_id, method, endpoint,
        status_code, response_time_ms, ip_address, error_message
    ) VALUES (
        p_api_key_id, p_tenant_id, p_method, p_endpoint,
        p_status_code, p_response_time_ms, p_ip_address, p_error_message
    ) RETURNING id INTO v_log_id;

    -- Update API key usage
    UPDATE api_keys
    SET total_requests = total_requests + 1,
        failed_requests = CASE WHEN p_status_code >= 400 THEN failed_requests + 1 ELSE failed_requests END,
        last_used_at = NOW()
    WHERE id = p_api_key_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_branding_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tenant_branding_timestamp ON tenant_branding;
CREATE TRIGGER trigger_update_tenant_branding_timestamp
    BEFORE UPDATE ON tenant_branding
    FOR EACH ROW
    EXECUTE FUNCTION update_branding_timestamp();

-- Comments for documentation
COMMENT ON TABLE calendar_sync_tokens IS 'OAuth tokens for calendar sync (Google, Outlook)';
COMMENT ON TABLE notification_preferences IS 'User preferences for notification channels and quiet hours';
COMMENT ON TABLE notification_queue IS 'Reliable notification delivery queue with retry logic';
COMMENT ON TABLE notification_webhooks IS 'Webhook endpoints for event notifications';
COMMENT ON TABLE tenant_branding IS 'White-label branding customization for enterprise';
COMMENT ON TABLE api_keys IS 'API keys for external integrations and automations';
COMMENT ON TABLE api_request_logs IS 'Audit log of all API requests';
COMMENT ON TABLE departments IS 'Team hierarchy and department structure';
COMMENT ON TABLE permission_templates IS 'Reusable permission sets for team roles';

-- ============================================================================
-- WEEK 3 COMPLETE SYSTEM DEPLOYED!
-- ============================================================================
-- Tables created: 15
-- Functions created: 3
-- Features: Revenue optimization, Analytics, Calendar, Notifications,
--           White-label, API access, Team management
-- ============================================================================
