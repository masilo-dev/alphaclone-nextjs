-- ============================================================================
-- WEEK 3: REVENUE OPTIMIZATION
-- ============================================================================
-- Implements features to maximize monetization and track conversion

-- Upgrade Prompts Tracking
-- Tracks when and where upgrade prompts are shown to users
CREATE TABLE IF NOT EXISTS upgrade_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt_type VARCHAR(50) NOT NULL CHECK (
        prompt_type IN ('quota_exceeded', 'feature_locked', 'banner', 'modal', 'tooltip', 'in_context')
    ),
    trigger_feature VARCHAR(100) NOT NULL, -- 'users', 'storage', 'ai_requests', etc.
    current_tier VARCHAR(50) NOT NULL,
    suggested_tier VARCHAR(50) NOT NULL,
    prompt_location VARCHAR(100), -- 'dashboard', 'projects', 'settings', etc.
    shown_at TIMESTAMPTZ DEFAULT NOW(),
    clicked BOOLEAN DEFAULT FALSE,
    clicked_at TIMESTAMPTZ,
    converted BOOLEAN DEFAULT FALSE,
    converted_at TIMESTAMPTZ,
    dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription Add-ons
-- Tracks purchased add-ons (extra storage, AI requests, etc.)
CREATE TABLE IF NOT EXISTS subscription_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    addon_type VARCHAR(50) NOT NULL CHECK (
        addon_type IN ('storage', 'ai_requests', 'video_minutes', 'team_members', 'api_calls')
    ),
    addon_name VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1, -- e.g., 10GB, 100 requests
    price_cents INTEGER NOT NULL, -- Price in cents
    currency VARCHAR(3) DEFAULT 'USD',
    stripe_product_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    billing_cycle VARCHAR(20) DEFAULT 'one_time' CHECK (
        billing_cycle IN ('one_time', 'monthly', 'annual')
    ),
    status VARCHAR(20) DEFAULT 'active' CHECK (
        status IN ('active', 'cancelled', 'expired')
    ),
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    auto_renew BOOLEAN DEFAULT FALSE,
    usage_remaining INTEGER, -- Tracks remaining usage for consumable add-ons
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription Plans (Enhanced)
-- Tracks subscription details including annual billing
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    tier_name VARCHAR(50) NOT NULL, -- 'free', 'starter', 'pro', 'enterprise'
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (
        billing_cycle IN ('monthly', 'annual')
    ),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (
        status IN ('trialing', 'active', 'past_due', 'cancelled', 'paused')
    ),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,

    -- Annual billing details
    annual_discount_percent INTEGER DEFAULT 0, -- 20 for 20% discount
    annual_savings_cents INTEGER, -- How much saved with annual

    -- Pricing
    base_price_cents INTEGER NOT NULL,
    discount_price_cents INTEGER, -- After any discounts
    final_price_cents INTEGER NOT NULL, -- Final amount charged

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversion Events
-- Tracks all conversion events for analytics
CREATE TABLE IF NOT EXISTS conversion_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (
        event_type IN (
            'upgrade_started', 'upgrade_completed', 'upgrade_abandoned',
            'addon_purchased', 'annual_switch', 'trial_started', 'trial_converted',
            'downgrade', 'churn'
        )
    ),
    from_tier VARCHAR(50),
    to_tier VARCHAR(50),
    revenue_change_cents INTEGER, -- Positive for upgrades, negative for downgrades
    payment_method VARCHAR(50),

    -- Attribution
    source VARCHAR(100), -- 'upgrade_prompt', 'settings', 'banner', 'email'
    campaign VARCHAR(100), -- For A/B testing different messages

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pricing Experiments (A/B Testing)
-- Test different pricing strategies
CREATE TABLE IF NOT EXISTS pricing_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_name VARCHAR(100) NOT NULL,
    variant VARCHAR(50) NOT NULL, -- 'control', 'variant_a', 'variant_b'
    tier_name VARCHAR(50) NOT NULL,

    -- Pricing variations
    monthly_price_cents INTEGER,
    annual_price_cents INTEGER,
    discount_percent INTEGER,
    free_trial_days INTEGER,

    -- Display variations
    cta_text VARCHAR(100),
    highlight_color VARCHAR(7),
    feature_order JSONB,

    is_active BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,

    -- Results
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue_generated_cents INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_upgrade_prompts_tenant ON upgrade_prompts(tenant_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_upgrade_prompts_converted ON upgrade_prompts(converted, shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_addons_tenant ON subscription_addons(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant ON tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_stripe ON tenant_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_tenant ON conversion_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversion_events_type ON conversion_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_experiments_active ON pricing_experiments(is_active, experiment_name);

-- Enable RLS
ALTER TABLE upgrade_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_experiments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Tenant admins can view their own data
DROP POLICY IF EXISTS "Tenant admins can view their upgrade prompts" ON upgrade_prompts;
CREATE POLICY "Tenant admins can view their upgrade prompts"
    ON upgrade_prompts FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

DROP POLICY IF EXISTS "Tenant admins can manage their addons" ON subscription_addons;
CREATE POLICY "Tenant admins can manage their addons"
    ON subscription_addons FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

DROP POLICY IF EXISTS "Tenant admins can view their subscription" ON tenant_subscriptions;
CREATE POLICY "Tenant admins can view their subscription"
    ON tenant_subscriptions FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

-- Admins can view all data for analytics
DROP POLICY IF EXISTS "Admins can view all conversion events" ON conversion_events;
CREATE POLICY "Admins can view all conversion events"
    ON conversion_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Everyone can view pricing experiments" ON pricing_experiments;
CREATE POLICY "Everyone can view pricing experiments"
    ON pricing_experiments FOR SELECT
    TO authenticated
    USING (is_active = TRUE);

-- Function to track upgrade prompt shown
CREATE OR REPLACE FUNCTION track_upgrade_prompt(
    p_tenant_id UUID,
    p_user_id UUID,
    p_prompt_type VARCHAR,
    p_trigger_feature VARCHAR,
    p_current_tier VARCHAR,
    p_suggested_tier VARCHAR,
    p_prompt_location VARCHAR DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_prompt_id UUID;
BEGIN
    INSERT INTO upgrade_prompts (
        tenant_id, user_id, prompt_type, trigger_feature,
        current_tier, suggested_tier, prompt_location, metadata
    ) VALUES (
        p_tenant_id, p_user_id, p_prompt_type, p_trigger_feature,
        p_current_tier, p_suggested_tier, p_prompt_location, p_metadata
    ) RETURNING id INTO v_prompt_id;

    RETURN v_prompt_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record prompt click
CREATE OR REPLACE FUNCTION record_prompt_click(p_prompt_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE upgrade_prompts
    SET clicked = TRUE, clicked_at = NOW()
    WHERE id = p_prompt_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to record conversion
CREATE OR REPLACE FUNCTION record_conversion(
    p_prompt_id UUID,
    p_tenant_id UUID,
    p_user_id UUID,
    p_from_tier VARCHAR,
    p_to_tier VARCHAR,
    p_revenue_change_cents INTEGER
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    -- Update prompt as converted
    UPDATE upgrade_prompts
    SET converted = TRUE, converted_at = NOW()
    WHERE id = p_prompt_id;

    -- Record conversion event
    INSERT INTO conversion_events (
        tenant_id, user_id, event_type, from_tier, to_tier,
        revenue_change_cents, source
    ) VALUES (
        p_tenant_id, p_user_id, 'upgrade_completed', p_from_tier, p_to_tier,
        p_revenue_change_cents, 'upgrade_prompt'
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to purchase addon
CREATE OR REPLACE FUNCTION purchase_addon(
    p_tenant_id UUID,
    p_addon_type VARCHAR,
    p_addon_name VARCHAR,
    p_quantity INTEGER,
    p_price_cents INTEGER,
    p_billing_cycle VARCHAR DEFAULT 'one_time',
    p_stripe_product_id VARCHAR DEFAULT NULL,
    p_stripe_price_id VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_addon_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Calculate expiration for non-one-time purchases
    IF p_billing_cycle = 'monthly' THEN
        v_expires_at := NOW() + INTERVAL '1 month';
    ELSIF p_billing_cycle = 'annual' THEN
        v_expires_at := NOW() + INTERVAL '1 year';
    END IF;

    INSERT INTO subscription_addons (
        tenant_id, addon_type, addon_name, quantity,
        price_cents, billing_cycle, stripe_product_id, stripe_price_id,
        expires_at, usage_remaining
    ) VALUES (
        p_tenant_id, p_addon_type, p_addon_name, p_quantity,
        p_price_cents, p_billing_cycle, p_stripe_product_id, p_stripe_price_id,
        v_expires_at, p_quantity
    ) RETURNING id INTO v_addon_id;

    RETURN v_addon_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get conversion metrics
CREATE OR REPLACE FUNCTION get_conversion_metrics(
    p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_prompts BIGINT,
    total_clicks BIGINT,
    total_conversions BIGINT,
    click_through_rate NUMERIC,
    conversion_rate NUMERIC,
    total_revenue_cents BIGINT,
    avg_revenue_per_conversion NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_prompts,
        COUNT(CASE WHEN clicked THEN 1 END)::BIGINT as total_clicks,
        COUNT(CASE WHEN converted THEN 1 END)::BIGINT as total_conversions,
        ROUND(
            (COUNT(CASE WHEN clicked THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
            2
        ) as click_through_rate,
        ROUND(
            (COUNT(CASE WHEN converted THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
            2
        ) as conversion_rate,
        COALESCE(SUM(
            CASE WHEN ce.revenue_change_cents IS NOT NULL
            THEN ce.revenue_change_cents ELSE 0 END
        ), 0)::BIGINT as total_revenue_cents,
        ROUND(
            COALESCE(SUM(
                CASE WHEN ce.revenue_change_cents IS NOT NULL
                THEN ce.revenue_change_cents ELSE 0 END
            ), 0)::NUMERIC / NULLIF(COUNT(CASE WHEN converted THEN 1 END), 0),
            2
        ) as avg_revenue_per_conversion
    FROM upgrade_prompts up
    LEFT JOIN conversion_events ce ON ce.tenant_id = up.tenant_id
        AND ce.created_at BETWEEN up.shown_at AND up.shown_at + INTERVAL '7 days'
    WHERE up.shown_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_subscription_addons_timestamp ON subscription_addons;
CREATE TRIGGER trigger_update_subscription_addons_timestamp
    BEFORE UPDATE ON subscription_addons
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_timestamp();

DROP TRIGGER IF EXISTS trigger_update_tenant_subscriptions_timestamp ON tenant_subscriptions;
CREATE TRIGGER trigger_update_tenant_subscriptions_timestamp
    BEFORE UPDATE ON tenant_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_timestamp();

-- Comments for documentation
COMMENT ON TABLE upgrade_prompts IS 'Tracks when upgrade prompts are shown and their effectiveness';
COMMENT ON TABLE subscription_addons IS 'Purchased add-ons like extra storage, AI requests, etc.';
COMMENT ON TABLE tenant_subscriptions IS 'Subscription details including annual billing';
COMMENT ON TABLE conversion_events IS 'All conversion events for revenue analytics';
COMMENT ON TABLE pricing_experiments IS 'A/B testing different pricing strategies';

-- ============================================================================
-- REVENUE OPTIMIZATION SYSTEM DEPLOYED!
-- ============================================================================
