# Trust Boundaries

## 1. Tenant A ↔ Tenant B (P0)

**Expected invariant:** No cross-tenant read/write of CRM, finance, documents, social identities, credentials, or execution history.

**Primary controls**

| Control | Location | Notes |
|---------|----------|-------|
| Membership gate | `src/lib/apiAuth.ts` `requireTenantAccess` | Joins `tenant_users` for `(user_id, tenant_id)` |
| RLS | Supabase policies | 367 tables; 2 without RLS (see SUPABASE-AUDIT) |
| Admin client | `createSupabaseAdminClient` | **Bypasses RLS** — handlers must filter `tenant_id` |
| MCP binding | `authMiddlewareApp.ts` | Token maps to single `tenant_id` |
| Domain writes | `domainExternalWrite.ts` | `tenantId` on every execution record |

**Hunt results**

- **Client-controlled `tenantId`:** Common query/body parameter; paired with `requireTenantAccess` on converged P0 routes (email, invoice send, next-actions, social schedule, etc.).
- **IDOR pattern:** Resource IDs (`invoice_id`, `client_id`, …) must be validated with `.eq('tenant_id', tenantId)` when using admin client — **spot-check required per module** (78 routes flagged `manual_review` in inventory heuristics; many use alternate guards e.g. `requireClientPortalAccessDoubleGuarded`).
- **Service-role bypass:** Intentional for server; failure mode is **missing tenant filter** in handler (class: authorization bug, not RLS).

## 2. User ↔ Platform admin

- `requirePlatformSuperAdmin` / `profiles.role` platform aliases (`src/lib/platformAdmin.ts`).
- Admin APIs under `/api/admin/*` (17 routes in inventory) — require platform admin pattern.
- Unit coverage: `tests/security/super_admin_security.test.ts`.

## 3. LLM / MCP ↔ AlphaClone (critical)

**Entry:** `POST /api/mcp`  
**Auth:** OAuth bearer / API key lookup → `tenant_id`, `user_id`, scopes  
**Authorization:** Per-tool `ToolPolicyGate`, quotas (`check_daily_resource_quota`), idempotency on converged writes  
**Risk:** 523 registered MCP tools, 349 writes (`artifacts/audit/mcp-exposure-report.json`) — large blast radius if token or policy fails

## 4. AlphaClone ↔ External providers

- OAuth callbacks under `/api/auth/*/callback` — state/PKCE patterns vary by provider (see AUTH-AUDIT).
- Tokens stored encrypted (`integrationTokenCrypto`, `productionGuard.assertProductionEncryptionConfigured`).
- Social publish: `executeSocialPublishCommand` + tenant-scoped identity selection.

## 5. Internal services ↔ AlphaClone

- `INTERNAL_API_KEY` / `CRON_SECRET` / `x-internal-api-key` on scraper sync, cron, some internal routes.
- **Trust assumption:** Possession of secret implies ability to act on **any** `tenantId` supplied in body (e.g. `internal/leads/mcp-sync`) — network + secret protection is the boundary.

## 6. Client portal ↔ Tenant CRM

**Separate auth plane:** HMAC JWT cookie, portal token in URL, double guard (`requireClientPortalAccessDoubleGuarded`).  
**Invariant:** Client A must not read Client B documents/invoices within or across tenants.  
See `CLIENT-PORTAL-AUDIT.md`.

## 7. Public ↔ Authenticated

- Public forms (`legal/data-request`, contact) use Turnstile when enforced; insert via service role into `data_requests` (table lacks RLS — see finding SUP-RLS-001).
- Invoice **track** / **public-link** tokens — capability URLs; separate from staff auth.

## 8. Browser ↔ Supabase direct

Middleware rate-limits paths containing `/rest/v1/`, `/auth/v1/`, `/storage/v1/` but does not block; anon key remains in client bundle (expected Supabase model; RLS must hold).
