# API Inventory

**Total routes:** 629 App Router handlers  
**Machine-readable:** `docs/audit/_generated/api-inventory.json` (generated 2026-10-05)  
**Legacy snapshot:** `artifacts/audit/api-routes.json`

## Auth classification (heuristic + spot checks)

| Auth class | Routes | Description |
|------------|--------|-------------|
| `session+bearer` | 401 | `requireTenantAccess`, `requireAuthenticatedUser`, or `getUser()` |
| `internal_secret` | 68 | Cron bearer, `INTERNAL_API_KEY`, `x-internal-api-key` |
| `webhook_signature` | 33 | Provider webhooks / signed callbacks |
| `mcp_oauth` | 16 | MCP + OAuth resource metadata |
| `platform_admin` | 17 | `/api/admin/*` |
| `client_portal_jwt` | 3 | Explicit `requireClientPortalSession` |
| `public_or_oauth` | 12 | OAuth connect/callback, public forms |
| `public` | 1 | Health-style |
| **`manual_review`** | **78** | Heuristic miss — often OAuth, portal double-guard, or custom auth |

> **Note:** `manual_review` is not “unauthenticated.” Example: `/api/client-finance/document` uses `requireClientPortalAccessDoubleGuarded` but was not matched by the classifier regex.

## Risk tier (side-effect heuristic)

| Risk | Count |
|------|-------|
| high | 220 |
| medium | 397 |
| low | 12 |

## Per-endpoint record schema

Each row in `_generated/api-inventory.json` includes:

- `route`, `file`, `methods[]`
- `auth`, `tenantScoped` (boolean)
- `risk` (low | medium | high)
- `sideEffects`, `external` (provider keywords)

## Representative high-risk routes (sample)

| Method | Route | Auth (classified) | Tenant scope | Side effects |
|--------|-------|-------------------|--------------|--------------|
| POST | `/api/mcp` | mcp_oauth | Yes (token) | MCP tool execution |
| POST | `/api/email/send` | session+bearer | Yes | Email send |
| POST | `/api/social/schedule` | session+bearer | Yes | Social publish |
| POST | `/api/invoices/send` | session+bearer | Yes | Invoice send |
| GET | `/api/dashboard/next-actions` | session+bearer | Yes | Read NBA feed |
| POST | `/api/internal/leads/mcp-sync` | internal_secret | Body `tenantId` | Lead promotion |
| POST | `/api/client-portal-auth/login` | manual_review | Portal | Session mint |
| GET | `/api/client-finance/document` | manual_review | Portal + token | Document read |
| POST | `/api/legal/data-request` | public_or_oauth | N/A | Inserts `data_requests` |
| GET | `/api/invoices/track/[token]` | public_or_oauth | Token | Invoice view |

## Rate limiting (middleware)

Global `/api/*` → `rateLimitConfigs.api.standard` (100/min) or `heavy` (20/min) for AI/export paths; MCP has dedicated 300/min config in `rateLimit.ts`. **Fallback:** in-memory store when Redis unavailable (see finding RATE-001).

## Idempotency (converged P0 capabilities)

Domain commands document stable keys in `src/lib/execution/domainIdempotencyKeys.ts` for email, invoice send, social publish, contract send, project create. MCP tools vary — see `artifacts/audit/mcp-exposure-report.json` (`supports_idempotency` often false).

## Undocumented APIs

No separate OpenAPI for full surface; partial docs may exist under `/api/docs`. Inventory is filesystem-derived (complete for `route.ts` files).

## Manual review queue (78 routes)

Full list: filter `auth === "manual_review"` in `docs/audit/_generated/api-inventory.json`. **Remediation phase** should assign each route a canonical auth label and add regression tests — not done in this audit.
