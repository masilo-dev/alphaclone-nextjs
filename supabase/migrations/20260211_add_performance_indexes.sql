-- ============================================================================
-- ALPHACLONE BUSINESS OS: PERFORMANCE OPTIMIZATION INDEXES
-- Created: 2026-02-11
-- Purpose: Add comprehensive indexes to eliminate slow queries and improve
--          data retrieval performance across all critical tables
-- ============================================================================

-- JOURNAL ENTRIES & ACCOUNTING
-- These indexes optimize financial reporting and journal entry queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS journal_entries_tenant_status_date_idx 
ON journal_entries(tenant_id, status, entry_date DESC) 
WHERE voided_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS journal_entries_tenant_voided_idx 
ON journal_entries(tenant_id, voided_at) 
WHERE voided_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS journal_entry_lines_account_entry_idx 
ON journal_entry_lines(account_id, entry_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS journal_entry_lines_entry_id_idx 
ON journal_entry_lines(entry_id);

-- CHART OF ACCOUNTS
-- Optimizes account lookups and balance calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS chart_of_accounts_tenant_active_idx 
ON chart_of_accounts(tenant_id, is_active, deleted_at) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS chart_of_accounts_code_idx 
ON chart_of_accounts(account_code) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS chart_of_accounts_type_idx 
ON chart_of_accounts(tenant_id, account_type) 
WHERE is_active = true AND deleted_at IS NULL;

-- PROJECTS
-- Optimizes project queries by owner and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS projects_owner_status_idx 
ON projects(owner_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS projects_tenant_status_idx 
ON projects(tenant_id, status, created_at DESC) 
WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS projects_status_stage_idx 
ON projects(status, current_stage) 
WHERE status IN ('Active', 'Pending');

-- MESSAGES
-- Optimizes message retrieval and unread counts
CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_sender_created_idx 
ON messages(sender_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_recipient_read_idx 
ON messages(recipient_id, read_at, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_conversation_idx 
ON messages(sender_id, recipient_id, created_at DESC);

-- INVOICES
-- Optimizes invoice queries by user and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS invoices_user_status_idx 
ON invoices(user_id, status, due_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS invoices_tenant_status_idx 
ON invoices(tenant_id, status, due_date) 
WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS invoices_project_idx 
ON invoices(project_id) 
WHERE project_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS invoices_due_date_idx 
ON invoices(due_date, status) 
WHERE status != 'paid';

-- TASKS
-- Optimizes task queries by assignee and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_assigned_status_due_idx 
ON tasks(assigned_to, status, due_date) 
WHERE assigned_to IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_project_status_idx 
ON tasks(project_id, status) 
WHERE project_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_tenant_status_idx 
ON tasks(tenant_id, status, created_at DESC) 
WHERE tenant_id IS NOT NULL;

-- DEALS
-- Optimizes deal pipeline queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS deals_tenant_stage_idx 
ON deals(tenant_id, stage, created_at DESC) 
WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS deals_probability_value_idx 
ON deals(probability DESC, value DESC) 
WHERE stage != 'closed_lost';

CREATE INDEX CONCURRENTLY IF NOT EXISTS deals_owner_stage_idx 
ON deals(owner_id, stage) 
WHERE owner_id IS NOT NULL;

-- CLIENTS (if table exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS clients_tenant_created_idx 
ON clients(tenant_id, created_at DESC) 
WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS clients_status_idx 
ON clients(status) 
WHERE status = 'active';

-- LEADS
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_tenant_status_idx 
ON leads(tenant_id, status, created_at DESC) 
WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_assigned_status_idx 
ON leads(assigned_to, status) 
WHERE assigned_to IS NOT NULL;

-- PROFILES (for user lookups)
CREATE INDEX CONCURRENTLY IF NOT EXISTS profiles_tenant_role_idx 
ON profiles(tenant_id, role) 
WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS profiles_email_idx 
ON profiles(email) 
WHERE email IS NOT NULL;

-- ============================================================================
-- ANALYZE TABLES
-- Update table statistics for query planner optimization
-- ============================================================================
ANALYZE journal_entries;
ANALYZE journal_entry_lines;
ANALYZE chart_of_accounts;
ANALYZE projects;
ANALYZE messages;
ANALYZE invoices;
ANALYZE tasks;
ANALYZE deals;
ANALYZE profiles;

-- ============================================================================
-- VERIFICATION QUERY
-- Run this to verify all indexes were created successfully
-- ============================================================================
-- SELECT 
--     schemaname,
--     tablename,
--     indexname,
--     indexdef
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
--   AND indexname LIKE '%_performance_idx'
--   OR indexname LIKE '%_tenant_%_idx'
--   OR indexname LIKE '%_status_%_idx'
-- ORDER BY tablename, indexname;
