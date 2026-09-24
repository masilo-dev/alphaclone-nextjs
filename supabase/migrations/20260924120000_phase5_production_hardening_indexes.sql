-- ==============================================================================
-- Migration: 20260924120000_phase5_production_hardening_indexes.sql
-- Phase 5 Production Stability Hardening — additional performance indexes
--
-- 1. SEO articles published lookup index (fixes 3500ms query timeouts)
-- 2. Tasks reminder queue index (drives task-reminders cron efficiency)
-- 3. MCP OAuth client lookup index (fixes [MCP OAuth] Client lookup timeouts)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SEO ARTICLES — published listing and slug lookup
-- ------------------------------------------------------------------------------
-- Fixes: "SEO article query timed out after 3500ms"
-- The query at seoServerService.ts:83 filters on published=true and orders by
-- created_at DESC. Without a partial index, PostgreSQL performs a full table scan.

CREATE INDEX IF NOT EXISTS idx_seo_articles_published_created
  ON public.seo_articles (created_at DESC)
  WHERE published = true;

-- Slug lookups (increment_published_seo_article_view + getPublishedSeoArticleBySlug)
CREATE INDEX IF NOT EXISTS idx_seo_articles_slug_published
  ON public.seo_articles (slug)
  WHERE published = true;

-- ------------------------------------------------------------------------------
-- 2. TASKS — reminder queue (drives task-reminders cron)
-- ------------------------------------------------------------------------------
-- Fixes: task-reminders cron picking up the same tasks repeatedly.
-- The reminder queries filter on status != 'completed'/'cancelled', due_date,
-- and reminder_at. This composite index covers both the dueSoon and overdue paths.

CREATE INDEX IF NOT EXISTS idx_tasks_reminder_queue
  ON public.tasks (due_date ASC, tenant_id, reminder_at NULLS FIRST)
  WHERE status NOT IN ('completed', 'cancelled');

-- ------------------------------------------------------------------------------
-- 3. MCP OAUTH CLIENTS — client_id lookup
-- ------------------------------------------------------------------------------
-- Fixes: "[MCP OAuth] Client lookup error: canceling statement due to statement timeout"
-- The OAuth flow at src/app/api/mcp/route.ts line 84 looks up clients by client_id.

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_clients_client_id
  ON public.mcp_oauth_clients (client_id)
  WHERE client_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 4. RELOAD POSTGREST SCHEMA CACHE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
