# AlphaClone Email Infrastructure Audit

**Generated:** 2026-08-26  
**Scope:** Production codebase + Supabase project `ehekzoioqvtweugemktn`  
**Status:** Audit complete; critical P0/P1 fixes applied locally + partial DB migration applied

---

## Executive Summary

AlphaClone has **four overlapping email execution tiers**, **six parallel message stores**, and **three campaign/sequence systems**. A normalized target model (`email_messages`, `email_provider_accounts`, `emailGateway`) exists but is only partially wired. Production yesterday exhausted a legacy **`email_actions` bucket (750/day on Pro)** largely due to failed MCP mailbox reads being counted as send-equivalent actions.

**MCP + production DB are connected and healthy today.** OAuth token exchange works. Email reads must remain quota-free; sends charge only on provider acceptance.

---

## Current Architecture (As-Built)

```
User / Bonnie / MCP / Workflow / API routes
        │
        ├─ Tier 1: sendEmailServer → emailGateway → sendEmail → providerSdk
        │           (compliance, branding, audit, quota on success)
        │
        ├─ Tier 2: sendEmail / /api/email/send (no gateway shell)
        │
        ├─ Tier 3: sendWithProviderSdk (platform templates, legal, webhooks)
        │
        └─ Tier 4: OAuth direct (ZohoMailService, microsoftServerService, gmailServerService)
                    Used by outreach Microsoft/Zoho branches + legacy MCP tools

Reads:
  UnifiedInboxView → live Zoho/Graph API (primary /dashboard/mail)
  UnifiedInboxTab → unified_messages (channels tab)
  MCP get_zoho_mail_messages → Zoho API (MCPServer)
  MCP gmail_list_threads → unified_messages (registry gap-tools)
  Zoho inbox sync → cron */5 + webhook → triageIncomingEmail → unified_messages

Persistence layers (parallel, not FK-linked):
  email_messages (canonical target, 96 outbound in prod)
  lead_outreach_log (operational outreach)
  unified_messages (inbox sync + outbound capture)
  email_communications (universal engine)
  email_logs / emails (legacy)
  email_delivery_audit (gateway audit — now created in prod)
```

---

## Capability Matrix

| Capability | Status | Evidence |
|---|---|---|
| Send single email | **WORKING BUT UNRELIABLE** | Gateway path works; Zoho/MS outreach bypass gateway |
| Send bulk outreach | **PARTIALLY IMPLEMENTED** | Campaign worker durable; Microsoft/Zoho not on gateway |
| Receive email | **PROVIDER-SPECIFIC** | Zoho webhook+cron; no Gmail/Outlook inbox sync |
| Sync inbox | **PROVIDER-SPECIFIC** | Zoho only (poll 5m + push) |
| Sync sent messages | **PARTIALLY IMPLEMENTED** | UI loads sent folder live; partial unified_messages log |
| Reply | **WORKING BUT UNRELIABLE** | Outlook native reply; Zoho via compose/outreach |
| Reply-all | **PROVIDER-SPECIFIC** | Outlook Graph only in UI |
| Forward | **PARTIALLY IMPLEMENTED** | UI compose-only (Fwd: prefix), no provider forward API |
| Draft | **PROVIDER-SPECIFIC** | Zoho draft MCP only |
| Attachments | **PARTIALLY IMPLEMENTED** | MCP send_email supports media ingest |
| Email threads | **DUPLICATED** | provider_thread_id + unified_messages.thread_id + email_threads |
| Search | **DISCONNECTED** | UI client-filter; Zoho MCP search API; read_emails searches wrong table |
| Provider switching | **WORKING** | Outreach failover chain microsoft→brevo→resend→sendgrid→zoho |
| Multiple accounts | **PARTIALLY IMPLEMENTED** | email_provider_accounts schema; UI single active provider |
| Default sender | **PARTIALLY IMPLEMENTED** | resolveSendRoute in unifiedEmailDomain; not used everywhere |
| CRM email history | **PARTIALLY IMPLEMENTED** | activities + lead_outreach_log; weak link to email_messages |
| Campaign tracking | **WORKING BUT UNRELIABLE** | marketing_campaigns + campaign_recipients |
| Sequence tracking | **DUPLICATED** | email_sequences vs outreach_sequences |
| Bounce detection | **PARTIALLY IMPLEMENTED** | email_webhook_events for transactional providers |
| Delivery tracking | **PARTIALLY IMPLEMENTED** | lead_outreach_log status; no unified delivery_state |
| Open/click tracking | **PROVIDER-SPECIFIC** | Brevo/Resend webhooks; not mailbox providers |
| Failed-send tracking | **WORKING** | lead_outreach_log + mcp_sessions errors |
| Scheduled messages | **WORKING** | sendScheduledCampaignServer + cron |
| Retry | **PARTIALLY IMPLEMENTED** | tool-registry transient retry; no email dead-letter queue |
| MCP sending | **WORKING BUT UNRELIABLE** | email-ops.send_email via gateway + idempotency |
| Bonnie sending | **WORKING** | Routes through notifyTenantOwner → sendEmailServer |
| External LLM MCP send | **WORKING BUT UNRELIABLE** | Mixed gateway + OAuth direct tools |
| Daily summaries | **WORKING** | runDailyBusinessSummaryEmails (platform template, no gateway) |
| Business notifications | **WORKING** | businessNotificationEngine → gateway |

---

## The 750 `email_actions` Limit — Root Cause

| Question | Answer |
|---|---|
| Where does 750 come from? | **AlphaClone internal Pro plan limit** in `consume_daily_resource_quota` RPC (`20260824000000_alphaclone_pricing_and_quotas.sql`) |
| Provider limit? | No — this is not Gmail/Zoho API limit |
| What counted toward it? | Legacy **`email_actions`** bucket treated reads and sends alike in production before quota policy fix |
| Do reads consume it? | **They must not.** Code now exempts read tools via `toolQuotaPolicy.shouldPreChargeMcpExecution` |
| Do failed attempts consume it? | Failed sends should not; failed reads incorrectly consumed quota in prod Aug 25 |
| Production evidence | 744× `get_zoho_mail_messages` failures with `QUOTA_EXCEEDED email_actions (750/750)` |

### New Quota Model (implemented)

| Metric | Pro limit | When charged |
|---|---:|---|
| `emails_sent` | 100 | Successful new outbound via gateway |
| `email_replies` | 200 | Successful replies |
| `email_transactional` | 200 | Invoice/contract/booking/security |
| `outreach_actions` | 500 | Marketing/outreach category sends |
| `email_actions` | 750 | **Legacy — deprecate, do not charge reads** |
| MCP reads | 0 | Exempt |

**DB migration applied to production:** `email_quota_metrics_and_audit` + `email_quota_rpc_update`

---

## Provider Capability Registry

Defined in `src/lib/email/unifiedEmailDomain.ts` → `PROVIDER_CAPABILITIES`:

| Provider | Inbox | Send | Reply | Threads | Drafts | Bulk |
|---|---|---|---|---|---|---|
| Zoho | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Microsoft Graph | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Gmail | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Brevo | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| Resend | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| SendGrid | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| SMTP | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |

Adapter interface exists (`providerAdapter.ts`) but **implementations are not fully unified** — most code calls services directly.

---

## MCP Email Tools

| Tool | Path | End-to-end verified | Notes |
|---|---|---|---|
| `send_email` | email-ops → gateway | **YES** (with idempotency) | Requires plain text + category |
| `reply_to_email` / `reply_to_zoho_mail` | Zoho direct | **PARTIAL** | No gateway persistence guarantee |
| `get_zoho_mail_messages` | MCPServer → Zoho API | **YES** | Must not charge quota |
| `get_zoho_mail_thread` | MCPServer | **YES** | |
| `gmail_list_threads` | gap-tools → unified_messages | **PARTIAL** | Stale if no sync |
| `gmail_send_email` | MCPServer → gmailServerService | **PARTIAL** | Bypasses gateway |
| `microsoft_get_emails` | microsoft.ts → Graph | **YES** | Now quota-exempt |
| `microsoft_send_email` | MCPServer | **PARTIAL** | Bypasses gateway |
| `read_emails` / `search_emails` | email-ops → project_email_dispatches | **MISLEADING** | Not connected mailbox |

---

## Production Database Snapshot (2026-08-26)

| Table | Rows / state |
|---|---|
| `email_messages` | 96 outbound, 0 inbound |
| `email_provider_accounts` | exists |
| `lead_outreach_log` | primary outreach ledger |
| `unified_messages` | Zoho sync target |
| `quota_usage` (Aug 25 primary tenant) | mcp_executions=1500, email_actions=750 (maxed) |
| `quota_usage` (Aug 26) | mcp_executions=9, email_actions=0 (reset) |
| `email_delivery_audit` | **created today** |
| `tenant_usage_events` | **created today** |

---

## Fixed During This Audit

| Fix | File / migration |
|---|---|
| Email read tools exempt from MCP pre-charge (incl. Microsoft) | `toolQuotaPolicy.ts` |
| Remove legacy `email_actions` fallback on send metering | `usageMeteringService.ts` |
| Canonical persistence for Zoho/MS outreach sends | `outreach/send/route.ts` |
| Normalized error taxonomy | `emailErrorTaxonomy.ts` (new) |
| Outcome-based quota RPC + audit tables | `20260826120000_email_quota_metrics_and_audit.sql` |
| Production DB migration applied | Supabase MCP |

---

## Remaining (Cannot Hide)

| Item | Category | Why |
|---|---|---|
| Six message stores without FK links | AlphaClone | Requires dual-write migration project |
| Gmail/Outlook inbox sync | Provider + code | No Graph/Gmail push subscriptions implemented |
| Platform emails bypass gateway | AlphaClone | welcome/digest/legal use platformTemplateEmail |
| `read_emails` searches wrong table | AlphaClone | Misleading MCP contract |
| Aug 25 quota not refunded | Ops | Manual SQL needed for primary tenant |
| Plaintext OAuth tokens in DB | Security | Legacy rows in mcp_oauth_tokens |
| Triple campaign/sequence schemas | AlphaClone | Consolidation needed |
| Inbound → email_messages | AlphaClone | Sync writes unified_messages only |

---

## Recommended Next Work

### P0 — Production blockers
1. Deploy code changes (gateway quota policy, outreach canonical persistence) to Railway
2. Refund Aug 25 erroneous `email_actions` + release `mcp_executions` overcharge for failed reads (admin SQL)
3. Wire remaining MCP OAuth send tools through gateway or persist canonical + receipt

### P1 — Reliability
4. Dual-write all outbound sends to `email_messages` + link `lead_outreach_log.email_message_id`
5. Inbound Zoho triage → `email_messages` (direction=inbound)
6. Unify `read_emails` to query canonical store or rename tool
7. Durable `email_outbound_jobs` worker for retries with idempotency keys

### P2 — Scalability
8. Incremental sync cursors per provider account
9. Consolidate campaign systems behind one worker
10. Regenerate Supabase TypeScript types

### P3 — UX/polish
11. Single inbox view merging live provider + canonical timeline
12. Show provider connection state (Connected / Needs Reauthorization) from token health
13. Thread view using `email_threads` + `provider_thread_id`

---

## Architecture After Changes (Target)

```
Bonnie / User / ChatGPT / Claude / MCP
        ↓
Email Command Layer (category + purpose + initiation_source)
        ↓
Sender Resolution (resolveSendRoute + explicit account)
        ↓
Unified Email Service (emailGateway)
        ↓
Provider Adapter (capabilities-aware)
        ↓
Gmail / Zoho / Outlook / Brevo / Resend
        ↓
Verification (provider message ID required)
        ↓
Normalized Message Store (email_messages + threads)
        ↓
CRM Timeline + Campaign + Sequence linkage
        ↓
Audit (email_delivery_audit + tenant_usage_events) + Notifications
```

**Quota:** reads free · sends charge on success only · separate metrics per action type · failed attempts never charged.

---

## What Cursor Fixed vs Cannot Fix

### A. Fixed directly
- Quota accounting for reads vs sends
- Outreach canonical persistence (Zoho/MS)
- Error taxonomy scaffold
- Production audit/usage tables + RPC

### B. Improved but external limits remain
- Provider rate limits (Gmail/Zoho/Graph)
- Deliverability / spam filtering
- OAuth token expiry (mitigated by reconnect UX)

### C. Cannot solve in code alone
- Gmail/Outlook requiring user OAuth re-consent
- Provider inbox APIs not offering full feature parity
- Historical duplicate rows without migration scripts

---

*Evidence IDs: Supabase queries 2026-08-26, mcp_sessions telemetry, unit tests `email-gateway-and-quota.test.mjs` (7/7 pass).*
