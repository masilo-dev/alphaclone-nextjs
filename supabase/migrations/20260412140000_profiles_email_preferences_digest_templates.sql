-- Email engagement: per-profile preferences, digest scheduling, and platform templates.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_preferences JSONB NOT NULL DEFAULT '{"digest": true, "product_updates": true, "reminders": true}'::jsonb;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.email_preferences IS 'Opt-in flags for platform emails (digest, product_updates, reminders).';
COMMENT ON COLUMN public.profiles.last_digest_sent_at IS 'Last time a daily summary email was sent to this profile.';

-- Daily Summary (cron)
INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(),
  'Daily Summary',
  'Your AlphaClone daily summary — {{summaryDate}}',
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
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Daily summary</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Hi {{name}}, here is your quick snapshot for <span style="color:#e2e8f0;">{{summaryDate}}</span>.</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Open your workspace to review projects, tasks, and messages. You can turn these emails off anytime in account settings.</p>
<a href="{{dashboardUrl}}/dashboard" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Go to dashboard</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  $txt$Daily summary

Hi {{name}}, snapshot for {{summaryDate}}.

Dashboard: {{dashboardUrl}}/dashboard

AlphaClone Systems$txt$,
  'transactional',
  '["name","email","dashboardUrl","summaryDate"]'::jsonb,
  true,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Daily Summary' AND e.tenant_id IS NULL);

UPDATE public.email_templates SET
  subject = 'Your AlphaClone daily summary — {{summaryDate}}',
  category = 'transactional',
  variables = '["name","email","dashboardUrl","summaryDate"]'::jsonb,
  is_system = true,
  updated_at = now()
WHERE name = 'Daily Summary' AND tenant_id IS NULL;

-- Stay in touch (onboarding / reminders; send from workflows or future jobs)
INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(),
  'Stay In Touch',
  'How we stay in touch at AlphaClone',
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
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f8fafc;">Staying in touch</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">Hi {{name}}, we use email for important account updates, optional daily summaries, and reminders when work is ready for you.</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8;">You control product and digest messages from your account settings. Security and billing notices may still be sent when required.</p>
<a href="{{dashboardUrl}}/dashboard" style="display:inline-block;padding:12px 24px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Open dashboard</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This message was sent by AlphaClone Systems.</p>
</td></tr>
</table>
</body>
</html>$html$,
  $txt$Staying in touch

Hi {{name}}, we use email for account updates, optional daily summaries, and reminders.

Dashboard: {{dashboardUrl}}/dashboard

AlphaClone Systems$txt$,
  'transactional',
  '["name","email","dashboardUrl"]'::jsonb,
  true,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Stay In Touch' AND e.tenant_id IS NULL);

UPDATE public.email_templates SET
  subject = 'How we stay in touch at AlphaClone',
  category = 'transactional',
  variables = '["name","email","dashboardUrl"]'::jsonb,
  is_system = true,
  updated_at = now()
WHERE name = 'Stay In Touch' AND tenant_id IS NULL;
