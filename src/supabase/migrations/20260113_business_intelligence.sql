-- =====================================================
-- BUSINESS OS - BUSINESS INTELLIGENCE
-- Phase 7: Analytics & Reporting System
-- =====================================================
-- Dashboards
CREATE TABLE IF NOT EXISTS dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    layout JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Dashboard Widgets
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    widget_type VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    config JSONB NOT NULL,
    position JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- KPIs (Key Performance Indicators)
CREATE TABLE IF NOT EXISTS kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    metric_type VARCHAR(50) NOT NULL,
    calculation_query TEXT NOT NULL,
    target_value DECIMAL(15, 2),
    current_value DECIMAL(15, 2),
    unit VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- KPI History
CREATE TABLE IF NOT EXISTS kpi_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_id UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
    value DECIMAL(15, 2) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);
-- Reports
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    report_type VARCHAR(50) NOT NULL,
    query TEXT NOT NULL,
    schedule VARCHAR(50),
    last_run_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Analytics Events
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    event_name VARCHAR(100) NOT NULL,
    properties JSONB,
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Indexes
CREATE INDEX idx_dashboards_tenant ON dashboards(tenant_id);
CREATE INDEX idx_dashboard_widgets_dashboard ON dashboard_widgets(dashboard_id);
CREATE INDEX idx_kpis_tenant ON kpis(tenant_id);
CREATE INDEX idx_kpi_history_kpi ON kpi_history(kpi_id);
CREATE INDEX idx_kpi_history_recorded ON kpi_history(recorded_at DESC);
CREATE INDEX idx_reports_tenant ON reports(tenant_id);
CREATE INDEX idx_analytics_events_tenant ON analytics_events(tenant_id);
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_name ON analytics_events(event_name);
-- Function to track analytics event
CREATE OR REPLACE FUNCTION track_analytics_event(
        p_tenant_id UUID,
        p_event_name VARCHAR,
        p_properties JSONB DEFAULT NULL,
        p_user_id UUID DEFAULT NULL
    ) RETURNS VOID AS $$ BEGIN
INSERT INTO analytics_events (tenant_id, event_name, properties, user_id)
VALUES (
        p_tenant_id,
        p_event_name,
        p_properties,
        p_user_id
    );
END;
$$ LANGUAGE plpgsql;
-- Function to update KPI value
CREATE OR REPLACE FUNCTION update_kpi_value(p_kpi_id UUID, p_value DECIMAL) RETURNS VOID AS $$ BEGIN -- Update current value
UPDATE kpis
SET current_value = p_value,
    updated_at = NOW()
WHERE id = p_kpi_id;
-- Record in history
INSERT INTO kpi_history (kpi_id, value)
VALUES (p_kpi_id, p_value);
END;
$$ LANGUAGE plpgsql;
-- Function to get dashboard data
CREATE OR REPLACE FUNCTION get_dashboard_data(p_dashboard_id UUID) RETURNS TABLE (
        widget_id UUID,
        widget_type VARCHAR,
        title VARCHAR,
        data JSONB
    ) AS $$ BEGIN RETURN QUERY
SELECT dw.id,
    dw.widget_type,
    dw.title,
    dw.config
FROM dashboard_widgets dw
WHERE dw.dashboard_id = p_dashboard_id
ORDER BY (dw.position->>'row')::int,
    (dw.position->>'col')::int;
END;
$$ LANGUAGE plpgsql;
-- Insert default KPIs
INSERT INTO kpis (
        tenant_id,
        name,
        description,
        metric_type,
        calculation_query,
        unit
    )
SELECT t.id,
    'Monthly Revenue',
    'Total revenue for the current month',
    'revenue',
    'SELECT SUM(amount) FROM invoices WHERE status = ''paid'' AND EXTRACT(MONTH FROM paid_at) = EXTRACT(MONTH FROM NOW())',
    'USD'
FROM tenants t ON CONFLICT DO NOTHING;
COMMENT ON TABLE dashboards IS 'Custom dashboard configurations';
COMMENT ON TABLE dashboard_widgets IS 'Dashboard widget definitions';
COMMENT ON TABLE kpis IS 'Key Performance Indicators';
COMMENT ON TABLE kpi_history IS 'Historical KPI values';
COMMENT ON TABLE reports IS 'Scheduled reports';
COMMENT ON TABLE analytics_events IS 'Analytics event tracking';