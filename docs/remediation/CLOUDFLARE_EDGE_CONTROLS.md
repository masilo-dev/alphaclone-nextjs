# Cloudflare Edge Rate Limiting (recommendations — not auto-enabled)

These are **application-complementary** controls. They do not replace `requireTenantAccess`, MCP OAuth, or portal authorization.

## Suggested per-route rules

| Path pattern | Burst | Sustained | Key | Notes |
|--------------|-------|-----------|-----|-------|
| `/auth/login`, `/api/auth/login` | 10 / 1m | 30 / 15m | IP | Auth abuse |
| `/auth/signup`, `/api/auth/signup` | 5 / 1m | 10 / 1h | IP | Signup spam |
| `/auth/*password*` | 5 / 1m | 10 / 1h | IP | Reset abuse |
| `/api/client-portal-auth/login` | 10 / 1m | 40 / 15m | IP | Portal lockout complements |
| `/api/mcp` | 120 / 1m | 600 / 10m | IP + JA3 if available | Shared LLM egress IPs — keep generous |
| `/api/email/send` | 30 / 1m | 120 / 10m | IP | Pair with app quota |
| `/api/social/*` | 30 / 1m | 120 / 10m | IP | Publish abuse |
| `/api/scraper/*`, `/api/leads/searches*` | 20 / 1m | 60 / 10m | IP | Cost abuse |
| `/api/ai/*` | 20 / 1m | 100 / 10m | IP | Cost abuse |
| `/api/cron/*` | Deny public | — | — | Origin-only / authenticated |

## Exemptions

- Verified provider webhooks (`/api/*/webhook*`) — signature-validated; rate-limit carefully to avoid delivery failures.
- OAuth callbacks — allow enough for provider round-trips; do not blanket-block `/api/auth/*/callback`.

## Observability

Enable Security Analytics + Logpush only if plan allows **without unexpected spend**. Prefer free Web Analytics / Security Analytics first.

## API Shield

Evaluate schema validation for `/api/mcp`, `/api/email/send`, `/api/invoices/send` once OpenAPI subsets exist. Application authorization remains mandatory.
