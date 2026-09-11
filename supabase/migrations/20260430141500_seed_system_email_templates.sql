-- Migration to add missing system email templates
-- Created: 2026-04-30

INSERT INTO public.email_templates (name, subject, body_html, body_text, tenant_id)
VALUES 
(
    'Daily Summary', 
    'Your AlphaClone Daily Summary - {{summaryDate}}',
    '<h1>Hello {{name}},</h1><p>Here is your summary for {{summaryDate}}.</p><p><a href="{{dashboardUrl}}">View Dashboard</a></p>',
    'Hello {{name}},\n\nHere is your summary for {{summaryDate}}.\n\nView Dashboard: {{dashboardUrl}}',
    NULL
),
(
    'Morning Briefing',
    'Morning Briefing: Your Focus for {{summaryDate}}',
    '<h1>Good morning {{name}},</h1><p><strong>Today\'s Focus:</strong> {{todayFocus}}</p><p><strong>Suggested Improvements:</strong> {{improvements}}</p><p style="font-style: italic; color: #666;">{{motivation}}</p><p><a href="{{dashboardUrl}}">Open Workspace</a></p>',
    'Good morning {{name}},\n\nToday\'s Focus: {{todayFocus}}\n\nSuggested Improvements: {{improvements}}\n\n{{motivation}}\n\nOpen Workspace: {{dashboardUrl}}',
    NULL
),
(
    'AI and Leads Status',
    'Daily AI Quota & Lead Generation Update',
    '<h1>AI Quota Update</h1><p>Plan: {{planName}}</p><p>Used: {{aiLeadsUsed}} / {{aiLeadsLimit}}</p><p>{{quotaMessage}}</p><p><a href="{{dashboardUrl}}">Manage Leads</a></p>',
    'AI Quota Update\n\nPlan: {{planName}}\nUsed: {{aiLeadsUsed}} / {{aiLeadsLimit}}\n\n{{quotaMessage}}\n\nManage Leads: {{dashboardUrl}}',
    NULL
),
(
    'Daily Motivation',
    'Your Daily Spark of Motivation',
    '<div style="text-align: center; padding: 40px; background-color: #f9f9f9; border-radius: 10px;"><h2>Hello {{name}},</h2><p style="font-size: 1.2em; font-style: italic;">{{motivation}}</p><p>Have a productive day!</p><p><a href="{{dashboardUrl}}" style="padding: 10px 20px; background-color: #00bcd4; color: white; text-decoration: none; border-radius: 5px;">Go to AlphaClone</a></p></div>',
    'Hello {{name}},\n\n{{motivation}}\n\nHave a productive day!\n\nGo to AlphaClone: {{dashboardUrl}}',
    NULL
),
(
    'Stay In Touch',
    'Re-engaging with AlphaClone Systems',
    '<h1>We miss you, {{name}}!</h1><p>It\'s been a while. Log back in to see what\'s new.</p><p><a href="{{dashboardUrl}}">Visit Platform</a></p>',
    'We miss you, {{name}}!\n\nIt\'s been a while. Log back in to see what\'s new.\n\nVisit Platform: {{dashboardUrl}}',
    NULL
)
ON CONFLICT (name, tenant_id) DO UPDATE 
SET 
    subject = EXCLUDED.subject,
    body_html = EXCLUDED.body_html,
    body_text = EXCLUDED.body_text;
