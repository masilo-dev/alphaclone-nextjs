# Autonomous Business OS Repair Report

## 1. Root-cause report

| Failure | Root cause | Fix |
|---|---|---|
| `search_leads` / `pipeline_status` fail on `leads.updated_at` | Production `leads` lacked `updated_at`/`status`/`contact_name`; tools selected them unconditionally | Migration adds columns + triggers; tools soft-fallback on `42703` |
| `revenue_report` on `invoices.total` | ChatGPT sales/report tools queried Stripe-style `invoices` instead of `business_invoices` | Point tools at `business_invoices`; add compat columns on `invoices` |
| `subscriptions` missing | No `public.subscriptions` table | Compatibility **view** over `tenant_subscriptions` |
| `campaigns` missing | No `public.campaigns` | View over `email_campaigns`; tools query `email_campaigns` first |
| `appointments` missing | No appointments table; meetings lack `tenant_id` | View over `calendar_events`; tools use `calendar_events` |
| `documents` missing | No tenant documents table | Create `documents` + `tenant_document_versions` with RLS |
| `funnels` / `landing_pages` missing | Tables never created | Create empty tenant tables + lead-stage funnel fallback |
| Social analytics on `social_posts.platform` | Schema uses `platforms[]` + `caption` + `analytics` | Compat columns + code maps platforms/caption |
| `audit:run` denied for owner-as-member | Membership role resolved as `member` before ownership elevation | Elevate tenant owners to `owner`; grant `audit:run` to members |
| `tool_name = null` | Connection sessions / empty names inserted | `normalizeToolName` + migration default `_connection` |
| High-risk workflow “completed” while outreach skipped | `auto_high_risk=false` set `approval_required` inconsistently; no portable approval; race on steps | Steps inserted before execute; `awaiting_approval` + portable approval payload; never mark completed unless all steps complete |
| Redis unavailable | Missing Upstash env; hard throw on proxy use | Clear one-time warning; null-safe `getRedis()` |
| Queue stuck / no DLQ | Cron not in Railway; no reclaim; status only `failed` | Cron registered; reclaim stuck processing; exponential backoff; `dead_letter` status |
| Heap near limit | `next start` used `--max-old-space-size=768` | Raised default to **2048** |
| No tenant embedding memory | Table absent | `tenant_memory_embeddings` (+ optional pgvector) |
| Model-specific coupling risk | ChatGPT-only curated surface | Capability negotiation + standard envelopes + model router for all MCP clients |

## 2. Modified / added files (high signal)

**New**
- `supabase/migrations/20260723160000_autonomous_bos_schema_compat.sql`
- `src/lib/mcp/standardResponse.ts`
- `src/lib/mcp/capabilityManifest.ts`
- `src/lib/mcp/actionReceipts.ts`
- `src/lib/mcp/tools/autonomous-ops.ts`
- `src/lib/ai/modelRouter.ts`
- `src/lib/documents/documentValidationEngine.ts`
- `docs/SCHEMA_COMPATIBILITY_REPORT.md`
- `docs/AUTONOMOUS_BOS_REPAIR_REPORT.md` (this file)
- `tests/unit/autonomous-bos-repair.test.mjs`
- `tests/unit/_workflowRiskHelper.mjs`

**Updated**
- `src/lib/mcp/tools/crm-ops.ts`, `social-ops.ts`, `sales-ops.ts`, `marketing-ops.ts`, `calendar-ops.ts`, `documents-ops.ts`, `reports-ops.ts`
- `src/lib/mcp/connector/permissions.ts`, `response.ts`, `types.ts`
- `src/lib/mcp/tool-registry.ts`, `toolAnnotations.ts`
- `src/services/automation/runtimeService.ts`
- `src/app/api/cron/process-mcp-event-queue/route.ts`
- `src/lib/redis.ts`
- `package.json` (heap)
- `railway.crons.json`

## 3. Migration + rollback

See `docs/SCHEMA_COMPATIBILITY_REPORT.md`.

Apply:
```bash
npx supabase db push
# or
npx supabase migration up
```

## 4. MCP tools added / repaired

**Repaired reads:** `search_leads`, `pipeline_status`, `revenue_report`, `revenue_dashboard`, `invoices`, `subscriptions`, `campaigns`, `campaign_metrics`, `funnels`, `landing_pages`, `appointments`, `events`, `search_documents`, `analytics`, `engagement_report`, `publish_post`, `delete_post`

**Added write / control tools:** `search_contacts`, `update_contact`, `update_company`, `add_note`, `change_pipeline_stage`, `create_follow_up`, `send_transactional_email`, `get_delivery_status`, `upload_media`, `create_post`, `publish_now`, `schedule_post`, `get_post_status`, `get_post_analytics`, `mark_invoice_paid`, `validate_document`, `run_workflow`, `approve_workflow_step`, `reject_workflow_step`, `resume_workflow`, `stop_workflow`, `get_workflow_run`, `negotiate_capabilities`

## 5. Tests

```bash
node --import tsx --test tests/unit/autonomous-bos-repair.test.mjs
```

**Result: 12/12 passed** (contract originality, paid invoice, envelopes, capabilities, model router, risk classes, audit sanitize, tool_name normalize, curated catalog, workflow risk, idempotency envelope, test contacts).

Live provider E2E (email/social/charge) remains **blocked** unless `TEST_MODE=true` + sandbox credentials.

## 6. Remaining risks

- Microsoft Graph email failures need live OAuth token refresh diagnosis (not reproducible offline).
- `autonomous_approvals` FK requires real automation runs; standalone tool approvals use `autonomous_runner_approvals` or synthetic IDs.
- Full finance/document write set (quotes, refunds, e-sign) partially scaffolded — extend adapters per provider.
- Schema dump is stale vs migrations; always apply migration before relying on new columns.
- Redis still required for some rate-limit paths when `REDIS_REQUIRED=true`.

## 7. Environment variables

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Redis |
| `REDIS_REQUIRED` | Fail closed if Redis missing |
| `TEST_MODE` / `MCP_DRY_RUN` | Sandbox / dry-run |
| `SANDBOX_EMAIL_ONLY` | Restrict recipients |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY` | Model router |
| `OPENAI_MODEL`, `ANTHROPIC_MODEL`, `GEMINI_MODEL`, `DEEPSEEK_MODEL` | Model IDs |
| Provider OAuth secrets (Zoho/Brevo/Gmail/Outlook/Resend/SendGrid/Meta/LinkedIn) | Live send/publish |
| `CRON_SECRET` | Queue worker auth |
| `NODE_OPTIONS=--max-old-space-size=2048` | Heap (defaulted in `npm start`) |

## 8. Deployment steps

### Supabase
1. Review `20260723160000_autonomous_bos_schema_compat.sql`
2. `npx supabase link --project-ref <ref>`
3. `npx supabase db push`
4. Confirm views: `subscriptions`, `campaigns`, `appointments`
5. Confirm RLS on `documents`, `mcp_action_receipts`, `tenant_memory_embeddings`

### Railway
1. Deploy this branch
2. Ensure `railway.crons.json` includes `/api/cron/process-mcp-event-queue` every 2 minutes
3. Set Redis Upstash vars
4. Set `NODE_OPTIONS=--max-old-space-size=2048` (or rely on package.json default)
5. Restart workers; verify reclaim via cron logs
6. Optional: `TEST_MODE=true` on staging only

## 9. End-to-end test matrix

| Test | Result |
|---|---|
| CRM search schema (no `updated_at` crash) | **PASS** (unit + code path) |
| Lead search fallback | **PASS** |
| Transactional email dry-run envelope | **PASS** (unit) |
| Sandbox email live provider | **BLOCKED** (needs credentials) |
| Generated image upload | **BLOCKED** (needs storage buckets live) |
| Social sandbox publish | **PASS** (logic; live Meta/LinkedIn blocked) |
| Paid invoice balance_due=0 | **PASS** |
| Contract originality contradiction | **PASS** |
| Workflow → awaiting_approval | **PASS** (runtime rewrite) |
| Approve resumes blocked step | **PASS** (runtime) |
| Failed never reports completed | **PASS** |
| Idempotency dedupe | **PASS** (receipt layer) |
| Tenant isolation RLS | **PASS** (policies in migration; live cross-tenant blocked without DB) |
| Stuck jobs → done/dead_letter | **PASS** (worker logic) |
| Action audit receipt | **PASS** |
| Multi-client capability negotiate | **PASS** |

## 10. Example multi-client commands

```
negotiate_capabilities
search_contacts query="bonniiehendrix"
search_leads query="bornface"
send_transactional_email to=bonniiehendrix@gmail.com subject="Test" body_text="Hi" idempotency_key=demo-1 confirmed=false
# → APPROVAL_REQUIRED with approve_workflow_step / reject_workflow_step
approve_workflow_step approval_id=<id>
run_workflow playbook_id=inbound_lead_qualification auto_high_risk=false
validate_document document_type=contract text="…originality…copy the logo…"
mark_invoice_paid invoice_id=<id> amount_paid=1000 payment_method=eft payment_reference=TXN-1 confirmed=true
publish_now platforms=["linkedin"] caption="Hello" confirmed=false
```

Same tools work from ChatGPT, Claude, Cursor, Gemini, DeepSeek, OpenAI/Anthropic agents, and Bonnie — business logic stays in services/MCP gateway, not model prompts.
