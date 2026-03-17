-- =====================================================
-- BUSINESS OS - AI DECISION ENGINE
-- Phase 5: Autonomous Intelligence System
-- =====================================================
-- AI Models Registry
CREATE TABLE IF NOT EXISTS ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (
        type IN (
            'classification',
            'prediction',
            'recommendation',
            'generation'
        )
    ),
    provider VARCHAR(50) NOT NULL DEFAULT 'gemini',
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- AI Decisions Log
CREATE TABLE IF NOT EXISTS ai_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES ai_models(id),
    decision_type VARCHAR(100) NOT NULL,
    context JSONB NOT NULL,
    decision JSONB NOT NULL,
    confidence DECIMAL(5, 4),
    was_correct BOOLEAN,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- AI Learning Data
CREATE TABLE IF NOT EXISTS ai_learning_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL,
    input_data JSONB NOT NULL,
    expected_output JSONB,
    actual_output JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- AI Recommendations
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    action_data JSONB,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (
        priority IN ('low', 'medium', 'high', 'critical')
    ),
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'accepted', 'rejected', 'completed')
    ),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);
-- Indexes
CREATE INDEX idx_ai_decisions_tenant ON ai_decisions(tenant_id);
CREATE INDEX idx_ai_decisions_created ON ai_decisions(created_at DESC);
CREATE INDEX idx_ai_learning_tenant ON ai_learning_data(tenant_id);
CREATE INDEX idx_ai_recommendations_tenant ON ai_recommendations(tenant_id);
CREATE INDEX idx_ai_recommendations_status ON ai_recommendations(status);
-- Insert default AI models
INSERT INTO ai_models (name, type, provider, config)
VALUES (
        'Lead Scoring',
        'classification',
        'gemini',
        '{"model": "gemini-pro", "temperature": 0.3}'::jsonb
    ),
    (
        'Revenue Prediction',
        'prediction',
        'gemini',
        '{"model": "gemini-pro", "temperature": 0.2}'::jsonb
    ),
    (
        'Next Best Action',
        'recommendation',
        'gemini',
        '{"model": "gemini-pro", "temperature": 0.5}'::jsonb
    ),
    (
        'Email Generator',
        'generation',
        'gemini',
        '{"model": "gemini-pro", "temperature": 0.7}'::jsonb
    ) ON CONFLICT DO NOTHING;
COMMENT ON TABLE ai_models IS 'AI model registry';
COMMENT ON TABLE ai_decisions IS 'AI decision history and feedback';
COMMENT ON TABLE ai_learning_data IS 'Training data for AI models';
COMMENT ON TABLE ai_recommendations IS 'AI-generated recommendations';