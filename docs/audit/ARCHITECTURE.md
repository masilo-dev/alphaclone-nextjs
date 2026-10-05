# AlphaClone Systems — Architecture Map

**Audit phase:** Reconnaissance (read-only)  
**Methodology:** [Cloudflare security-audit-skill](https://github.com/cloudflare/security-audit-skill)  
**Generated:** 2026-10-05  
**Repository:** `masilo-dev/alphaclone-nextjs` (Next.js App Router monolith)

## Executive topology

| Layer | Technology | Role |
|--------|------------|------|
| Edge / CDN | Cloudflare (proxied origin) | TLS, caching, WAF (config not in repo) |
| Compute | Railway | Node 22, `next start`, workers (`tsx` bonnie/leads workers) |
| App | Next.js 16 (`src/app/`) | UI, App Router API (`src/app/api/**/route.ts`), middleware |
| Auth | Supabase Auth | Cookie + Bearer JWT sessions |
| Data | Supabase Postgres + Storage | Multi-tenant CRM/finance/social data, RLS (367 public tables catalogued) |
| Cache / rate limit | Upstash Redis (optional) | Rate limits; in-memory fallback if unset |
| LLM execution | `/api/mcp`, Bonnie, `/api/ai/*` | Tool registry, OAuth MCP, policy gate |
| External writes | Domain commands + `executeDomainExternalWrite` | Email, invoice send, social publish, contracts, projects |

## Frontend

- **Marketing / legal:** Public pages under `src/app/(marketing)/`, Turnstile on some legal forms.
- **Authenticated app:** `/dashboard`, `/alpha` — session enforced in `src/lib/middleware.ts` (redirect to login/maintenance).
- **Client portal:** Finance portal routes + `client-portal-auth` APIs; HMAC session cookie (`ac_client_portal_session`).
- **PWA:** Serwist / `sw.js`, `src/lib/pwa/registerServiceWorker.ts`, push via `pwaService.ts`.

## Backend (API surface)

- **629** App Router handlers under `src/app/api/` (machine inventory: `docs/audit/_generated/api-inventory.json`, prior snapshot `artifacts/audit/api-routes.json`).
- **Authorization patterns:** `requireTenantAccess`, `requireAuthenticatedUser`, MCP OAuth (`authMiddlewareApp.ts`), cron bearer (`cronAuth.ts`), internal key (`x-internal-api-key` / `INTERNAL_API_KEY`), webhooks, client portal guards.
- **MCP:** Single consolidated handler `src/app/api/mcp/route.ts` (JSON-RPC, quotas, service-role session persistence).

## Domain execution substrate (P0)

Converged external writes (UI + MCP + cron) through:

- `src/lib/execution/domainExternalWrite.ts` — idempotency, `external_actions`, receipts.
- Commands: `sendEmailCommand`, `invoiceSendCommand`, `socialPublishCommand`, `contractSendCommand`, `projectCreateCommand`.
- Policy: `ToolPolicyGate`, `toolExecutionGuard.ts`, `domainCapabilityGuard.ts`.

## Database (Supabase)

- Application uses **service-role admin client** on many server routes (bypasses RLS by design); tenant isolation relies on **app-layer checks** + RLS for direct client/anon access.
- Catalogued in `RLS_COVERAGE_REPORT.md` and `artifacts/audit/rls-policies.json` (367 tables, 100 `SECURITY DEFINER` functions).
- Pending migration referenced for RLS-disabled compliance tables (not applied in this audit).

## Background jobs

- **Cron routes:** `src/app/api/cron/*` (social publish, campaigns, reconcile-external-actions, etc.) — production requires `Authorization: Bearer CRON_SECRET`.
- **Workers:** `src/bonnie/worker.ts`, `src/workers/lead-discovery-worker.ts`, lead discovery, scraper poll proxies.

## External integrations (non-exhaustive)

Facebook / Instagram / LinkedIn (OAuth + publish), Google (Gmail/Calendar/Drive), Microsoft, Zoho, HubSpot, Brevo/Sendinblue, WhatsApp inbox, Stripe/payments (invoice flows), Turnstile, scraper Python service (internal key).

## Data-flow model

```mermaid
flowchart LR
  subgraph Client
    Browser[PWA / Browser]
    LLM[ChatGPT / Claude MCP]
  end
  subgraph Edge
    CF[Cloudflare]
  end
  subgraph Origin[Railway Next.js]
    MW[middleware.ts rate limit + session]
    API[App Router APIs]
    MCP[/api/mcp]
    DOM[domainExternalWrite + commands]
  end
  subgraph Data
    SB[(Supabase Postgres + Storage)]
  end
  subgraph Providers[External providers]
    EP[Email / Social / Payments]
  end
  Browser --> CF --> MW --> API
  LLM --> CF --> MCP
  API --> DOM
  MCP --> DOM
  DOM --> SB
  DOM --> EP
  API --> SB
  SB --> API
  EP --> API
```

**Typical authenticated action**

1. Browser sends cookie or Bearer token.  
2. `requireAuthenticatedUser` → `requireTenantAccess(tenantId)` validates `tenant_users`.  
3. Handler uses `admin` client with explicit `tenant_id` filters (or domain command).  
4. External provider call; result persisted (`external_actions`, receipts, entity rows).  
5. Response to UI / MCP client.

**Typical MCP write**

1. OAuth access token validated (`validateMCPAuthApp`) → `tenant_id`, `user_id`, scopes.  
2. `guardToolExecution` / `ToolPolicyGate` (deny, queue approval, or allow).  
3. Tool handler → domain command or legacy path.  
4. Idempotency key + audit log.

## Storage

- Supabase Storage buckets catalogued in `artifacts/audit/storage-buckets.json`.
- Upload RLS script: `scripts/apply-uploads-storage-rls.mjs`.

## Observability

- Security logs service, MCP session logging, invoice audit logs, client portal audit rows.
- Request ID: `x-request-id` in middleware.

## Related audit artifacts

| Document | Purpose |
|----------|---------|
| `TRUST-BOUNDARIES.md` | Isolation and auth boundaries |
| `API-INVENTORY.md` | Full HTTP surface |
| `SUPABASE-AUDIT.md` | RLS/RPC/storage |
| `LLM-EXECUTION-AUDIT.md` | MCP / tool policy |
| `COVERAGE-LEDGER.md` | What was inspected |
