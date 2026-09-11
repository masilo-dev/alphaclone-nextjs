-- Morning bundle: priorities / improvements, then AI lead usage vs plan.

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(),
  'Morning Briefing',
  'Start your day — {{summaryDate}}',
  $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Good morning, {{name}}</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">{{summaryDate}}</p>
<h2 style="margin:20px 0 10px;font-size:16px;font-weight:700;color:#e2e8f0;">Focus today</h2>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#cbd5e1;">{{todayFocus}}</p>
<h2 style="margin:20px 0 10px;font-size:16px;font-weight:700;color:#e2e8f0;">What to improve</h2>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cbd5e1;">{{improvements}}</p>
<a href="{{dashboardUrl}}/dashboard" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Open workspace</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">Manage email preferences in your account settings.</p>
</td></tr>
</table>
</body>
</html>$html$,
  $txt$Good morning {{name}}

Focus today:
{{todayFocus}}

What to improve:
{{improvements}}

{{dashboardUrl}}/dashboard
$txt$,
  'transactional',
  '["name","dashboardUrl","summaryDate","todayFocus","improvements"]'::jsonb,
  true,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Morning Briefing' AND e.tenant_id IS NULL);

INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(),
  'AI and Leads Status',
  'Your AI leads usage — {{planName}} plan',
  $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">AI leads and your plan</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Plan: <strong style="color:#e2e8f0;">{{planName}}</strong></p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#94a3b8;">AI leads used today (UTC): <strong style="color:#2dd4bf;">{{aiLeadsUsed}}</strong> / {{aiLeadsLimit}}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#94a3b8;">Remaining today: <strong style="color:#e2e8f0;">{{aiLeadsRemaining}}</strong></p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#64748b;">Resets: {{resetsAt}}</p>
<h2 style="margin:20px 0 10px;font-size:16px;font-weight:700;color:#e2e8f0;">If you are at the limit</h2>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#cbd5e1;">{{quotaMessage}}</p>
<h2 style="margin:20px 0 10px;font-size:16px;font-weight:700;color:#e2e8f0;">What you can unlock</h2>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cbd5e1;">{{missingFeatures}}</p>
<a href="{{upgradeUrl}}" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">View plans</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">AlphaClone Systems</p>
</td></tr>
</table>
</body>
</html>$html$,
  $txt$AI leads status (UTC day)

Plan: {{planName}}
Used: {{aiLeadsUsed}} / {{aiLeadsLimit}}
Remaining: {{aiLeadsRemaining}}
Resets: {{resetsAt}}

{{quotaMessage}}

{{missingFeatures}}

{{upgradeUrl}}
$txt$,
  'transactional',
  '["name","dashboardUrl","planName","aiLeadsUsed","aiLeadsLimit","aiLeadsRemaining","resetsAt","quotaMessage","missingFeatures","upgradeUrl"]'::jsonb,
  true,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'AI and Leads Status' AND e.tenant_id IS NULL);
