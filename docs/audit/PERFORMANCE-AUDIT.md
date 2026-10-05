# Performance Audit (read-only)

Targets from brief: common navigation <1s cached; API <2s; first authenticated <3s where reasonable.

## Frontend / bundle

- Next.js 16 webpack build with Serwist PWA (`package.json` scripts, high memory `NODE_OPTIONS`).
- **Action:** Run Lighthouse/Observatory on production (not executed in this audit) — see CLOUDFLARE-RECOMMENDATIONS.

## Middleware / network

- All `/api/*` rate limited — adds Redis round-trip when configured.
- Dashboard pages protected — session refresh on navigation (`middleware.ts`).

## Hot paths (code review)

| Area | Observation | Severity |
|------|-------------|----------|
| `/api/dashboard/stats` | `maxDuration = 800`, parallel fan-out queries + RPC fallback | **PERF-001** heavy origin work |
| `/api/dashboard/next-actions` | Derives up to 50 NBA + customer success actions | Moderate |
| CRM lists | Many routes — check pagination | **NEEDS VALIDATION** for unbounded `.select()` |
| MCP | `maxDuration = 800` on `/api/mcp` | Long-running tool risk |
| AI routes | `maxDuration = 60` on chat | Provider latency bound |

## Database

- Dashboard stats uses consolidated RPC with parallel fallback (`dashboardStatsService`, `getStatsFallback`).
- NL SQL uses single RPC read path.
- **Risk patterns to hunt in remediation:** `SELECT *`, client-side pagination of large arrays, missing indexes on `tenant_id` + `created_at`.

## Duplicate requests

- Auth membership 15s cache reduces duplicate tenant lookups (`apiAuth.ts`).
- React Query/SWR patterns in UI **NEEDS VALIDATION** per page.

## Caching

- Cloudflare edge caching for static assets assumed; API `force-dynamic` on many dashboard routes — low CDN cacheability for JSON.

## Core Web Vitals

Not measured in-repo during audit. Recommend Cloudflare Web Analytics + RUM.

## Findings

- **PERF-001** (P3 performance, CONFIRMED): Dashboard stats route configured for very long serverless duration with broad parallel DB queries — latency risk under load.  
- **PERF-PAGINATION-001** (P2, NEEDS VALIDATION): Unbounded list endpoints in CRM/leads/email modules.  
