# Production readiness hardening (2026-07-24)

Companion to the platform multi-tenant / social repair branch.

## Must-do before merge/deploy

1. Apply migrations on this branch (`20260724120000` … `140000`) via `supabase db push`.
2. Set Railway cron Authorization to `Bearer ${CRON_SECRET}` on **every** cron (spoofable `x-railway-cron` alone is rejected).
3. Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (required in production).
4. Set `ZERNIO_WEBHOOK_SECRET` for WhatsApp webhooks.
5. Confirm `/api/readiness` returns 200 only when config + DB are healthy (or temporarily set `READINESS_ALWAYS_200=true` during bootstrap).
6. Run: `npm run typecheck` and `npm test`.

## Hardened this pass

| Area | Change |
|------|--------|
| Build | Fixed TS errors in `mediaUpload` / `tenantGuard` |
| Cron auth | Production requires Bearer secret |
| Readiness | HTTP 503 when degraded (soft opt-out) |
| Zernio | Secret required; no body.tenantId trust; status updates tenant-scoped |
| Forms | Webhook secret required in production |
| Social cron | Legacy `scheduled_posts` path off by default |
| Invoices | `/api/invoices/lifecycle` — no MCP/AI required |
| GDPR | Daily cron processes verified `data_deletion_requests` |
| Privacy UI | Revoke routes to marketplace disconnect |
| Email inbound | No full body HTML/text in activity logs |
| Redis | Required in production by default |
| Audit | `AUDIT_REQUIRED` + `critical` flag for fail-closed audits |

## Still staged (not blockers for this ship)

- Full React 19 upgrade for Next 16 (tracked separately; build currently uses `--webpack`)
- Composite same-tenant FKs / JWT RLS rewrite / RAG filters / A/B pentest suite
- CI billing unlock so Actions gates deploys again
