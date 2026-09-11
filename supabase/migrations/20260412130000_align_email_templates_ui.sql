-- System email templates: visual alignment with dashboard (slate-900 / slate-800 / teal accents).
-- Safe for re-run: INSERT only when missing, UPDATE refreshes content for tenant_id IS NULL rows.

-- Welcome Email
INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(),
  'Welcome Email',
  'Welcome to AlphaClone Systems',
  $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Welcome, {{name}}</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Thank you for creating an account. Your workspace is ready.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#94a3b8;">Sign-in email: <span style="color:#e2e8f0;">{{email}}</span></p>
<a href="https://alphaclone.tech" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Open AlphaClone</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  $txt$Welcome, {{name}}

Thank you for creating an account. Your workspace is ready.
Sign-in email: {{email}}

Open AlphaClone: https://alphaclone.tech

AlphaClone Systems$txt$,
  'transactional',
  '["name","email"]'::jsonb,
  true,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Welcome Email' AND e.tenant_id IS NULL);

-- Payment Confirmation
INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(),
  'Payment Confirmation',
  'Payment received — {{projectName}}',
  $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Payment confirmed</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Hi {{name}}, we have received your payment.</p>
<p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#2dd4bf;">{{amount}} {{currency}}</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Project: <span style="color:#e2e8f0;">{{projectName}}</span></p>
<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#64748b;">Invoice reference: {{invoiceId}}</p>
<a href="https://alphaclone.tech" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">View workspace</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  $txt$Payment confirmed

Hi {{name}}, we have received your payment.

Amount: {{amount}} {{currency}}
Project: {{projectName}}
Invoice reference: {{invoiceId}}

AlphaClone Systems$txt$,
  'transactional',
  '["name","amount","currency","projectName","invoiceId"]'::jsonb,
  true,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Payment Confirmation' AND e.tenant_id IS NULL);

UPDATE public.email_templates SET
  subject = 'Payment received — {{projectName}}',
  body_html = $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Payment confirmed</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Hi {{name}}, we have received your payment.</p>
<p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#2dd4bf;">{{amount}} {{currency}}</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Project: <span style="color:#e2e8f0;">{{projectName}}</span></p>
<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#64748b;">Invoice reference: {{invoiceId}}</p>
<a href="https://alphaclone.tech" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">View workspace</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  body_text = $txt$Payment confirmed

Hi {{name}}, we have received your payment.

Amount: {{amount}} {{currency}}
Project: {{projectName}}
Invoice reference: {{invoiceId}}

AlphaClone Systems$txt$,
  category = 'transactional',
  variables = '["name","amount","currency","projectName","invoiceId"]'::jsonb,
  is_system = true,
  updated_at = now()
WHERE name = 'Payment Confirmation' AND tenant_id IS NULL;

-- Project Review Ready (used by projectStageService)
INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(),
  'Project Review Ready',
  'Ready for review: {{projectName}}',
  $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Your project is ready for review</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Hi {{name}}, <span style="color:#e2e8f0;">{{projectName}}</span> has reached the review stage.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#94a3b8;">Open the preview environment to test and share feedback.</p>
<a href="{{deploymentUrl}}" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Open deployment</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  $txt$Hi {{name}},

Your project {{projectName}} is ready for review.

Open deployment: {{deploymentUrl}}

AlphaClone Systems$txt$,
  'transactional',
  '["name","projectName","deploymentUrl"]'::jsonb,
  true,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Project Review Ready' AND e.tenant_id IS NULL);

UPDATE public.email_templates SET
  subject = 'Ready for review: {{projectName}}',
  body_html = $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Your project is ready for review</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Hi {{name}}, <span style="color:#e2e8f0;">{{projectName}}</span> has reached the review stage.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#94a3b8;">Open the preview environment to test and share feedback.</p>
<a href="{{deploymentUrl}}" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Open deployment</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  body_text = $txt$Hi {{name}},

Your project {{projectName}} is ready for review.

Open deployment: {{deploymentUrl}}

AlphaClone Systems$txt$,
  category = 'transactional',
  variables = '["name","projectName","deploymentUrl"]'::jsonb,
  is_system = true,
  updated_at = now()
WHERE name = 'Project Review Ready' AND tenant_id IS NULL;

-- Invoice Reminder
INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(),
  'Invoice Reminder',
  'Invoice due: {{invoiceNumber}}',
  $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Payment reminder</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Hi {{name}}, this is a friendly reminder that invoice <span style="color:#e2e8f0;">{{invoiceNumber}}</span> is due on <span style="color:#e2e8f0;">{{dueDate}}</span>.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#94a3b8;">If you have already paid, you can disregard this message.</p>
<a href="https://alphaclone.tech" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">View invoice</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  $txt$Payment reminder

Hi {{name}}, invoice {{invoiceNumber}} is due on {{dueDate}}.

AlphaClone Systems$txt$,
  'transactional',
  '["name","invoiceNumber","dueDate"]'::jsonb,
  true,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Invoice Reminder' AND e.tenant_id IS NULL);

UPDATE public.email_templates SET
  subject = 'Invoice due: {{invoiceNumber}}',
  body_html = $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Payment reminder</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Hi {{name}}, this is a friendly reminder that invoice <span style="color:#e2e8f0;">{{invoiceNumber}}</span> is due on <span style="color:#e2e8f0;">{{dueDate}}</span>.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#94a3b8;">If you have already paid, you can disregard this message.</p>
<a href="https://alphaclone.tech" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">View invoice</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  body_text = $txt$Payment reminder

Hi {{name}}, invoice {{invoiceNumber}} is due on {{dueDate}}.

AlphaClone Systems$txt$,
  category = 'transactional',
  variables = '["name","invoiceNumber","dueDate"]'::jsonb,
  is_system = true,
  updated_at = now()
WHERE name = 'Invoice Reminder' AND tenant_id IS NULL;

-- Deployment Confirmation
INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(),
  'Deployment Confirmation',
  'Deployment live: {{projectName}}',
  $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Deployment is live</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Hi {{name}}, <span style="color:#e2e8f0;">{{projectName}}</span> has been deployed successfully.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#94a3b8;">You can open the environment using the link below.</p>
<a href="{{deploymentUrl}}" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Open site</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  $txt$Deployment is live

Hi {{name}}, {{projectName}} has been deployed.

Open site: {{deploymentUrl}}

AlphaClone Systems$txt$,
  'transactional',
  '["name","projectName","deploymentUrl"]'::jsonb,
  true,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Deployment Confirmation' AND e.tenant_id IS NULL);

UPDATE public.email_templates SET
  subject = 'Deployment live: {{projectName}}',
  body_html = $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Deployment is live</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Hi {{name}}, <span style="color:#e2e8f0;">{{projectName}}</span> has been deployed successfully.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#94a3b8;">You can open the environment using the link below.</p>
<a href="{{deploymentUrl}}" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Open site</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  body_text = $txt$Deployment is live

Hi {{name}}, {{projectName}} has been deployed.

Open site: {{deploymentUrl}}

AlphaClone Systems$txt$,
  category = 'transactional',
  variables = '["name","projectName","deploymentUrl"]'::jsonb,
  is_system = true,
  updated_at = now()
WHERE name = 'Deployment Confirmation' AND tenant_id IS NULL;

-- Project Update
INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(),
  'Project Update',
  'Update: {{projectName}}',
  $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Project update</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Hi {{name}}, here is an update on <span style="color:#e2e8f0;">{{projectName}}</span>.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cbd5e1;">{{updateSummary}}</p>
<a href="https://alphaclone.tech" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Open project</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  $txt$Project update

Hi {{name}}, update on {{projectName}}:

{{updateSummary}}

AlphaClone Systems$txt$,
  'transactional',
  '["name","projectName","updateSummary"]'::jsonb,
  true,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Project Update' AND e.tenant_id IS NULL);

UPDATE public.email_templates SET
  subject = 'Update: {{projectName}}',
  body_html = $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Project update</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Hi {{name}}, here is an update on <span style="color:#e2e8f0;">{{projectName}}</span>.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cbd5e1;">{{updateSummary}}</p>
<a href="https://alphaclone.tech" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Open project</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  body_text = $txt$Project update

Hi {{name}}, update on {{projectName}}:

{{updateSummary}}

AlphaClone Systems$txt$,
  category = 'transactional',
  variables = '["name","projectName","updateSummary"]'::jsonb,
  is_system = true,
  updated_at = now()
WHERE name = 'Project Update' AND tenant_id IS NULL;

-- Welcome Email (refresh existing global rows)
UPDATE public.email_templates SET
  subject = 'Welcome to AlphaClone Systems',
  body_html = $html$<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#14b8a6;">AlphaClone Systems</p>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Welcome, {{name}}</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Thank you for creating an account. Your workspace is ready.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#94a3b8;">Sign-in email: <span style="color:#e2e8f0;">{{email}}</span></p>
<a href="https://alphaclone.tech" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Open AlphaClone</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  body_text = $txt$Welcome, {{name}}

Thank you for creating an account. Your workspace is ready.
Sign-in email: {{email}}

Open AlphaClone: https://alphaclone.tech

AlphaClone Systems$txt$,
  category = 'transactional',
  variables = '["name","email"]'::jsonb,
  is_system = true,
  updated_at = now()
WHERE name = 'Welcome Email' AND tenant_id IS NULL;
