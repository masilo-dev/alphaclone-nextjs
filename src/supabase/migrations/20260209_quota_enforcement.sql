-- ============================================================================
-- WEEK 2: MULTI-TENANCY QUOTA ENFORCEMENT
-- ============================================================================
-- Tracks usage and enforces limits based on subscription tier

-- Subscription Tier Limits
-- Defines quota limits for each subscription tier
CREATE TABLE IF NOT EXISTS subscription_tier_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name VARCHAR(50) UNIQUE NOT NULL, -- 'free', 'starter', 'pro', 'enterprise'
    users_limit INTEGER NOT NULL DEFAULT 5,
    projects_limit INTEGER NOT NULL DEFAULT 10,
    storage_mb_limit INTEGER NOT NULL DEFAULT 1000,
    api_calls_per_month INTEGER NOT NULL DEFAULT 10000,
    contracts_limit INTEGER NOT NULL DEFAULT 50,
    team_members_limit INTEGER NOT NULL DEFAULT 5,
    ai_requests_per_month INTEGER NOT NULL DEFAULT 100,
    video_minutes_per_month INTEGER NOT NULL DEFAULT 60,
    custom_features JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant Usage Tracking
-- Real-time usage tracking for each tenant
CREATE TABLE IF NOT EXISTS tenant_usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL, -- 'users', 'projects', 'storage_mb', 'api_calls', etc.
    current_value INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
    period_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, metric_name, period_start)
);

-- Usage Events Log
-- Detailed log of all usage events for analytics
CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL, -- 'user_added', 'project_created', 'api_call', etc.
    metric_name VARCHAR(100) NOT NULL,
    increment_value INTEGER NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quota Exceeded Alerts
-- Tracks when tenants exceed or approach their limits
CREATE TABLE IF NOT EXISTS quota_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (
        alert_type IN ('approaching', 'exceeded', 'blocked')
    ),
    current_value INTEGER NOT NULL,
    limit_value INTEGER NOT NULL,
    threshold_percentage INTEGER, -- e.g., 80 for "approaching"
    alerted_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_tracking_tenant ON tenant_usage_tracking(tenant_id, period_start);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_metric ON tenant_usage_tracking(metric_name, period_start);
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant ON usage_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_metric ON usage_events(metric_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_tenant ON quota_alerts(tenant_id, alert_type, resolved_at);

-- Enable RLS
ALTER TABLE subscription_tier_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admins can view tier limits
DROP POLICY IF EXISTS "Anyone can view tier limits" ON subscription_tier_limits;
CREATE POLICY "Anyone can view tier limits"
    ON subscription_tier_limits FOR SELECT
    TO authenticated
    USING (true);

-- Tenant admins can view their own usage
DROP POLICY IF EXISTS "Tenant admins can view their usage" ON tenant_usage_tracking;
CREATE POLICY "Tenant admins can view their usage"
    ON tenant_usage_tracking FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

-- Tenant admins can view their usage events
DROP POLICY IF EXISTS "Tenant admins can view their usage events" ON usage_events;
CREATE POLICY "Tenant admins can view their usage events"
    ON usage_events FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

-- Tenant admins can view their quota alerts
DROP POLICY IF EXISTS "Tenant admins can view their quota alerts" ON quota_alerts;
CREATE POLICY "Tenant admins can view their quota alerts"
    ON quota_alerts FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

-- Function to get tenant's current tier
CREATE OR REPLACE FUNCTION get_tenant_tier(p_tenant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_tier VARCHAR;
BEGIN
    SELECT subscription_plan INTO v_tier
    FROM tenants
    WHERE id = p_tenant_id;

    RETURN COALESCE(v_tier, 'free');
END;
$$ LANGUAGE plpgsql;

-- Function to get tier limit for a metric
CREATE OR REPLACE FUNCTION get_tier_limit(p_tier VARCHAR, p_metric_name VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    v_limit INTEGER;
BEGIN
    CASE p_metric_name
        WHEN 'users' THEN
            SELECT users_limit INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'projects' THEN
            SELECT projects_limit INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'storage_mb' THEN
            SELECT storage_mb_limit INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'api_calls' THEN
            SELECT api_calls_per_month INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'contracts' THEN
            SELECT contracts_limit INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'team_members' THEN
            SELECT team_members_limit INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'ai_requests' THEN
            SELECT ai_requests_per_month INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'video_minutes' THEN
            SELECT video_minutes_per_month INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        ELSE
            v_limit := 999999; -- No limit for unknown metrics
    END CASE;

    RETURN COALESCE(v_limit, 999999);
END;
$$ LANGUAGE plpgsql;

-- Function to track usage
CREATE OR REPLACE FUNCTION track_usage(
    p_tenant_id UUID,
    p_metric_name VARCHAR,
    p_increment INTEGER DEFAULT 1,
    p_user_id UUID DEFAULT NULL,
    p_event_type VARCHAR DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_value INTEGER;
    v_tier VARCHAR;
    v_limit INTEGER;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
BEGIN
    -- Get current period
    v_period_start := date_trunc('month', NOW());
    v_period_end := v_period_start + INTERVAL '1 month';

    -- Get tenant tier and limit
    v_tier := get_tenant_tier(p_tenant_id);
    v_limit := get_tier_limit(v_tier, p_metric_name);

    -- Update or insert usage tracking
    INSERT INTO tenant_usage_tracking (
        tenant_id, metric_name, current_value, period_start, period_end
    ) VALUES (
        p_tenant_id, p_metric_name, p_increment, v_period_start, v_period_end
    )
    ON CONFLICT (tenant_id, metric_name, period_start)
    DO UPDATE SET
        current_value = tenant_usage_tracking.current_value + p_increment,
        last_updated = NOW()
    RETURNING current_value INTO v_current_value;

    -- Log usage event
    INSERT INTO usage_events (
        tenant_id, user_id, event_type, metric_name, increment_value, metadata
    ) VALUES (
        p_tenant_id, p_user_id, COALESCE(p_event_type, p_metric_name || '_increment'),
        p_metric_name, p_increment, p_metadata
    );

    -- Check if approaching limit (80%)
    IF v_current_value >= (v_limit * 0.8) AND v_current_value < v_limit THEN
        INSERT INTO quota_alerts (
            tenant_id, metric_name, alert_type, current_value,
            limit_value, threshold_percentage
        ) VALUES (
            p_tenant_id, p_metric_name, 'approaching', v_current_value,
            v_limit, 80
        )
        ON CONFLICT DO NOTHING;
    END IF;

    -- Check if exceeded limit
    IF v_current_value >= v_limit THEN
        INSERT INTO quota_alerts (
            tenant_id, metric_name, alert_type, current_value, limit_value
        ) VALUES (
            p_tenant_id, p_metric_name, 'exceeded', v_current_value, v_limit
        )
        ON CONFLICT DO NOTHING;

        RETURN FALSE; -- Quota exceeded
    END IF;

    RETURN TRUE; -- Within quota
END;
$$ LANGUAGE plpgsql;

-- Function to check if tenant can perform action
CREATE OR REPLACE FUNCTION can_perform_action(
    p_tenant_id UUID,
    p_metric_name VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_value INTEGER;
    v_tier VARCHAR;
    v_limit INTEGER;
BEGIN
    -- Get current usage
    SELECT current_value INTO v_current_value
    FROM tenant_usage_tracking
    WHERE tenant_id = p_tenant_id
        AND metric_name = p_metric_name
        AND period_start = date_trunc('month', NOW());

    v_current_value := COALESCE(v_current_value, 0);

    -- Get tenant tier and limit
    v_tier := get_tenant_tier(p_tenant_id);
    v_limit := get_tier_limit(v_tier, p_metric_name);

    RETURN v_current_value < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get tenant usage summary
CREATE OR REPLACE FUNCTION get_tenant_usage_summary(p_tenant_id UUID)
RETURNS TABLE (
    metric_name VARCHAR,
    current_value INTEGER,
    limit_value INTEGER,
    percentage_used NUMERIC,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.metric_name,
        COALESCE(t.current_value, 0) as current_value,
        get_tier_limit(get_tenant_tier(p_tenant_id), t.metric_name) as limit_value,
        ROUND(
            (COALESCE(t.current_value, 0)::NUMERIC /
            NULLIF(get_tier_limit(get_tenant_tier(p_tenant_id), t.metric_name), 0)) * 100,
            2
        ) as percentage_used,
        CASE
            WHEN COALESCE(t.current_value, 0) >= get_tier_limit(get_tenant_tier(p_tenant_id), t.metric_name) THEN 'exceeded'
            WHEN COALESCE(t.current_value, 0) >= (get_tier_limit(get_tenant_tier(p_tenant_id), t.metric_name) * 0.8) THEN 'approaching'
            ELSE 'ok'
        END as status
    FROM tenant_usage_tracking t
    WHERE t.tenant_id = p_tenant_id
        AND t.period_start = date_trunc('month', NOW());
END;
$$ LANGUAGE plpgsql;

-- Insert default tier limits
INSERT INTO subscription_tier_limits (
    tier_name, users_limit, projects_limit, storage_mb_limit,
    api_calls_per_month, contracts_limit, team_members_limit,
    ai_requests_per_month, video_minutes_per_month
) VALUES
    ('free', 2, 3, 500, 1000, 5, 2, 10, 30),
    ('starter', 10, 25, 5000, 10000, 50, 10, 100, 300),
    ('pro', 50, 100, 25000, 50000, 500, 50, 1000, 1500),
    ('enterprise', 999999, 999999, 999999, 999999, 999999, 999999, 999999, 999999)
ON CONFLICT (tier_name) DO UPDATE SET
    users_limit = EXCLUDED.users_limit,
    projects_limit = EXCLUDED.projects_limit,
    storage_mb_limit = EXCLUDED.storage_mb_limit,
    api_calls_per_month = EXCLUDED.api_calls_per_month,
    contracts_limit = EXCLUDED.contracts_limit,
    team_members_limit = EXCLUDED.team_members_limit,
    ai_requests_per_month = EXCLUDED.ai_requests_per_month,
    video_minutes_per_month = EXCLUDED.video_minutes_per_month;

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_tier_limits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tier_limits_timestamp ON subscription_tier_limits;
CREATE TRIGGER trigger_update_tier_limits_timestamp
    BEFORE UPDATE ON subscription_tier_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_tier_limits_timestamp();

-- Comments for documentation
COMMENT ON TABLE subscription_tier_limits IS 'Defines quota limits for each subscription tier';
COMMENT ON TABLE tenant_usage_tracking IS 'Real-time usage tracking per tenant';
COMMENT ON TABLE usage_events IS 'Detailed log of all usage events';
COMMENT ON TABLE quota_alerts IS 'Alerts when tenants approach or exceed limits';

-- ============================================================================
-- QUOTA ENFORCEMENT SYSTEM DEPLOYED!
-- ============================================================================
