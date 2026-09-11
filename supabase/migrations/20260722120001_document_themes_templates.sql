-- Document themes and templates for premium business documents

CREATE TABLE IF NOT EXISTS document_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  preset_id TEXT,
  primary_color TEXT DEFAULT '#0f172a',
  accent_color TEXT DEFAULT '#14b8a6',
  font_family TEXT DEFAULT 'Inter, system-ui, sans-serif',
  header_style TEXT DEFAULT 'banner',
  logo_url TEXT,
  logo_dark_url TEXT,
  logo_watermark_url TEXT,
  cover_image_url TEXT,
  footer_text TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  industry TEXT,
  theme_id UUID REFERENCES document_themes(id) ON DELETE SET NULL,
  content JSONB DEFAULT '{}',
  html_template TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID,
  deal_id UUID,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  content JSONB DEFAULT '{}',
  public_token TEXT UNIQUE,
  theme_id UUID REFERENCES document_themes(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS public_token TEXT;

CREATE INDEX IF NOT EXISTS idx_document_themes_tenant ON document_themes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_tenant ON document_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proposals_token ON proposals(public_token);
CREATE INDEX IF NOT EXISTS idx_invoice_versions_invoice ON invoice_versions(invoice_id);

-- Seed system templates (tenant_id NULL = platform templates)
INSERT INTO document_templates (name, document_type, industry, is_system, content)
VALUES
  ('Consulting Proposal', 'proposal', 'consulting', true, '{"sections":["cover","executive_summary","scope","timeline","pricing","terms"]}'),
  ('Agency Quote', 'quote', 'agency', true, '{"sections":["cover","services","pricing","testimonials"]}'),
  ('Freelance Invoice', 'invoice', 'freelance', true, '{"sections":["header","line_items","payment","notes"]}'),
  ('Service Contract', 'contract', 'services', true, '{"sections":["parties","scope","payment","signatures"]}'),
  ('Construction Estimate', 'quote', 'construction', true, '{"sections":["cover","scope","materials","timeline","pricing"]}'),
  ('Legal NDA', 'contract', 'legal', true, '{"sections":["parties","confidentiality","term","signatures"]}')
ON CONFLICT DO NOTHING;
