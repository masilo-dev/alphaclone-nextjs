# Platform-Wide Multi-Tenant SaaS Audit & Repair

**Date:** 2026-07-24  
**Scope:** Entire Alphaclone platform (CRM, finance, documents, email, social, Bonnie, workflows, MCP, storage, cache, workers)  
**Rule:** Alphaclone Systems is **one ordinary tenant**, never a global default.

---

## Executive verdict

Multi-tenancy exists in many places (`tenant_id` columns, `requireTenantAccess`, MCP `mergeSessionArgs`) but isolation is **uneven**. Critical holes allow cross-workspace access via MCP headers, `set_tenant_context` without membership, child tables without `tenant_id`, unscoped cron jobs, and storage paths without tenant prefixes.

This repair ships **Stage A (auth/context)** + **Stage B foundation (schema helpers + child tenant_id backfill + quarantine)**. Full module-by-module composite FKs and RAG tables remain staged follow-ups.

---

## Critical findings (pre-repair)

| #   | Finding                                                                                         | Location                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | MCP cookie fallback trusted `x-tenant-id` / `?tenantId=` **without membership check**           | `src/app/api/mcp/route.ts`                                                                                         |
| 2   | `set_tenant_context` SECURITY DEFINER + granted to `authenticated` with **no membership check** | `20260410120500_add_tenant_context_rpc.sql`                                                                        |
| 3   | MCPServer `requireTenant` fell back to **client `args.tenant_id`** when ctx missing             | `MCPServer.ts`                                                                                                     |
| 4   | `defineConnectorTool` preferred `args.tenant_id` over missing session                           | `defineTool.ts`                                                                                                    |
| 5   | Child tables missing `tenant_id`                                                                | `project_milestones`, `ticket_comments`, `lead_activities`, `campaign_*`, `email_sequence_*`, `messenger_messages` |
| 6   | Storage paths `userId/...` without tenant                                                       | `fileUploadService.ts`                                                                                             |
| 7   | Cron scanned due work globally without quarantine for missing `tenant_id`                       | `process-campaigns`, MCP queue                                                                                     |

---

## Repairs shipped (this PR branch)

### Code

- `src/lib/tenant/platformTenant.ts` — session bind, membership assert, cache/storage key helpers, cron quarantine persistence, storage path assert
- MCP route: hint only after `resolveActiveTenantForUser`; **every request** re-checks active membership (sessions included)
- MCP DELETE scopes session cleanup to `tenant_id` + `user_id`
- OAuth tokens + API keys: `requireActive` + membership revalidation
- Connector permissions: **fail closed** (no invented `member` role)
- MCPServer: **fail closed** without session ctx (no client tenant trust)
- `defineConnectorTool`: session-only tenant/user
- Cache keys: `tenantApiResponse`, `tenantUserPermissions`, `tenantScoped`
- File uploads (buffer **and** UI `uploadFile`): `tenant/{tenantId}/uploads/...` + required tenant_id
- Storage proxy: rejects private paths outside `tenant/{activeTenantId}/...`
- Cron campaigns + MCP queue: quarantine table write + move out of retry loop
- Social: enum `ALTER TYPE` migration, SSRF media URL block, atomic scheduled claim, MCP tool membership/permissions
- MCP event queue: always `createMCPServer({ tenantId, userId })`

### Migrations

- `20260724140000_platform_multitenant_foundation.sql`
  - `get_user_tenant_ids`, `user_belongs_to_tenant`, `is_tenant_member`, `is_tenant_owner`, `current_tenant_id`
  - Hardened `set_tenant_context` (membership required; transaction-local)
  - Add + backfill `tenant_id` on critical child tables
  - `tenant_isolation_quarantine` for orphans (no auto-delete)
  - RLS policies for `tasks` / `project_milestones`

Social-specific multi-tenant work remains on the social repair PR (`social_connections` / identities).

---

## Staged follow-ups (not complete yet)

| Stage | Work                                                                        |
| ----- | --------------------------------------------------------------------------- |
| B2    | Backfill remaining child tables; composite FKs `(tenant_id, parent_id)`     |
| B3    | Replace JWT-claim RLS policies with `user_belongs_to_tenant`                |
| C2    | ~~Storage proxy: reject non-`tenant/{id}/` private paths~~ **done**         |
| C1    | Remaining cron workers: tenant-batch + quarantine missing tenant_id         |
| C3    | RAG/embedding tables with mandatory tenant filter before ship               |
| C4    | Tenant A/B penetration suite per module (CRM, finance, docs, email, Bonnie) |
| C5    | Support-access grant flow (time-limited, audited)                           |

---

## Deploy

1. Apply `20260724140000_platform_multitenant_foundation.sql`
2. Deploy app
3. Review `tenant_isolation_quarantine` for orphans
4. Run `tests/unit/platform-multitenant-isolation.test.mjs`

## Rollback

- Migration helpers are additive; `set_tenant_context` behavior change is intentional (stricter)
- App can revert independently; do not drop quarantine table without exporting rows
