-- ============================================================================
-- DATABASE OPTIMIZATION SCRIPT
-- ============================================================================
-- Run this periodically to keep database performant
-- Safe to run in production (no data changes)
-- ============================================================================

-- ============================================================================
-- PART 1: ANALYZE SLOW QUERIES
-- ============================================================================

-- Enable pg_stat_statements if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Show slowest queries (by mean execution time)
SELECT
    substring(query, 1, 100) AS short_query,
    calls,
    ROUND(mean_exec_time::numeric, 2) AS avg_ms,
    ROUND(max_exec_time::numeric, 2) AS max_ms,
    ROUND((total_exec_time / 1000)::numeric, 2) AS total_sec
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Show most frequently called queries
SELECT
    substring(query, 1, 100) AS short_query,
    calls,
    ROUND(mean_exec_time::numeric, 2) AS avg_ms,
    ROUND((total_exec_time / 1000 / 60)::numeric, 2) AS total_min
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY calls DESC
LIMIT 20;

-- ============================================================================
-- PART 2: FIND MISSING INDEXES
-- ============================================================================

-- Tables with missing indexes (high seq scans)
SELECT
    schemaname,
    tablename,
    seq_scan AS sequential_scans,
    idx_scan AS index_scans,
    ROUND((seq_scan::float / NULLIF(seq_scan + idx_scan, 0))::numeric * 100, 2) AS seq_scan_pct,
    n_live_tup AS rows
FROM pg_stat_user_tables
WHERE seq_scan > 0
AND n_live_tup > 1000
ORDER BY seq_scan DESC
LIMIT 20;

-- Columns that might need indexes (used in WHERE but not indexed)
SELECT
    schemaname,
    tablename,
    attname AS column_name,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
AND n_distinct > 100  -- Column has many distinct values
AND correlation < 0.5  -- Column is not well-correlated with physical order
ORDER BY n_distinct DESC;

-- ============================================================================
-- PART 3: CREATE RECOMMENDED INDEXES
-- ============================================================================

-- NOTE: Review these before creating. Only create if query patterns justify.

-- Foreign key indexes (if not already exist)
-- These improve JOIN performance and FK constraint checking

-- Example: Index on tenant_id columns (most tables should have this)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_tenant ON contracts(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);

-- Compound indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_tenant_status
    ON projects(tenant_id, status) WHERE status != 'Archived';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_tenant_status_date
    ON invoices(tenant_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assigned_status
    ON tasks(assigned_to, status) WHERE status != 'Completed';

-- Partial indexes for common filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_active
    ON contracts(tenant_id, status) WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_unpaid
    ON invoices(tenant_id, status) WHERE status IN ('Pending', 'Overdue');

-- Text search indexes (if using full-text search)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_search
--     ON projects USING gin(to_tsvector('english', name || ' ' || description));

-- ============================================================================
-- PART 4: ANALYZE TABLES
-- ============================================================================

-- Update table statistics (helps query planner)
ANALYZE tenants;
ANALYZE tenant_users;
ANALYZE profiles;
ANALYZE projects;
ANALYZE tasks;
ANALYZE documents;
ANALYZE contracts;
ANALYZE invoices;
ANALYZE calendar_events;
ANALYZE notifications;

-- ============================================================================
-- PART 5: VACUUM ANALYSIS
-- ============================================================================

-- Show tables that need vacuuming
SELECT
    schemaname,
    tablename,
    n_dead_tup AS dead_tuples,
    n_live_tup AS live_tuples,
    ROUND((n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0))::numeric * 100, 2) AS dead_pct,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;

-- Manual vacuum if needed (run during low-traffic periods)
-- VACUUM ANALYZE tablename;

-- ============================================================================
-- PART 6: TABLE BLOAT ANALYSIS
-- ============================================================================

-- Check for table bloat
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS external_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- ============================================================================
-- PART 7: CONNECTION POOL MONITORING
-- ============================================================================

-- Active connections by state
SELECT
    state,
    COUNT(*) AS connections
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;

-- Long-running queries (> 30 seconds)
SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '30 seconds'
AND state != 'idle'
ORDER BY duration DESC;

-- ============================================================================
-- PART 8: PERFORMANCE RECOMMENDATIONS
-- ============================================================================

-- Show database cache hit ratio (should be > 99%)
SELECT
    'Cache Hit Ratio' AS metric,
    ROUND(
        (sum(blks_hit) / NULLIF(sum(blks_hit + blks_read), 0) * 100)::numeric,
        2
    ) AS value,
    '%' AS unit
FROM pg_stat_database
WHERE datname = current_database();

-- Show index hit ratio (should be > 99%)
SELECT
    'Index Hit Ratio' AS metric,
    ROUND(
        (sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit + idx_blks_read), 0) * 100)::numeric,
        2
    ) AS value,
    '%' AS unit
FROM pg_statio_user_indexes;

-- ============================================================================
-- OPTIMIZATION SUMMARY
-- ============================================================================

/*
PERFORMANCE TUNING CHECKLIST:

✅ Enable pg_stat_statements for query analysis
✅ Create indexes on foreign keys
✅ Create compound indexes for common query patterns
✅ Use partial indexes for filtered queries
✅ Run ANALYZE to update statistics
✅ Monitor and vacuum tables regularly
✅ Keep cache hit ratio > 99%
✅ Monitor connection pool usage
✅ Identify and optimize slow queries

NEXT STEPS:
1. Review slow query report
2. Create recommended indexes (test in staging first)
3. Run ANALYZE on large tables
4. Schedule regular VACUUM (automatic in most cases)
5. Monitor cache hit ratios
6. Set up query performance alerts

MAINTENANCE SCHEDULE:
- Daily: Monitor slow queries
- Weekly: Check for missing indexes
- Monthly: Analyze table bloat
- Quarterly: Full VACUUM ANALYZE
*/
