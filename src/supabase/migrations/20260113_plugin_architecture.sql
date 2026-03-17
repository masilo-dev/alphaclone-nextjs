-- =====================================================
-- BUSINESS OS - PLUGIN ARCHITECTURE
-- Phase 4: Extensibility System
-- =====================================================
-- Plugins Table
-- Registry of available plugins
CREATE TABLE IF NOT EXISTS plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    version VARCHAR(20) NOT NULL,
    author VARCHAR(200),
    author_url TEXT,
    icon_url TEXT,
    manifest JSONB NOT NULL,
    is_official BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    downloads INTEGER DEFAULT 0,
    rating DECIMAL(3, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Tenant Plugins (Installed Plugins)
-- Tracks which plugins are installed for each tenant
CREATE TABLE IF NOT EXISTS tenant_plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    config JSONB DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT true,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, plugin_id)
);
-- Plugin Hooks
-- Defines event hooks that plugins can subscribe to
CREATE TABLE IF NOT EXISTS plugin_hooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    hook_name VARCHAR(100) NOT NULL,
    handler_function TEXT NOT NULL,
    priority INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Plugin Settings
-- Stores plugin configuration per tenant
CREATE TABLE IF NOT EXISTS plugin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_plugin_id UUID NOT NULL REFERENCES tenant_plugins(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_plugin_id, setting_key)
);
-- Plugin Logs
-- Execution logs for debugging
CREATE TABLE IF NOT EXISTS plugin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_plugin_id UUID NOT NULL REFERENCES tenant_plugins(id) ON DELETE CASCADE,
    log_level VARCHAR(20) NOT NULL CHECK (log_level IN ('debug', 'info', 'warn', 'error')),
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_plugins_slug ON plugins(slug);
CREATE INDEX IF NOT EXISTS idx_plugins_official ON plugins(is_official)
WHERE is_official = true;
CREATE INDEX IF NOT EXISTS idx_tenant_plugins_tenant ON tenant_plugins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_plugins_plugin ON tenant_plugins(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_hooks_name ON plugin_hooks(hook_name);
CREATE INDEX IF NOT EXISTS idx_plugin_logs_tenant_plugin ON plugin_logs(tenant_plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_logs_created ON plugin_logs(created_at DESC);
-- Function to install plugin for tenant
CREATE OR REPLACE FUNCTION install_plugin(
        p_tenant_id UUID,
        p_plugin_id UUID,
        p_config JSONB DEFAULT '{}'
    ) RETURNS UUID AS $$
DECLARE v_tenant_plugin_id UUID;
BEGIN -- Install plugin
INSERT INTO tenant_plugins (tenant_id, plugin_id, config)
VALUES (p_tenant_id, p_plugin_id, p_config) ON CONFLICT (tenant_id, plugin_id) DO
UPDATE
SET config = EXCLUDED.config,
    updated_at = NOW()
RETURNING id INTO v_tenant_plugin_id;
-- Increment download count
UPDATE plugins
SET downloads = downloads + 1
WHERE id = p_plugin_id;
-- Publish plugin installed event
PERFORM publish_event(
    'plugin.installed',
    'plugin_manager',
    jsonb_build_object(
        'tenantId',
        p_tenant_id,
        'pluginId',
        p_plugin_id,
        'tenantPluginId',
        v_tenant_plugin_id
    )
);
RETURN v_tenant_plugin_id;
END;
$$ LANGUAGE plpgsql;
-- Function to uninstall plugin
CREATE OR REPLACE FUNCTION uninstall_plugin(p_tenant_id UUID, p_plugin_id UUID) RETURNS VOID AS $$ BEGIN
DELETE FROM tenant_plugins
WHERE tenant_id = p_tenant_id
    AND plugin_id = p_plugin_id;
-- Publish plugin uninstalled event
PERFORM publish_event(
    'plugin.uninstalled',
    'plugin_manager',
    jsonb_build_object(
        'tenantId',
        p_tenant_id,
        'pluginId',
        p_plugin_id
    )
);
END;
$$ LANGUAGE plpgsql;
-- Function to get tenant's installed plugins
CREATE OR REPLACE FUNCTION get_tenant_plugins(p_tenant_id UUID) RETURNS TABLE (
        plugin_id UUID,
        plugin_name VARCHAR,
        plugin_slug VARCHAR,
        plugin_version VARCHAR,
        is_enabled BOOLEAN,
        config JSONB,
        installed_at TIMESTAMPTZ
    ) AS $$ BEGIN RETURN QUERY
SELECT p.id,
    p.name,
    p.slug,
    p.version,
    tp.is_enabled,
    tp.config,
    tp.installed_at
FROM plugins p
    INNER JOIN tenant_plugins tp ON p.id = tp.plugin_id
WHERE tp.tenant_id = p_tenant_id
ORDER BY tp.installed_at DESC;
END;
$$ LANGUAGE plpgsql;
-- Function to log plugin activity
CREATE OR REPLACE FUNCTION log_plugin_activity(
        p_tenant_plugin_id UUID,
        p_log_level VARCHAR,
        p_message TEXT,
        p_metadata JSONB DEFAULT NULL
    ) RETURNS VOID AS $$ BEGIN
INSERT INTO plugin_logs (tenant_plugin_id, log_level, message, metadata)
VALUES (
        p_tenant_plugin_id,
        p_log_level,
        p_message,
        p_metadata
    );
END;
$$ LANGUAGE plpgsql;
-- Function to get plugin hooks
CREATE OR REPLACE FUNCTION get_plugin_hooks(p_hook_name VARCHAR) RETURNS TABLE (
        plugin_id UUID,
        handler_function TEXT,
        priority INTEGER
    ) AS $$ BEGIN RETURN QUERY
SELECT ph.plugin_id,
    ph.handler_function,
    ph.priority
FROM plugin_hooks ph
WHERE ph.hook_name = p_hook_name
    AND ph.is_active = true
ORDER BY ph.priority ASC;
END;
$$ LANGUAGE plpgsql;
-- Insert official plugins
INSERT INTO plugins (
        name,
        slug,
        description,
        version,
        author,
        manifest,
        is_official
    )
VALUES (
        'Slack Integration',
        'slack',
        'Send notifications and updates to Slack channels',
        '1.0.0',
        'AlphaClone Systems',
        '{
        "permissions": ["events.subscribe", "notifications.send"],
        "hooks": [
            {"name": "message.sent", "handler": "onMessageSent"},
            {"name": "project.created", "handler": "onProjectCreated"}
        ],
        "settings": [
            {"key": "webhook_url", "type": "string", "label": "Slack Webhook URL", "required": true},
            {"key": "default_channel", "type": "string", "label": "Default Channel", "default": "#general"}
        ]
    }'::jsonb,
        true
    ),
    (
        'Email Notifications',
        'email-notifications',
        'Advanced email notification system with templates',
        '1.0.0',
        'AlphaClone Systems',
        '{
        "permissions": ["events.subscribe", "email.send"],
        "hooks": [
            {"name": "user.created", "handler": "sendWelcomeEmail"},
            {"name": "invoice.created", "handler": "sendInvoiceEmail"}
        ],
        "settings": [
            {"key": "smtp_host", "type": "string", "label": "SMTP Host"},
            {"key": "smtp_port", "type": "number", "label": "SMTP Port", "default": 587},
            {"key": "from_email", "type": "string", "label": "From Email"}
        ]
    }'::jsonb,
        true
    ),
    (
        'Analytics Dashboard',
        'analytics',
        'Advanced analytics and reporting dashboard',
        '1.0.0',
        'AlphaClone Systems',
        '{
        "permissions": ["data.read", "reports.generate"],
        "hooks": [
            {"name": "project.completed", "handler": "trackCompletion"},
            {"name": "invoice.paid", "handler": "trackRevenue"}
        ],
        "ui": {
            "dashboard_widget": {"component": "AnalyticsWidget", "size": "large"}
        }
    }'::jsonb,
        true
    ),
    (
        'Stripe Payments',
        'stripe',
        'Accept payments via Stripe',
        '1.0.0',
        'AlphaClone Systems',
        '{
        "permissions": ["payments.process", "webhooks.receive"],
        "hooks": [
            {"name": "invoice.created", "handler": "createPaymentIntent"}
        ],
        "settings": [
            {"key": "api_key", "type": "string", "label": "Stripe API Key", "required": true, "secret": true},
            {"key": "webhook_secret", "type": "string", "label": "Webhook Secret", "secret": true}
        ]
    }'::jsonb,
        true
    ),
    (
        'Google Calendar Sync',
        'google-calendar',
        'Sync meetings with Google Calendar',
        '1.0.0',
        'AlphaClone Systems',
        '{
        "permissions": ["calendar.read", "calendar.write"],
        "hooks": [
            {"name": "meeting.scheduled", "handler": "createCalendarEvent"},
            {"name": "meeting.cancelled", "handler": "deleteCalendarEvent"}
        ],
        "settings": [
            {"key": "client_id", "type": "string", "label": "Google Client ID", "required": true},
            {"key": "client_secret", "type": "string", "label": "Google Client Secret", "required": true, "secret": true}
        ]
    }'::jsonb,
        true
    ) ON CONFLICT (slug) DO NOTHING;
COMMENT ON TABLE plugins IS 'Plugin registry';
COMMENT ON TABLE tenant_plugins IS 'Installed plugins per tenant';
COMMENT ON TABLE plugin_hooks IS 'Plugin event hooks';
COMMENT ON TABLE plugin_settings IS 'Plugin configuration per tenant';
COMMENT ON TABLE plugin_logs IS 'Plugin execution logs';