-- alphaclone.tech is no longer an AlphaClone domain. System email templates
-- seeded by 20260412130000_align_email_templates_ui.sql still link to it —
-- rewrite every occurrence to the current production domain.

UPDATE public.email_templates
SET
  body_html = replace(body_html, 'https://alphaclone.tech', 'https://alphaclonesystems.com'),
  body_text = replace(body_text, 'https://alphaclone.tech', 'https://alphaclonesystems.com'),
  updated_at = now()
WHERE tenant_id IS NULL
  AND (body_html LIKE '%alphaclone.tech%' OR body_text LIKE '%alphaclone.tech%');

-- Also fix any tenant-cloned copies of the system templates that inherited the stale domain.
UPDATE public.email_templates
SET
  body_html = replace(body_html, 'https://alphaclone.tech', 'https://alphaclonesystems.com'),
  body_text = replace(body_text, 'https://alphaclone.tech', 'https://alphaclonesystems.com'),
  updated_at = now()
WHERE tenant_id IS NOT NULL
  AND (body_html LIKE '%alphaclone.tech%' OR body_text LIKE '%alphaclone.tech%');
