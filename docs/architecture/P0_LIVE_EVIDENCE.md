# Live P0 Evidence — Production Account

**Date:** 2026-10-05  
**Environment:** https://alphaclonesystems.com (**production**, not PR preview)  
**Actor:** `sales@alphaclonesystems.com`  
**Tenant:** `066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4` (ALPHACLONE SYSTEMS)  
**Test recipient / client email:** `bonniiehendrix@gmail.com`  
**Auth method:** browser session + Supabase password grant (Bearer)  
**Secrets:** not stored in repo

---

## Results

| Test | Result | Evidence |
| --- | --- | --- |
| Login | **PASS** | Dashboard reachable; tenant resolved |
| CRM client for bonniiehendrix@gmail.com | **PASS** | Multiple `business_clients` rows incl. “Bonnie Hendrix”; contact timeline shows sends |
| UI email send to test client | **PASS** | Subject `[AlphaClone LIVE TEST] P0 email command` — timeline shows Zoho/sent |
| API `/api/email/send` (Bearer) | **PASS** (send works) | Brevo provider; `success: true` |
| Cross-call idempotency (same `Idempotency-Key` twice) | **FAIL on production** | Two different `emailId` / `canonicalMessageId` values — **duplicate side effect** |
| Response includes `execution_id` / domain truth | **FAIL on production** | `execution_id: null` — PR #154 domain command not deployed |
| `/api/dashboard/next-actions` | **404** | NBA route not on production |
| `/api/dashboard/action-queue` | **PASS** | HTTP 200; items include message/invoice/contract |
| `/api/dashboard/business-control` | **PASS** | HTTP 200; no `next_actions` field on production |
| Invoice create (UI) | **FAIL** | UI error “Invoice could not be created”; existing DRAFT invoice present |

---

## Idempotency collision detail (production)

Same logical key used twice against production `/api/email/send`:

- Call 1 → success, unique Brevo `emailId` A, `canonicalMessageId` A  
- Call 2 → success, unique Brevo `emailId` B, `canonicalMessageId` B  

**Expected after PR #154 deploy:** one provider side effect; second call replays receipt / same ids.

**Conclusion:** Live production still runs pre-gate email path. Branch unit tests pass; production must deploy PR #154 to clear this gate.

---

## Client notes

`bonniiehendrix@gmail.com` already has many CRM client/contact records from prior QA automation. Prefer existing “Bonnie Hendrix” client rather than creating more duplicates.

---

## Safety

- No refunds / payouts / bank changes  
- Sends labeled `[AlphaClone LIVE TEST]`  
- Multiple emails reached the test inbox because production lacked idempotency (documented failure)

---

## Next action

1. Merge + deploy PR #154 to production (or a preview with prod-like env).  
2. Re-run the same dual `/api/email/send` collision — expect single side effect.  
3. Re-check `/api/dashboard/next-actions` → 200 with actions.
