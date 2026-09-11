BEGIN;

-- Bring the legacy template table up to the contract-manager shape without
-- replacing existing tenant templates.
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS output_format TEXT NOT NULL DEFAULT 'markdown',
  ADD COLUMN IF NOT EXISTS approval_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO public.contract_templates
  (tenant_id, name, category, description, content, output_format, approval_required, is_active, is_default, version_number, metadata)
SELECT NULL, seed.name, seed.category, seed.description, to_jsonb(seed.content), 'markdown', TRUE, TRUE, seed.is_default, 1,
  jsonb_build_object('system_template', true, 'variables', seed.variables)
FROM (VALUES
  ('Non-Disclosure Agreement', 'nda', 'Mutual NDA for confidential commercial discussions', E'# Mutual Non-Disclosure Agreement\n\nBetween {{provider_name}} and {{client_name}}. Each party will protect Confidential Information, use it only for {{purpose}}, and restrict disclosure to authorised representatives. The obligations continue for {{confidentiality_period}}.\n\nGoverning law: {{governing_law}}.', false, '["provider_name","client_name","purpose","confidentiality_period","governing_law"]'::jsonb),
  ('Master Services Agreement', 'msa', 'Reusable governing terms for multiple statements of work', E'# Master Services Agreement\n\nThis MSA governs services supplied by {{provider_name}} to {{client_name}}. Individual projects will be described in signed Statements of Work. It covers payment, intellectual property, confidentiality, warranties, liability, data protection, term and termination.\n\nEffective date: {{effective_date}}.', false, '["provider_name","client_name","effective_date"]'::jsonb),
  ('Statement of Work', 'sow', 'Project scope, deliverables, timeline, milestones and fees', E'# Statement of Work\n\nUnder the MSA between {{provider_name}} and {{client_name}}.\n\n## Scope\n{{scope}}\n\n## Deliverables\n{{deliverables}}\n\n## Milestones and acceptance\n{{milestones}}\n\n## Fees and payment schedule\n{{pricing}}\n\nStart: {{start_date}} · Completion: {{end_date}}.', false, '["provider_name","client_name","scope","deliverables","milestones","pricing","start_date","end_date"]'::jsonb),
  ('Service Agreement', 'service', 'Standalone agreement for professional or managed services', E'# Service Agreement\n\n{{provider_name}} will provide {{services}} to {{client_name}} from {{start_date}} to {{end_date}} for {{total_price}}.\n\n## Deliverables\n{{deliverables}}\n\n## Payment terms\n{{payment_terms}}\n\n## Legal terms\nApproved confidentiality, intellectual-property, liability, privacy and termination clauses apply.', true, '["provider_name","client_name","services","start_date","end_date","total_price","deliverables","payment_terms"]'::jsonb),
  ('Custom Agreement Starter', 'custom', 'Approved neutral structure for a custom contract', E'# {{agreement_title}}\n\nParties: {{provider_name}} and {{client_name}}\n\n## Purpose\n{{purpose}}\n\n## Commercial terms\n{{commercial_terms}}\n\n## Responsibilities\n{{responsibilities}}\n\n## Special terms\n{{special_terms}}', false, '["agreement_title","provider_name","client_name","purpose","commercial_terms","responsibilities","special_terms"]'::jsonb)
) AS seed(name, category, description, content, is_default, variables)
WHERE NOT EXISTS (
  SELECT 1 FROM public.contract_templates existing
  WHERE existing.tenant_id IS NULL AND existing.name = seed.name AND existing.version_number = 1
);

COMMIT;
