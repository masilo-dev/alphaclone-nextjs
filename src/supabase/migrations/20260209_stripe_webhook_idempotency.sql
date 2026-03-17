-- ============================================================================
-- WEEK 1 SECURITY FIX: STRIPE WEBHOOK IDEMPOTENCY & AUDIT
-- ============================================================================
-- Prevents duplicate webhook processing and provides audit trail

-- Stripe Webhook Events Table
-- Tracks all processed webhook events to prevent duplicate processing
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    api_version VARCHAR(20),
    created_at_stripe TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'processed' CHECK (
        status IN ('processed', 'failed', 'skipped', 'retrying')
    ),
    event_data JSONB NOT NULL, -- Full event payload for debugging
    processing_attempts INTEGER DEFAULT 1,
    last_error TEXT,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    customer_id VARCHAR(255), -- Stripe customer ID
    subscription_id VARCHAR(255), -- Stripe subscription ID
    amount_cents INTEGER, -- For payment events
    currency VARCHAR(3), -- For payment events
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Reconciliation Table
-- Tracks all payments for accounting and reconciliation
CREATE TABLE IF NOT EXISTS stripe_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_invoice_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    customer_id VARCHAR(255) NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) CHECK (
        status IN ('succeeded', 'pending', 'failed', 'refunded', 'disputed')
    ),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    paid_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    refund_amount_cents INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook Processing Failures (for retry logic)
CREATE TABLE IF NOT EXISTS webhook_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_event_id UUID REFERENCES stripe_webhook_events(id) ON DELETE CASCADE,
    error_message TEXT NOT NULL,
    error_stack TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_stripe_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_tenant ON stripe_webhook_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created ON stripe_webhook_events(created_at_stripe);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_tenant ON stripe_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_customer ON stripe_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_status ON stripe_payments(status);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_retry ON webhook_failures(next_retry_at) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_failures ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admins only
DROP POLICY IF EXISTS "Admins can view webhook events" ON stripe_webhook_events;
CREATE POLICY "Admins can view webhook events"
    ON stripe_webhook_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can view payments" ON stripe_payments;
CREATE POLICY "Admins can view payments"
    ON stripe_payments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Tenant admins can view their own payments
DROP POLICY IF EXISTS "Tenant admins can view their payments" ON stripe_payments;
CREATE POLICY "Tenant admins can view their payments"
    ON stripe_payments FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role = 'tenant_admin'
        )
    );

-- Function to check if webhook event was already processed (idempotency)
CREATE OR REPLACE FUNCTION is_webhook_processed(p_stripe_event_id VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM stripe_webhook_events
        WHERE stripe_event_id = p_stripe_event_id
        AND status IN ('processed', 'retrying')
    );
END;
$$ LANGUAGE plpgsql;

-- Function to record webhook event
CREATE OR REPLACE FUNCTION record_webhook_event(
    p_stripe_event_id VARCHAR,
    p_event_type VARCHAR,
    p_event_data JSONB,
    p_api_version VARCHAR DEFAULT NULL,
    p_created_at_stripe TIMESTAMPTZ DEFAULT NOW(),
    p_tenant_id UUID DEFAULT NULL,
    p_customer_id VARCHAR DEFAULT NULL,
    p_subscription_id VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO stripe_webhook_events (
        stripe_event_id,
        event_type,
        api_version,
        created_at_stripe,
        event_data,
        status,
        tenant_id,
        customer_id,
        subscription_id
    ) VALUES (
        p_stripe_event_id,
        p_event_type,
        p_api_version,
        p_created_at_stripe,
        p_event_data,
        'processed',
        p_tenant_id,
        p_customer_id,
        p_subscription_id
    ) ON CONFLICT (stripe_event_id) DO UPDATE
    SET processing_attempts = stripe_webhook_events.processing_attempts + 1,
        updated_at = NOW()
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record payment
CREATE OR REPLACE FUNCTION record_payment(
    p_payment_intent_id VARCHAR,
    p_tenant_id UUID,
    p_customer_id VARCHAR,
    p_amount_cents INTEGER,
    p_currency VARCHAR DEFAULT 'USD',
    p_status VARCHAR DEFAULT 'succeeded',
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
BEGIN
    INSERT INTO stripe_payments (
        stripe_payment_intent_id,
        tenant_id,
        customer_id,
        amount_cents,
        currency,
        status,
        description,
        metadata,
        paid_at
    ) VALUES (
        p_payment_intent_id,
        p_tenant_id,
        p_customer_id,
        p_amount_cents,
        p_currency,
        p_status,
        p_description,
        p_metadata,
        CASE WHEN p_status = 'succeeded' THEN NOW() ELSE NULL END
    ) ON CONFLICT (stripe_payment_intent_id) DO UPDATE
    SET status = EXCLUDED.status,
        updated_at = NOW()
    RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_stripe_tables_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_update_webhook_events_timestamp ON stripe_webhook_events;
CREATE TRIGGER trigger_update_webhook_events_timestamp
    BEFORE UPDATE ON stripe_webhook_events
    FOR EACH ROW
    EXECUTE FUNCTION update_stripe_tables_timestamp();

DROP TRIGGER IF EXISTS trigger_update_payments_timestamp ON stripe_payments;
CREATE TRIGGER trigger_update_payments_timestamp
    BEFORE UPDATE ON stripe_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_stripe_tables_timestamp();

-- Comments for documentation
COMMENT ON TABLE stripe_webhook_events IS 'Tracks all Stripe webhook events for idempotency and auditing';
COMMENT ON TABLE stripe_payments IS 'Payment reconciliation and accounting records';
COMMENT ON TABLE webhook_failures IS 'Failed webhook processing for retry logic';
COMMENT ON COLUMN stripe_webhook_events.stripe_event_id IS 'Unique Stripe event ID for idempotency';
COMMENT ON COLUMN stripe_webhook_events.processing_attempts IS 'Number of times this event was processed (should be 1 for idempotent system)';

-- ============================================================================
-- STRIPE WEBHOOK SECURITY DEPLOYED!
-- ============================================================================
