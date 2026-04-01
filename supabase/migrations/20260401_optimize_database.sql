-- Database Optimization Migration
-- Fixes duplicate indexes and adds missing foreign key indexes for 100% production readiness

-- ============================================================================
-- PART 1: Remove Duplicate Indexes
-- ============================================================================

-- Drop duplicate indexes on invoices table
DROP INDEX IF EXISTS invoices_project_idx;

-- Drop duplicate indexes on messages table
DROP INDEX IF EXISTS idx_messages_read_at;
DROP INDEX IF EXISTS idx_messages_unread;
DROP INDEX IF EXISTS messages_sender_created_idx;
DROP INDEX IF EXISTS messages_conversation_idx;

-- Drop duplicate indexes on oauth_states table
DROP INDEX IF EXISTS oauth_states_created_at_idx;

-- Drop duplicate indexes on tenant_users table
DROP INDEX IF EXISTS idx_tenant_users_user;

-- Drop duplicate indexes on workflow_executions table
DROP INDEX IF EXISTS idx_wf_exec_status;

-- ============================================================================
-- PART 2: Add Missing Foreign Key Indexes (High Priority)
-- ============================================================================

-- Accounting periods
CREATE INDEX IF NOT EXISTS idx_accounting_periods_closed_by ON public.accounting_periods(closed_by);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_created_by ON public.accounting_periods(created_by);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_locked_by ON public.accounting_periods(locked_by);

-- Activities
CREATE INDEX IF NOT EXISTS idx_activities_assigned_to ON public.activities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activities_created_by ON public.activities(created_by);

-- Bookings
CREATE INDEX IF NOT EXISTS idx_bookings_booking_type_id ON public.bookings(booking_type_id);
CREATE INDEX IF NOT EXISTS idx_bookings_calendar_event_id ON public.bookings(calendar_event_id);

-- Bank transactions
CREATE INDEX IF NOT EXISTS idx_bank_transactions_expense_id ON public.bank_transactions(expense_id);

-- Messages (keep essential ones)
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON public.messages(tenant_id);

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON public.projects(tenant_id);

-- Deals
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON public.deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON public.deals(owner_id);

-- Leads
CREATE INDEX IF NOT EXISTS idx_leads_owner_id ON public.leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads(tenant_id);

-- Contacts
CREATE INDEX IF NOT EXISTS idx_contacts_owner_id ON public.contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON public.contacts(created_by);

-- Companies
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON public.companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies(created_by);

-- ============================================================================
-- PART 3: Optimize Realtime Performance
-- ============================================================================

-- Composite indexes for common realtime queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_created ON public.messages(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON public.projects(tenant_id, status);

-- ============================================================================
-- PART 4: Add Comments for Documentation
-- ============================================================================

COMMENT ON INDEX idx_messages_tenant_created IS 'Optimizes realtime message subscriptions filtered by tenant';
COMMENT ON INDEX idx_projects_tenant_status IS 'Optimizes realtime project subscriptions filtered by tenant and status';
