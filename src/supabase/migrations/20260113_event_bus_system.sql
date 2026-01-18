-- =====================================================
-- BUSINESS OS - EVENT BUS SYSTEM
-- Phase 1: Core Infrastructure
-- =====================================================
-- Event Store Table
-- Stores all events that occur in the system
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    event_source VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'completed', 'failed')
    ),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT
);
-- Event Subscriptions Table
-- Defines which handlers should be triggered for which events
CREATE TABLE IF NOT EXISTS event_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_name VARCHAR(100) NOT NULL,
    event_pattern VARCHAR(200) NOT NULL,
    handler_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Event Handlers Table
-- Registry of available event handlers
CREATE TABLE IF NOT EXISTS event_handlers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    handler_type VARCHAR(50) NOT NULL CHECK (
        handler_type IN ('function', 'workflow', 'webhook', 'plugin')
    ),
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Event Logs Table
-- Detailed execution logs for debugging
CREATE TABLE IF NOT EXISTS event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES event_subscriptions(id),
    handler_name VARCHAR(100),
    status VARCHAR(20) NOT NULL,
    execution_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(event_source);
CREATE INDEX IF NOT EXISTS idx_subscriptions_pattern ON event_subscriptions(event_pattern);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON event_subscriptions(is_active)
WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_event_logs_event ON event_logs(event_id);
-- Function to publish events
CREATE OR REPLACE FUNCTION publish_event(
        p_event_type VARCHAR,
        p_event_source VARCHAR,
        p_event_data JSONB,
        p_metadata JSONB DEFAULT '{}'
    ) RETURNS UUID AS $$
DECLARE v_event_id UUID;
BEGIN
INSERT INTO events (event_type, event_source, event_data, metadata)
VALUES (
        p_event_type,
        p_event_source,
        p_event_data,
        p_metadata
    )
RETURNING id INTO v_event_id;
RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;
-- Function to get pending events
CREATE OR REPLACE FUNCTION get_pending_events(p_limit INTEGER DEFAULT 100) RETURNS TABLE (
        id UUID,
        event_type VARCHAR,
        event_source VARCHAR,
        event_data JSONB,
        metadata JSONB,
        created_at TIMESTAMPTZ
    ) AS $$ BEGIN RETURN QUERY
SELECT e.id,
    e.event_type,
    e.event_source,
    e.event_data,
    e.metadata,
    e.created_at
FROM events e
WHERE e.status = 'pending'
ORDER BY e.created_at ASC
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
-- Function to mark event as processed
CREATE OR REPLACE FUNCTION mark_event_processed(
        p_event_id UUID,
        p_status VARCHAR DEFAULT 'completed',
        p_error_message TEXT DEFAULT NULL
    ) RETURNS VOID AS $$ BEGIN
UPDATE events
SET status = p_status,
    processed_at = NOW(),
    error_message = p_error_message
WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql;
-- Function to get event subscriptions for a specific event type
CREATE OR REPLACE FUNCTION get_subscriptions_for_event(p_event_type VARCHAR) RETURNS TABLE (
        id UUID,
        subscriber_name VARCHAR,
        handler_config JSONB,
        priority INTEGER
    ) AS $$ BEGIN RETURN QUERY
SELECT s.id,
    s.subscriber_name,
    s.handler_config,
    s.priority
FROM event_subscriptions s
WHERE s.is_active = true
    AND (
        s.event_pattern = p_event_type
        OR s.event_pattern = '*'
        OR p_event_type LIKE s.event_pattern
    )
ORDER BY s.priority ASC;
END;
$$ LANGUAGE plpgsql;
-- Trigger to notify on new events (for real-time processing)
CREATE OR REPLACE FUNCTION notify_new_event() RETURNS TRIGGER AS $$ BEGIN PERFORM pg_notify(
        'new_event',
        json_build_object(
            'id',
            NEW.id,
            'type',
            NEW.event_type,
            'source',
            NEW.event_source
        )::text
    );
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_notify_new_event
AFTER
INSERT ON events FOR EACH ROW EXECUTE FUNCTION notify_new_event();
-- Insert default event handlers
INSERT INTO event_handlers (name, description, handler_type, config)
VALUES (
        'log_handler',
        'Logs all events to console',
        'function',
        '{"function": "logEvent"}'
    ),
    (
        'notification_handler',
        'Sends notifications for important events',
        'function',
        '{"function": "sendNotification"}'
    ),
    (
        'workflow_trigger',
        'Triggers workflows based on events',
        'workflow',
        '{"enabled": true}'
    ) ON CONFLICT (name) DO NOTHING;
-- Insert default subscriptions
INSERT INTO event_subscriptions (
        subscriber_name,
        event_pattern,
        handler_config,
        priority
    )
VALUES (
        'system_logger',
        '*',
        '{"handler": "log_handler", "level": "info"}',
        100
    ),
    (
        'user_notifications',
        'user.*',
        '{"handler": "notification_handler"}',
        50
    ),
    (
        'project_notifications',
        'project.*',
        '{"handler": "notification_handler"}',
        50
    ),
    (
        'workflow_automation',
        '*',
        '{"handler": "workflow_trigger"}',
        10
    ) ON CONFLICT DO NOTHING;
COMMENT ON TABLE events IS 'Central event store for the Business OS event bus system';
COMMENT ON TABLE event_subscriptions IS 'Defines event handlers and their subscriptions';
COMMENT ON TABLE event_handlers IS 'Registry of available event handlers';
COMMENT ON TABLE event_logs IS 'Execution logs for event processing';