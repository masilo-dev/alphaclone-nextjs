# Attack Surface

## Methodology

Reconnaissance + coverage-led hunting per Cloudflare security-audit-skill: map entrypoints, classify auth, prioritize high side-effect routes, validate candidates with second-pass disproof.

## Surface summary

| Surface | Count / scale | Primary risks |
|---------|----------------|---------------|
| App Router APIs | 629 routes | IDOR, missing tenant filter with admin client, abuse |
| MCP JSON-RPC | 1 endpoint, 523 tools | Over-permissioned token, tool chaining, write duplication |
| OAuth callbacks | ~25+ provider routes | State fixation, token confusion, open redirect |
| Cron / internal | ~68 internal-secret classified | Secret leakage → cross-tenant batch jobs |
| Webhooks | ~33 signature-classified | Replay, weak verification |
| Client portal | 3 JWT routes + client-finance family | Token guessing, IDOR on `documentId` |
| Public legal/marketing | ~12 public/OAuth | Spam, scraping, Turnstile bypass |
| Supabase PostgREST | Anon + authenticated JWT | RLS gaps, excessive grants |
| Storage | Bucket policies | Path traversal, public buckets |
| PWA / SW | `/sw.js` | Cache of sensitive responses |
| Workers (Railway) | Bonnie, leads, scraper | Service role in env |

## High-value write entrypoints

| Route family | External effect |
|--------------|-----------------|
| `/api/email/send` | Outbound email (domain command) |
| `/api/invoices/send`, `/reminder` | Invoice delivery |
| `/api/social/schedule`, cron social | Social publish |
| `/api/contracts/management` | Contract send |
| `/api/mcp` | Any registered write tool |
| `/api/quotes/send` | Quote delivery |
| `/api/brevo/send`, platform transactional | Email providers |
| `/api/facebook/*`, `/api/instagram/*`, `/api/linkedin/*` | Social API proxies |
| `/api/scraper/*` | Lead discovery cost/abuse |
| `/api/ai/*` | LLM cost, indirect SQL (NL query) |

## Input surfaces

- JSON bodies with `tenantId`, resource UUIDs, provider account IDs, MCP tool `arguments`.
- File uploads: documents, social images, Google Drive, WhatsApp documents.
- Query params: portal `token`, invoice track tokens, dashboard `tenantId`.

## Undocumented / catch-all

- `/api/[...unmatched]` — fallback handler (inventory: manual review).

## Prior audit artifacts (reuse)

- `artifacts/audit/mcp-exposure-report.json` — tool exposure matrix  
- `artifacts/audit/mcp-full-execution-audit.md` — prior MCP execution review  
- `artifacts/audit/routes.json`, `api-routes.json` — route lists  
- `artifacts/audit/external-integrations.json` — integration map  

## Cloudflare edge (out of repo)

Production host `alphaclonesystems.com` is assumed proxied; WAF/rate rules not visible in git — recommendations in `CLOUDFLARE-RECOMMENDATIONS.md`.
