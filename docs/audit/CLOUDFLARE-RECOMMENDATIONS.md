# Cloudflare Security & Performance Recommendations

**Not enabled in this audit** — recommendations only.

## Security

| Product | Use case for AlphaClone |
|---------|-------------------------|
| **WAF** | Managed ruleset on `alphaclonesystems.com`; custom rules for `/api/auth/*`, `/api/client-portal-auth/*` |
| **Rate limiting** | Per-URI limits complement app middleware — especially login, MCP, email send, scraper |
| **Bot Fight Mode / Super Bot Fight** | Protect marketing forms; tune for MCP OAuth user agents |
| **API Shield** | Schema validation on high-risk JSON routes (`/api/email/send`, `/api/mcp`) if OpenAPI subset defined |
| **JWT validation** | Edge validation for Bearer staff API (optional; Supabase JWT rotation complexity) |
| **BOLA protection** | Beta — monitor IDOR-prone paths (`/api/client-finance/*`, invoice by id) |
| **Security Analytics** | Detect spikes on `/api/mcp`, `/api/scraper/*` |
| **Logpush** | Ship WAF + HTTP logs to SIEM for tenant abuse investigations |

## MCP / LLM edge

- Separate rate limit rule for `/api/mcp` by IP + authenticated client_id (from OAuth) if log fields available.
- Consider geographic restrictions if product is region-specific (optional).

## Performance

| Product | Use case |
|---------|----------|
| **Argo Smart Routing** | Origin on Railway — reduce TTFB variability |
| **Tiered Cache** | Static `_next/static`, fonts, marketing images |
| **Polish / Mirage** | Image-heavy social previews (if not already optimized in app) |
| **HTTP/3** | Enable on zone |
| **Observatory / synthetic** | Monitor dashboard, CRM client detail, portal login |
| **Web Analytics / RUM** | LCP, INP, CLS vs origin `x-request-id` correlation |

## Origin protection

- Ensure **Railway origin** accepts traffic only from Cloudflare (authenticated origin pulls / firewall) — **NEEDS VALIDATION** on deployment config (not in repo).

## Turnstile

Already integrated in legal flows (`verifyTurnstile.ts`) — extend to other public POST endpoints if abuse observed.
