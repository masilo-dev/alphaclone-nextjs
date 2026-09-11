-- ============================================================
-- Fix 2A: Create dedicated support_tickets table
-- ============================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  ticket_number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  category TEXT CHECK (category IN ('billing','technical','general','feature_request','bug','onboarding')),
  source TEXT CHECK (source IN ('whatsapp','email','chat','manual','bonnie_agent','api')),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  client_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  assigned_to UUID,
  message_id UUID,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ,
  resolution_note TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generate ticket numbers
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'TKT-' || lpad(nextval('ticket_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_ticket_number ON support_tickets;
CREATE TRIGGER trg_generate_ticket_number
BEFORE INSERT ON support_tickets
FOR EACH ROW
WHEN (NEW.ticket_number IS NULL)
EXECUTE FUNCTION generate_ticket_number();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_contact ON support_tickets(contact_id);
CREATE INDEX IF NOT EXISTS idx_tickets_source ON support_tickets(source);

-- ============================================================
-- Fix 2B: SLA auto-set trigger based on priority
-- ============================================================
CREATE OR REPLACE FUNCTION set_ticket_sla()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sla_due_at := CASE NEW.priority
    WHEN 'urgent' THEN NOW() + INTERVAL '2 hours'
    WHEN 'high'   THEN NOW() + INTERVAL '8 hours'
    WHEN 'medium' THEN NOW() + INTERVAL '24 hours'
    WHEN 'low'    THEN NOW() + INTERVAL '72 hours'
    ELSE NOW() + INTERVAL '24 hours'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_sla ON support_tickets;
CREATE TRIGGER auto_sla
BEFORE INSERT ON support_tickets
FOR EACH ROW EXECUTE FUNCTION set_ticket_sla();

-- ============================================================
-- Fix 2C: Migrate existing dream loop tasks to tickets
-- ============================================================
INSERT INTO support_tickets (tenant_id, title, description, status, priority, category, source)
SELECT 
  tenant_id, 
  title, 
  description, 
  CASE 
    WHEN status = 'completed' THEN 'resolved' 
    ELSE 'open' 
  END,
  priority, 
  'technical', 
  'bonnie_agent'
FROM tasks
WHERE (title ILIKE '%AI Self-Evolution%' OR title ILIKE '%reliability%' OR title ILIKE '%failure%')
  AND tenant_id = '51772ee6-dee8-4c42-81f7-0fee297e5b27'
  AND id NOT IN (
    SELECT id FROM tasks 
    WHERE title ILIKE '%AI Self-Evolution%'
    ORDER BY created_at DESC 
    LIMIT 1
  );

-- ============================================================
-- Fix 1A: Delete duplicate dream loop tasks (keep newest)
-- ============================================================
DELETE FROM tasks 
WHERE title LIKE '%AI Self-Evolution%'
AND id NOT IN (
  SELECT id FROM tasks 
  WHERE title LIKE '%AI Self-Evolution%'
  ORDER BY created_at DESC 
  LIMIT 1
)
AND tenant_id = '51772ee6-dee8-4c42-81f7-0fee297e5b27';

-- ============================================================
-- Fix 3B: Backfill contact_id on existing WhatsApp messages
-- ============================================================
UPDATE whatsapp_messages wm
SET contact_id = c.id
FROM contacts c
WHERE c.phone LIKE '%' || wm.phone_number
AND wm.contact_id IS NULL;

-- ============================================================
-- Fix 4A: Set Bonnie's default persona (uses config column)
-- ============================================================
UPDATE integrations
SET config = config || '{
  "persona_prompt": "You are Bonnie, the AI business assistant for AlphaClone Systems (alphaclonesystems.com). You help SMB owners manage their CRM, invoices, leads, contracts, and social media from one place. When responding to inbound messages: - Be friendly, professional, and concise - If someone asks about pricing: Starter $15/mo, Pro $45/mo, Enterprise $80/mo - If someone wants a demo: direct them to alphaclonesystems.com - If someone has a billing issue: create a support ticket and let them know the team will follow up within 24 hours - If someone is a new lead: capture their name, business, and need, then add them to CRM - Never make promises about features that don''t exist - Always sign off as: Bonnie | AlphaClone Systems"
}'::jsonb
WHERE type = 'whatsapp'
AND (config->>'persona_prompt') IS NULL;

-- ============================================================
-- Fix 4B: Add auto_reply_enabled to integrations config
-- ============================================================
UPDATE integrations
SET config = config || '{"auto_reply_enabled": true}'::jsonb
WHERE type = 'whatsapp'
AND (config->>'auto_reply_enabled') IS NULL;

-- ============================================================
-- Fix 5C: Create function for avg resolution time (uses unified tickets)
-- ============================================================
DROP FUNCTION IF EXISTS get_avg_ticket_resolution_time(UUID);
CREATE OR REPLACE FUNCTION get_avg_ticket_resolution_time(p_tenant_id UUID)
RETURNS TABLE(avg_hours NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600),
      0
    )::NUMERIC(10,2) AS avg_hours
  FROM tickets
  WHERE tenant_id = p_tenant_id
    AND resolved_at IS NOT NULL
    AND created_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
