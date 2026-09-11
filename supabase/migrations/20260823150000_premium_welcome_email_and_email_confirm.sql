-- Migration: Premium Welcome Email Template Redesign + Email Confirmation Template
-- Date: 2026-08-23
-- Updates the Welcome Email to a premium, conversion-oriented design.
-- Adds variables: trial_ends_at, workspace_name (backwards-compatible; fallback gracefully if missing).

UPDATE public.email_templates SET
  subject = 'Your AlphaClone workspace is ready — welcome, {{name}}',
  body_html = $html$<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AlphaClone Systems</title>
</head>
<body style="margin:0;padding:0;background-color:#060d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

<!-- Outer wrapper -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#060d1a;padding:40px 16px 48px;">
  <tr><td align="center">

  <!-- Card -->
  <table role="presentation" width="100%" style="max-width:580px;background-color:#0d1a2e;border:1px solid #1e3a5f;border-radius:20px;overflow:hidden;">

    <!-- Hero accent bar -->
    <tr>
      <td style="background:linear-gradient(90deg,#0f766e 0%,#0284c7 100%);height:4px;font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <!-- Header -->
    <tr>
      <td style="padding:36px 40px 0 40px;">
        <p style="margin:0 0 28px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#2dd4bf;">AlphaClone Systems</p>
        <h1 style="margin:0 0 8px;font-size:30px;font-weight:800;line-height:1.2;color:#f0f9ff;">Your workspace is live,<br>{{name}}.</h1>
        <p style="margin:0 0 0;font-size:16px;line-height:1.65;color:#64748b;">14-day trial · No credit card required · Cancel any time</p>
      </td>
    </tr>

    <!-- Divider -->
    <tr><td style="padding:28px 40px 0;"><div style="height:1px;background:#1e3a5f;"></div></td></tr>

    <!-- Workspace callout -->
    <tr>
      <td style="padding:28px 40px 0 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a1628;border:1px solid #1e3a5f;border-radius:12px;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#475569;">Your workspace</p>
              <p style="margin:0;font-size:20px;font-weight:700;color:#e2e8f0;">{{workspace_name}}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Steps -->
    <tr>
      <td style="padding:28px 40px 0 40px;">
        <p style="margin:0 0 16px;font-size:14px;font-weight:700;color:#94a3b8;letter-spacing:0.05em;text-transform:uppercase;">Start here in 3 steps</p>
        <!-- Step 1 -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:12px;">
          <tr>
            <td width="36" valign="top" style="padding-top:2px;">
              <div style="width:28px;height:28px;background:linear-gradient(135deg,#0f766e,#0284c7);border-radius:8px;display:inline-block;text-align:center;line-height:28px;font-size:13px;font-weight:800;color:#ffffff;">1</div>
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:15px;font-weight:700;color:#e2e8f0;">Add a real customer or lead</p>
              <p style="margin:4px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Import from LinkedIn, CSV, or add them manually. AlphaClone starts surfacing value immediately.</p>
            </td>
          </tr>
        </table>
        <!-- Step 2 -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:12px;">
          <tr>
            <td width="36" valign="top" style="padding-top:2px;">
              <div style="width:28px;height:28px;background:linear-gradient(135deg,#0f766e,#0284c7);border-radius:8px;display:inline-block;text-align:center;line-height:28px;font-size:13px;font-weight:800;color:#ffffff;">2</div>
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:15px;font-weight:700;color:#e2e8f0;">Create a task or open project</p>
              <p style="margin:4px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Capture the work that is currently scattered across emails, notes, and your head.</p>
            </td>
          </tr>
        </table>
        <!-- Step 3 -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td width="36" valign="top" style="padding-top:2px;">
              <div style="width:28px;height:28px;background:linear-gradient(135deg,#0f766e,#0284c7);border-radius:8px;display:inline-block;text-align:center;line-height:28px;font-size:13px;font-weight:800;color:#ffffff;">3</div>
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:15px;font-weight:700;color:#e2e8f0;">Ask Bonnie: "What should I focus on?"</p>
              <p style="margin:4px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Your AI assistant reads your workspace and surfaces the highest-leverage next action.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Trial notice -->
    <tr>
      <td style="padding:24px 40px 0 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:rgba(15,118,110,0.08);border:1px solid rgba(45,212,191,0.15);border-radius:12px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
                <span style="color:#2dd4bf;font-weight:700;">Your 14-day trial</span> gives you full access to every feature — CRM, invoicing, AI outreach, and more. No card needed now.
                {{#if trial_ends_at}}<br><span style="color:#64748b;">Trial ends: {{trial_ends_at}}</span>{{/if}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- CTA -->
    <tr>
      <td style="padding:32px 40px 0 40px;">
        <a href="https://alphaclonesystems.com/dashboard" style="display:inline-block;padding:15px 32px;background:linear-gradient(90deg,#0f766e 0%,#0284c7 100%);color:#ffffff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:0.01em;">Open your workspace →</a>
      </td>
    </tr>

    <!-- Divider -->
    <tr><td style="padding:32px 40px 0;"><div style="height:1px;background:#1e3a5f;"></div></td></tr>

    <!-- Founder note -->
    <tr>
      <td style="padding:28px 40px 36px 40px;">
        <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#64748b;">I built AlphaClone because every capable business I worked with was making important decisions with scattered information. This is your single source of truth — use it every day, and it compounds.</p>
        <p style="margin:0;font-size:14px;color:#475569;">— <span style="color:#94a3b8;font-weight:600;">Bonnie</span>, Founder of AlphaClone Systems</p>
      </td>
    </tr>

    <!-- Bottom accent bar -->
    <tr>
      <td style="background:linear-gradient(90deg,#0f766e 0%,#0284c7 100%);height:3px;font-size:0;line-height:0;">&nbsp;</td>
    </tr>

  </table>

  <!-- Footer -->
  <table role="presentation" width="100%" style="max-width:580px;margin-top:20px;">
    <tr>
      <td align="center" style="padding:0 16px;">
        <p style="margin:0 0 6px;font-size:12px;color:#334155;">AlphaClone Systems · alphaclonesystems.com</p>
        <p style="margin:0;font-size:11px;color:#1e293b;">You are receiving this because you created an account at AlphaClone Systems.<br>Sign-in email: <span style="color:#334155;">{{email}}</span></p>
      </td>
    </tr>
  </table>

  </td></tr>
</table>
</body>
</html>$html$,
  body_text = $txt$Welcome to AlphaClone Systems, {{name}}!

Your workspace "{{workspace_name}}" is live and your 14-day trial has started.

START HERE IN 3 STEPS:

1. Add a real customer or lead
   Import from LinkedIn, CSV, or add manually.

2. Create a task or open project
   Capture work scattered across emails and notes.

3. Ask Bonnie: "What should I focus on?"
   Your AI reads your workspace and surfaces what matters most.

Open your workspace: https://alphaclonesystems.com/dashboard

--- 
I built AlphaClone because every capable business I worked with was making important decisions with scattered information. This is your single source of truth — use it every day, and it compounds.

— Bonnie, Founder of AlphaClone Systems

---
AlphaClone Systems · alphaclonesystems.com
Sign-in email: {{email}}
Trial ends: {{trial_ends_at}}$txt$,
  category = 'transactional',
  variables = '["name","email","workspace_name","trial_ends_at"]'::jsonb,
  is_system = true,
  updated_at = now()
WHERE name = 'Welcome Email' AND tenant_id IS NULL;

-- Email Confirmation template (used by Supabase Auth custom email settings)
-- This is stored in email_templates for reference, but also applies if you route
-- confirmation emails through the /api/email/platform-transactional endpoint.
INSERT INTO public.email_templates (id, name, subject, body_html, body_text, category, variables, is_system, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(),
  'Email Confirmation',
  'Confirm your AlphaClone email address',
  $html$<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your email — AlphaClone</title>
</head>
<body style="margin:0;padding:0;background-color:#060d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#060d1a;padding:40px 16px 48px;">
  <tr><td align="center">
  <table role="presentation" width="100%" style="max-width:540px;background-color:#0d1a2e;border:1px solid #1e3a5f;border-radius:20px;overflow:hidden;">
    <tr><td style="background:linear-gradient(90deg,#0f766e 0%,#0284c7 100%);height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr>
      <td style="padding:40px 40px 0 40px;text-align:center;">
        <p style="margin:0 0 24px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#2dd4bf;">AlphaClone Systems</p>
        <div style="width:64px;height:64px;background:linear-gradient(135deg,#0f766e,#0284c7);border-radius:16px;margin:0 auto 24px;display:inline-block;text-align:center;line-height:64px;font-size:28px;">✓</div>
        <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#f0f9ff;">Confirm your email</h1>
        <p style="margin:0 0 32px;font-size:15px;line-height:1.65;color:#64748b;">Click the button below to verify your email address and activate your AlphaClone account.</p>
        <a href="{{confirmation_url}}" style="display:inline-block;padding:15px 36px;background:linear-gradient(90deg,#0f766e 0%,#0284c7 100%);color:#ffffff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:700;">Confirm email address</a>
        <p style="margin:24px 0 0;font-size:12px;color:#334155;">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
      </td>
    </tr>
    <tr><td style="padding:32px 40px 36px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#1e3a5f;word-break:break-all;">Or copy this link: {{confirmation_url}}</p>
    </td></tr>
    <tr><td style="background:linear-gradient(90deg,#0f766e 0%,#0284c7 100%);height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>
  </td></tr>
</table>
</body>
</html>$html$,
  $txt$Confirm your AlphaClone email address

Click the link below to verify your email and activate your account:

{{confirmation_url}}

This link expires in 24 hours.

If you did not create an account, you can ignore this email.

AlphaClone Systems$txt$,
  'transactional',
  '["confirmation_url"]'::jsonb,
  true,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates e WHERE e.name = 'Email Confirmation' AND e.tenant_id IS NULL);
