-- Migration: Fix Tenant Creation and Event Bus RLS
-- Created: 2026-05-13
-- Description: 
-- 1. Updates publish_event to support tenant_id.
-- 2. Updates create_tenant to correctly publish events with tenant_id.
-- 3. Fixes events RLS to allow system events (NULL tenant_id).
-- 4. Ensures "Welcome Email" template exists for new users.

-- 1. Update publish_event signature and implementation
CREATE OR REPLACE FUNCTION public.publish_event(
    p_event_type VARCHAR,
    p_event_source VARCHAR,
    p_event_data JSONB,
    p_metadata JSONB DEFAULT '{}',
    p_tenant_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_event_id UUID;
BEGIN
    INSERT INTO public.events (event_type, event_source, event_data, metadata, tenant_id)
    VALUES (
        p_event_type,
        p_event_source,
        p_event_data,
        p_metadata,
        p_tenant_id
    )
    RETURNING id INTO v_event_id;
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER ensures it can bypass some RLS if needed, but we still want RLS on the table

-- 2. Update create_tenant to pass tenant_id
CREATE OR REPLACE FUNCTION public.create_tenant(
    p_name VARCHAR,
    p_slug VARCHAR,
    p_admin_user_id UUID,
    p_plan VARCHAR DEFAULT 'free'
) RETURNS UUID AS $$
DECLARE v_tenant_id UUID;
BEGIN 
    -- Create tenant
    INSERT INTO public.tenants (name, slug, subscription_plan)
    VALUES (p_name, p_slug, p_plan)
    RETURNING id INTO v_tenant_id;

    -- Add admin user
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (v_tenant_id, p_admin_user_id, 'admin');

    -- Publish tenant created event (NOW WITH TENANT_ID)
    PERFORM public.publish_event(
        'tenant.created',
        'tenant_service',
        jsonb_build_object(
            'tenantId', v_tenant_id,
            'name', p_name,
            'adminUserId', p_admin_user_id
        ),
        '{}',
        v_tenant_id
    );

    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix events RLS policy to allow NULL tenant_id (System Events)
DROP POLICY IF EXISTS tenant_isolation_policy ON public.events;
CREATE POLICY tenant_isolation_policy ON public.events
FOR ALL USING (
    tenant_id IS NULL OR 
    tenant_id IN (
        SELECT tenant_id
        FROM public.tenant_users
        WHERE user_id = auth.uid()
    )
);

-- 5. Add Global Platform Templates
-- Ensure unique index exists for the ON CONFLICT clause
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_name_global ON public.email_templates (name) WHERE tenant_id IS NULL;

-- Welcome Email
INSERT INTO public.email_templates (name, subject, body_html, body_text, tenant_id)
VALUES (
    'Welcome Email',
    'Welcome to AlphaClone!',
    '<h1>Welcome to AlphaClone!</h1><p>Hi {{name}},</p><p>We are excited to have you on board. Your organization is now ready to use.</p><p><a href="{{dashboardUrl}}">Go to Dashboard</a></p>',
    'Welcome to AlphaClone! Hi {{name}}, we are excited to have you on board. Your organization is now ready to use. Go to Dashboard: {{dashboardUrl}}',
    NULL
) ON CONFLICT (name) WHERE tenant_id IS NULL DO UPDATE 
SET subject = EXCLUDED.subject, body_html = EXCLUDED.body_html, body_text = EXCLUDED.body_text;

-- Morning Briefing
INSERT INTO public.email_templates (name, subject, body_html, body_text, tenant_id)
VALUES (
    'Morning Briefing',
    'Your Morning Briefing - {{summaryDate}}',
    '<h1>Good Morning, {{name}}</h1><p>Here is your focus for today: <strong>{{todayFocus}}</strong></p><p>Suggested improvements: {{improvements}}</p><p><em>{{motivation}}</em></p><p><a href="{{dashboardUrl}}">Open Dashboard</a></p>',
    'Good Morning, {{name}}. Your focus today: {{todayFocus}}. Improvements: {{improvements}}. Motivation: {{motivation}}. Open Dashboard: {{dashboardUrl}}',
    NULL
) ON CONFLICT (name) WHERE tenant_id IS NULL DO UPDATE 
SET subject = EXCLUDED.subject, body_html = EXCLUDED.body_html, body_text = EXCLUDED.body_text;

-- AI and Leads Status
INSERT INTO public.email_templates (name, subject, body_html, body_text, tenant_id)
VALUES (
    'AI and Leads Status',
    'AI Leads Usage Snapshot',
    '<h1>AI & Leads Status</h1><p>Hi {{name}},</p><p>You are currently on the <strong>{{planName}}</strong> plan.</p><ul><li>Credits Used: {{aiLeadsUsed}}</li><li>Credits Limit: {{aiLeadsLimit}}</li><li>Credits Remaining: {{aiLeadsRemaining}}</li></ul><p>{{quotaMessage}}</p><p><a href="{{upgradeUrl}}">Upgrade Plan</a></p>',
    'AI & Leads Status: Hi {{name}}, you are on {{planName}}. Used: {{aiLeadsUsed}}, Limit: {{aiLeadsLimit}}, Remaining: {{aiLeadsRemaining}}. {{quotaMessage}}',
    NULL
) ON CONFLICT (name) WHERE tenant_id IS NULL DO UPDATE 
SET subject = EXCLUDED.subject, body_html = EXCLUDED.body_html, body_text = EXCLUDED.body_text;

-- Daily Summary
INSERT INTO public.email_templates (name, subject, body_html, body_text, tenant_id)
VALUES (
    'Daily Summary',
    'Daily Summary - {{summaryDate}}',
    '<h1>Daily Summary</h1><p>Hi {{name}},</p><p>Here is a summary of your activity for {{summaryDate}}.</p><p><a href="{{dashboardUrl}}">View Full Report</a></p>',
    'Daily Summary: Hi {{name}}, here is your summary for {{summaryDate}}. View Full Report: {{dashboardUrl}}',
    NULL
) ON CONFLICT (name) WHERE tenant_id IS NULL DO UPDATE 
SET subject = EXCLUDED.subject, body_html = EXCLUDED.body_html, body_text = EXCLUDED.body_text;

-- Stay In Touch
INSERT INTO public.email_templates (name, subject, body_html, body_text, tenant_id)
VALUES (
    'Stay In Touch',
    'Don''t lose your momentum!',
    '<h1>Keep Growing, {{name}}</h1><p>{{focusArea}}</p><p>We noticed you haven''t reached your full potential yet. Let''s get back to work!</p><p><a href="{{dashboardUrl}}">Go to App</a></p>',
    'Keep Growing, {{name}}. {{focusArea}} We noticed you haven''t reached your full potential yet. Go to App: {{dashboardUrl}}',
    NULL
) ON CONFLICT (name) WHERE tenant_id IS NULL DO UPDATE 
SET subject = EXCLUDED.subject, body_html = EXCLUDED.body_html, body_text = EXCLUDED.body_text;

-- Daily Motivation
INSERT INTO public.email_templates (name, subject, body_html, body_text, tenant_id)
VALUES (
    'Daily Motivation',
    'Daily Motivation',
    '<h1>Daily Motivation</h1><p>Hi {{name}},</p><p><em>{{motivation}}</em></p><p>Keep pushing forward!</p><p><a href="{{dashboardUrl}}">Open App</a></p>',
    'Daily Motivation: Hi {{name}}, {{motivation}}. Keep pushing forward!',
    NULL
) ON CONFLICT (name) WHERE tenant_id IS NULL DO UPDATE 
SET subject = EXCLUDED.subject, body_html = EXCLUDED.body_html, body_text = EXCLUDED.body_text;

-- Invoice Sent
INSERT INTO public.email_templates (name, subject, body_html, body_text, tenant_id)
VALUES (
    'invoiceSent',
    'New Invoice: {{invoiceNumber}}',
    '<h1>New Invoice</h1><p>Hi {{recipientName}},</p><p>{{workspaceName}} has sent you a new invoice for <strong>{{amount}} {{currency}}</strong>.</p><p>Due Date: {{dueDate}}</p><p><a href="{{actionUrl}}">View & Pay Invoice</a></p>',
    'New Invoice: Hi {{recipientName}}, {{workspaceName}} sent you an invoice for {{amount}} {{currency}}. Due: {{dueDate}}. View & Pay: {{actionUrl}}',
    NULL
) ON CONFLICT (name) WHERE tenant_id IS NULL DO UPDATE 
SET subject = EXCLUDED.subject, body_html = EXCLUDED.body_html, body_text = EXCLUDED.body_text;

-- Invoice Overdue
INSERT INTO public.email_templates (name, subject, body_html, body_text, tenant_id)
VALUES (
    'invoiceOverdue',
    'Invoice Overdue: {{invoiceNumber}}',
    '<h1 style="color: #ef4444;">Invoice Overdue</h1><p>Hi {{recipientName}},</p><p>This is a reminder that invoice <strong>{{invoiceNumber}}</strong> from {{workspaceName}} is now past due.</p><p>Amount: {{amount}} {{currency}}</p><p><a href="{{actionUrl}}">Pay Now</a></p>',
    'Invoice Overdue: Hi {{recipientName}}, invoice {{invoiceNumber}} is past due. Amount: {{amount}} {{currency}}. Pay Now: {{actionUrl}}',
    NULL
) ON CONFLICT (name) WHERE tenant_id IS NULL DO UPDATE 
SET subject = EXCLUDED.subject, body_html = EXCLUDED.body_html, body_text = EXCLUDED.body_text;
