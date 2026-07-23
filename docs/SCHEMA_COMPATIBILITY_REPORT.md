# Schema Compatibility Report — Alphaclone Autonomous BOS

Generated from `recurring_tasks_schema.json` (production dump) + code inspection of MCP connector tools.

## Decision summary

| Logical name | Decision | Mapping / action |
|---|---|---|
| `leads.updated_at` | **ADD column** | Used widely; order/filter required |
| `leads.status` | **ADD column** | Pipeline tools + create/update |
| `leads.contact_name` | **ADD column** | Search + create |
| `leads.linkedin_url` | **ADD column** | Create lead |
| `invoices.total` | **ADD + map** | Prefer `business_invoices.total`; add compat cols on `invoices` |
| `subscriptions` | **VIEW** | `CREATE VIEW subscriptions AS SELECT … FROM tenant_subscriptions` |
| `campaigns` | **VIEW** | Maps to `email_campaigns` |
| `appointments` | **VIEW** | Maps to `calendar_events` |
| `documents` | **CREATE TABLE** | Tenant-scoped documents store |
| `funnels` | **CREATE TABLE** | Empty-capable; tools fall back to lead stages |
| `landing_pages` | **CREATE TABLE** | Empty-capable |
| `social_posts.platform` | **ADD compat column** | Canonical remains `platforms[]` |
| `social_posts.content` | **ADD compat column** | Canonical remains `caption` |

## Broken queries repaired in code

- `search_leads` — stop hard-fail on missing `updated_at`/`contact_name`
- `pipeline_status` — stop selecting missing `status`/`updated_at` without fallback
- `revenue_report` / `revenue_dashboard` / `invoices` — use `business_invoices`
- `subscriptions` — use `tenant_subscriptions`
- `campaigns` / `campaign_metrics` — use `email_campaigns`
- `appointments` / `events` — use `calendar_events` (not EventBus `events`)
- `search_documents` — use `documents` with collaboration fallback
- `analytics` / `engagement_report` / `publish_post` — use `platforms`/`caption`

## Migration

`supabase/migrations/20260723160000_autonomous_bos_schema_compat.sql`

### Rollback

```sql
-- Views
DROP VIEW IF EXISTS public.appointments;
DROP VIEW IF EXISTS public.campaigns;
DROP VIEW IF EXISTS public.subscriptions;

-- Optional new tables (only if empty / safe)
-- DROP TABLE IF EXISTS public.tenant_memory_embeddings;
-- DROP TABLE IF EXISTS public.mcp_action_receipts;
-- DROP TABLE IF EXISTS public.model_execution_evidence;
-- DROP TABLE IF EXISTS public.landing_pages;
-- DROP TABLE IF EXISTS public.funnels;
-- DROP TABLE IF EXISTS public.tenant_document_versions;
-- DROP TABLE IF EXISTS public.documents;

-- Columns are left in place (non-destructive). To drop manually:
-- ALTER TABLE public.leads DROP COLUMN IF EXISTS updated_at, …;
```
