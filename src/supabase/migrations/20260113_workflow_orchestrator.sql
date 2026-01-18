-- =====================================================
-- BUSINESS OS - WORKFLOW ORCHESTRATOR
-- Phase 2: Workflow Automation System
-- =====================================================
-- Workflow Definitions Table
-- Stores workflow templates and configurations
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    definition JSONB NOT NULL,
    trigger_config JSONB,
    is_active BOOLEAN DEFAULT true,
    is_template BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Workflow Instances Table
-- Tracks individual workflow executions
CREATE TABLE IF NOT EXISTS workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'running' CHECK (
        status IN (
            'pending',
            'running',
            'paused',
            'completed',
            'failed',
            'cancelled'
        )
    ),
    current_step VARCHAR(100),
    context JSONB DEFAULT '{}',
    input_data JSONB,
    output_data JSONB,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0
);
-- Workflow Steps Table
-- Logs each step execution
CREATE TABLE IF NOT EXISTS workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_id VARCHAR(100) NOT NULL,
    step_name VARCHAR(200) NOT NULL,
    step_type VARCHAR(50) NOT NULL,
    input_data JSONB,
    output_data JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'running',
            'completed',
            'failed',
            'skipped'
        )
    ),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    execution_time_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0
);
-- Workflow Templates Table
-- Pre-built workflow templates
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    definition JSONB NOT NULL,
    is_official BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Workflow Schedules Table
-- For scheduled/recurring workflows
CREATE TABLE IF NOT EXISTS workflow_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    schedule_type VARCHAR(20) NOT NULL CHECK (
        schedule_type IN ('once', 'daily', 'weekly', 'monthly', 'cron')
    ),
    schedule_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add missing columns to workflows table if they don't exist
DO $$ BEGIN -- Add is_template column if it doesn't exist
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'workflows'
        AND column_name = 'is_template'
) THEN
ALTER TABLE workflows
ADD COLUMN is_template BOOLEAN DEFAULT false;
END IF;
-- Add version column if it doesn't exist
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'workflows'
        AND column_name = 'version'
) THEN
ALTER TABLE workflows
ADD COLUMN version INTEGER DEFAULT 1;
END IF;
-- Add created_by column if it doesn't exist
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'workflows'
        AND column_name = 'created_by'
) THEN
ALTER TABLE workflows
ADD COLUMN created_by UUID REFERENCES users(id);
END IF;
END $$;
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active)
WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflows_template ON workflows(is_template)
WHERE is_template = true;
CREATE INDEX IF NOT EXISTS idx_instances_workflow ON workflow_instances(workflow_id);
CREATE INDEX IF NOT EXISTS idx_instances_status ON workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_instances_started ON workflow_instances(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_steps_instance ON workflow_steps(instance_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON workflow_steps(status);
CREATE INDEX IF NOT EXISTS idx_schedules_active ON workflow_schedules(is_active)
WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON workflow_schedules(next_run_at)
WHERE is_active = true;
-- Function to create workflow instance
CREATE OR REPLACE FUNCTION create_workflow_instance(
        p_workflow_id UUID,
        p_input_data JSONB DEFAULT '{}'
    ) RETURNS UUID AS $$
DECLARE v_instance_id UUID;
BEGIN
INSERT INTO workflow_instances (workflow_id, input_data, context)
VALUES (p_workflow_id, p_input_data, p_input_data)
RETURNING id INTO v_instance_id;
RETURN v_instance_id;
END;
$$ LANGUAGE plpgsql;
-- Function to update workflow instance status
CREATE OR REPLACE FUNCTION update_workflow_instance_status(
        p_instance_id UUID,
        p_status VARCHAR,
        p_current_step VARCHAR DEFAULT NULL,
        p_error_message TEXT DEFAULT NULL
    ) RETURNS VOID AS $$ BEGIN
UPDATE workflow_instances
SET status = p_status,
    current_step = COALESCE(p_current_step, current_step),
    error_message = p_error_message,
    completed_at = CASE
        WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW()
        ELSE completed_at
    END
WHERE id = p_instance_id;
END;
$$ LANGUAGE plpgsql;
-- Function to log workflow step
CREATE OR REPLACE FUNCTION log_workflow_step(
        p_instance_id UUID,
        p_step_id VARCHAR,
        p_step_name VARCHAR,
        p_step_type VARCHAR,
        p_status VARCHAR,
        p_input_data JSONB DEFAULT NULL,
        p_output_data JSONB DEFAULT NULL,
        p_error_message TEXT DEFAULT NULL,
        p_execution_time_ms INTEGER DEFAULT NULL
    ) RETURNS UUID AS $$
DECLARE v_step_log_id UUID;
BEGIN
INSERT INTO workflow_steps (
        instance_id,
        step_id,
        step_name,
        step_type,
        status,
        input_data,
        output_data,
        error_message,
        execution_time_ms,
        started_at,
        completed_at
    )
VALUES (
        p_instance_id,
        p_step_id,
        p_step_name,
        p_step_type,
        p_status,
        p_input_data,
        p_output_data,
        p_error_message,
        p_execution_time_ms,
        CASE
            WHEN p_status = 'running' THEN NOW()
            ELSE NULL
        END,
        CASE
            WHEN p_status IN ('completed', 'failed', 'skipped') THEN NOW()
            ELSE NULL
        END
    )
RETURNING id INTO v_step_log_id;
RETURN v_step_log_id;
END;
$$ LANGUAGE plpgsql;
-- Function to get pending workflow instances
CREATE OR REPLACE FUNCTION get_pending_workflows(p_limit INTEGER DEFAULT 10) RETURNS TABLE (
        id UUID,
        workflow_id UUID,
        current_step VARCHAR,
        context JSONB
    ) AS $$ BEGIN RETURN QUERY
SELECT wi.id,
    wi.workflow_id,
    wi.current_step,
    wi.context
FROM workflow_instances wi
WHERE wi.status = 'pending'
ORDER BY wi.started_at ASC
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
-- Function to get workflow statistics
CREATE OR REPLACE FUNCTION get_workflow_stats(p_workflow_id UUID DEFAULT NULL) RETURNS TABLE (
        total_runs BIGINT,
        successful_runs BIGINT,
        failed_runs BIGINT,
        avg_execution_time_ms NUMERIC
    ) AS $$ BEGIN RETURN QUERY
SELECT COUNT(*) as total_runs,
    COUNT(*) FILTER (
        WHERE status = 'completed'
    ) as successful_runs,
    COUNT(*) FILTER (
        WHERE status = 'failed'
    ) as failed_runs,
    AVG(
        EXTRACT(
            EPOCH
            FROM (completed_at - started_at)
        ) * 1000
    )::NUMERIC as avg_execution_time_ms
FROM workflow_instances
WHERE (
        p_workflow_id IS NULL
        OR workflow_id = p_workflow_id
    )
    AND status IN ('completed', 'failed');
END;
$$ LANGUAGE plpgsql;
-- Trigger to publish workflow events
CREATE OR REPLACE FUNCTION notify_workflow_event() RETURNS TRIGGER AS $$ BEGIN -- Publish workflow started event
    IF TG_OP = 'INSERT' THEN PERFORM publish_event(
        'workflow.started',
        'workflow_orchestrator',
        jsonb_build_object(
            'instanceId',
            NEW.id,
            'workflowId',
            NEW.workflow_id
        )
    );
END IF;
-- Publish workflow completed/failed event
IF TG_OP = 'UPDATE'
AND OLD.status != NEW.status THEN IF NEW.status = 'completed' THEN PERFORM publish_event(
    'workflow.completed',
    'workflow_orchestrator',
    jsonb_build_object(
        'instanceId',
        NEW.id,
        'workflowId',
        NEW.workflow_id,
        'outputData',
        NEW.output_data
    )
);
ELSIF NEW.status = 'failed' THEN PERFORM publish_event(
    'workflow.failed',
    'workflow_orchestrator',
    jsonb_build_object(
        'instanceId',
        NEW.id,
        'workflowId',
        NEW.workflow_id,
        'error',
        NEW.error_message
    )
);
END IF;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_workflow_events
AFTER
INSERT
    OR
UPDATE ON workflow_instances FOR EACH ROW EXECUTE FUNCTION notify_workflow_event();
-- Insert default workflow templates
INSERT INTO workflow_templates (
        name,
        category,
        description,
        icon,
        definition,
        is_official
    )
VALUES (
        'Client Onboarding',
        'Sales',
        'Automated client onboarding workflow with welcome email, project creation, and kickoff meeting',
        '👋',
        '{
        "trigger": {"type": "event", "event": "client.created"},
        "steps": [
            {"id": "welcome_email", "type": "email", "config": {"template": "welcome", "to": "{{client.email}}"}},
            {"id": "create_project", "type": "action", "config": {"action": "createProject"}},
            {"id": "schedule_meeting", "type": "meeting", "config": {"duration": 60}}
        ]
    }'::jsonb,
        true
    ),
    (
        'Invoice Follow-up',
        'Finance',
        'Automated invoice follow-up for overdue payments',
        '💰',
        '{
        "trigger": {"type": "event", "event": "invoice.overdue"},
        "steps": [
            {"id": "send_reminder", "type": "email", "config": {"template": "payment_reminder"}},
            {"id": "wait_3_days", "type": "wait", "config": {"duration": "3d"}},
            {"id": "send_final_notice", "type": "email", "config": {"template": "final_notice"}},
            {"id": "create_task", "type": "action", "config": {"action": "createFollowUpTask"}}
        ]
    }'::jsonb,
        true
    ),
    (
        'Project Completion',
        'Project Management',
        'Workflow triggered when project is completed',
        '✅',
        '{
        "trigger": {"type": "event", "event": "project.completed"},
        "steps": [
            {"id": "generate_invoice", "type": "action", "config": {"action": "generateFinalInvoice"}},
            {"id": "send_completion_email", "type": "email", "config": {"template": "project_complete"}},
            {"id": "request_feedback", "type": "email", "config": {"template": "feedback_request"}},
            {"id": "archive_project", "type": "action", "config": {"action": "archiveProject"}}
        ]
    }'::jsonb,
        true
    ) ON CONFLICT DO NOTHING;
COMMENT ON TABLE workflows IS 'Workflow definitions and configurations';
COMMENT ON TABLE workflow_instances IS 'Individual workflow execution instances';
COMMENT ON TABLE workflow_steps IS 'Step-by-step execution logs';
COMMENT ON TABLE workflow_templates IS 'Pre-built workflow templates';
COMMENT ON TABLE workflow_schedules IS 'Scheduled workflow executions';