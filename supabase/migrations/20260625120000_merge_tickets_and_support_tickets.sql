-- ============================================================
-- Migration: Merge support_tickets into tickets table
-- This unifies the dual ticket schema into a single table
-- ============================================================

-- Step 1: Add missing columns to the main tickets table
-- Note: client_id references companies(id) instead of non-existent clients table
ALTER TABLE tickets 
    ADD COLUMN IF NOT EXISTS ticket_number TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('billing','technical','general','feature_request','bug','onboarding')),
    ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolution_note TEXT,
    ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS message_id UUID;

-- Step 2: Expand source enum to include support_tickets sources
-- First, we need to handle the constraint carefully
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_source_check;

-- Add new check constraint with expanded sources
ALTER TABLE tickets ADD CONSTRAINT tickets_source_check 
    CHECK (source IN ('lead', 'client', 'project', 'invoice', 'contract', 'general', 
                      'whatsapp', 'email', 'chat', 'manual', 'bonnie_agent', 'api'));

-- Step 3: Create sequence for ticket numbers if not exists
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;

-- Step 4: Create function to generate ticket numbers
CREATE OR REPLACE FUNCTION generate_merged_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number := 'TKT-' || lpad(nextval('ticket_number_seq')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger for ticket number generation
DROP TRIGGER IF EXISTS trg_generate_ticket_number ON tickets;
CREATE TRIGGER trg_generate_ticket_number
    BEFORE INSERT ON tickets
    FOR EACH ROW
    WHEN (NEW.ticket_number IS NULL)
    EXECUTE FUNCTION generate_merged_ticket_number();

-- Step 6: Create function for SLA auto-set
CREATE OR REPLACE FUNCTION set_merged_ticket_sla()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sla_due_at IS NULL THEN
        NEW.sla_due_at := CASE NEW.priority
            WHEN 'urgent' THEN NOW() + INTERVAL '2 hours'
            WHEN 'high'   THEN NOW() + INTERVAL '8 hours'
            WHEN 'medium' THEN NOW() + INTERVAL '24 hours'
            WHEN 'low'    THEN NOW() + INTERVAL '72 hours'
            ELSE NOW() + INTERVAL '24 hours'
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_sla ON tickets;
CREATE TRIGGER auto_sla
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION set_merged_ticket_sla();

-- Step 7: Migrate data from support_tickets to tickets
INSERT INTO tickets (
    id,
    tenant_id,
    ticket_number,
    title,
    description,
    status,
    priority,
    category,
    source,
    contact_id,
    client_id,
    assigned_to,
    message_id,
    first_response_at,
    resolved_at,
    closed_at,
    sla_due_at,
    resolution_note,
    metadata,
    created_at,
    updated_at
)
SELECT 
    id,
    tenant_id,
    ticket_number,
    title,
    description,
    status,
    priority,
    category,
    source,
    contact_id,
    client_id,
    assigned_to,
    message_id,
    first_response_at,
    resolved_at,
    closed_at,
    sla_due_at,
    resolution_note,
    metadata,
    created_at,
    updated_at
FROM support_tickets
WHERE id NOT IN (SELECT id FROM tickets)
ON CONFLICT (id) DO NOTHING;

-- Step 8: Create index on new columns
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_contact ON tickets(contact_id);
CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_sla ON tickets(sla_due_at);

-- Step 9: Drop old RLS policies that reference the jwt tenant_id pattern
DROP POLICY IF EXISTS "Users can view tickets in their tenant" ON tickets;
DROP POLICY IF EXISTS "Users can create tickets in their tenant" ON tickets;
DROP POLICY IF EXISTS "Users can update tickets in their tenant" ON tickets;
DROP POLICY IF EXISTS "Users can view comments on tickets in their tenant" ON ticket_comments;
DROP POLICY IF EXISTS "Users can create comments on tickets in their tenant" ON ticket_comments;

-- Step 10: Create new RLS policies using tenant_users pattern
CREATE POLICY tickets_select_tenant_members
    ON tickets FOR SELECT
    USING (
        tenant_id IN (
            SELECT tu.tenant_id
            FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid()
        )
    );

CREATE POLICY tickets_insert_tenant_members
    ON tickets FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tu.tenant_id
            FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid()
        )
    );

CREATE POLICY tickets_update_tenant_members
    ON tickets FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tu.tenant_id
            FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid()
        )
    );

CREATE POLICY tickets_delete_tenant_members
    ON tickets FOR DELETE
    USING (
        tenant_id IN (
            SELECT tu.tenant_id
            FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid()
        )
    );

-- Step 11: Update ticket_comments RLS policies
CREATE POLICY ticket_comments_select_tenant_members
    ON ticket_comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_comments.ticket_id
            AND t.tenant_id IN (
                SELECT tu.tenant_id
                FROM public.tenant_users tu
                WHERE tu.user_id = auth.uid()
            )
        )
    );

CREATE POLICY ticket_comments_insert_tenant_members
    ON ticket_comments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_comments.ticket_id
            AND t.tenant_id IN (
                SELECT tu.tenant_id
                FROM public.tenant_users tu
                WHERE tu.user_id = auth.uid()
            )
        )
    );

CREATE POLICY ticket_comments_update_tenant_members
    ON ticket_comments FOR UPDATE
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_comments.ticket_id
            AND t.tenant_id IN (
                SELECT tu.tenant_id
                FROM public.tenant_users tu
                WHERE tu.user_id = auth.uid()
                AND tu.role IN ('admin', 'owner')
            )
        )
    );

CREATE POLICY ticket_comments_delete_tenant_members
    ON ticket_comments FOR DELETE
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_comments.ticket_id
            AND t.tenant_id IN (
                SELECT tu.tenant_id
                FROM public.tenant_users tu
                WHERE tu.user_id = auth.uid()
                AND tu.role IN ('admin', 'owner')
            )
        )
    );

-- Step 12: Create unified view for backward compatibility
CREATE OR REPLACE VIEW unified_tickets AS
SELECT 
    t.*,
    c.name as contact_name,
    c.email as contact_email,
    cl.name as client_name,
    CASE 
        WHEN t.source IN ('whatsapp', 'email', 'chat', 'manual', 'bonnie_agent', 'api') 
        THEN 'support' 
        ELSE 'business' 
    END as ticket_type
FROM tickets t
LEFT JOIN contacts c ON c.id = t.contact_id
LEFT JOIN clients cl ON cl.id = t.client_id;

-- Step 13: Create function to get ticket stats
CREATE OR REPLACE FUNCTION get_ticket_stats(p_tenant_id UUID)
RETURNS TABLE(
    total_tickets BIGINT,
    open_tickets BIGINT,
    resolved_today BIGINT,
    avg_resolution_hours NUMERIC,
    sla_breach_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_tickets,
        COUNT(*) FILTER (WHERE status IN ('open', 'in_progress', 'waiting'))::BIGINT as open_tickets,
        COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at >= CURRENT_DATE)::BIGINT as resolved_today,
        COALESCE(
            AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
            FILTER (WHERE resolved_at IS NOT NULL),
            0
        )::NUMERIC(10,2) as avg_resolution_hours,
        COUNT(*) FILTER (WHERE sla_due_at < NOW() AND status NOT IN ('resolved', 'closed'))::BIGINT as sla_breach_count
    FROM tickets
    WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 14: Add comment explaining the migration
COMMENT ON TABLE tickets IS 'Unified tickets table (merged from tickets and support_tickets). Contains both business tickets (from CRM, projects, etc.) and support tickets (from WhatsApp, email, chat).';

-- Note: support_tickets table is kept temporarily for rollback safety
-- To drop it after verification, run:
-- DROP TABLE IF EXISTS support_tickets CASCADE;
