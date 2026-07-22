# Alphaclone ChatGPT MCP Connector

Production MCP server embedded in Alphaclone Next.js that exposes every major platform module to ChatGPT Apps via Model Context Protocol tool discovery.

## Architecture

```
ChatGPT / Claude / Cursor
        │  OAuth (mcp_at_*) or API key (ac_mcp_*)
        ▼
   POST /api/mcp
        │
        ├─ tools/list  → getUnifiedMcpTools() (registry + manifest + supplemental)
        └─ tools/call  → tool-registry.executeTool() → connector modules
                              │
                              ├─ JWT/OAuth auth middleware
                              ├─ RBAC permission checks
                              ├─ Rate limiting
                              ├─ Zod input validation
                              ├─ Structured JSON envelopes
                              └─ Audit trail (mcp_sessions + audit_logs)
```

### Connector modules (`src/lib/mcp/tools/`)

| Module | Tools |
|--------|-------|
| `platform-ops` | `get_platform_status`, `get_system_health`, `get_version`, `get_environment`, `get_feature_flags`, `get_recent_errors`, `get_audit_logs`, `restart_service`, `audit_platform` |
| `bonnie-inspect` | conversations, workflows, inspect_* (reasoning, memory, tools, prompts, vector store, embeddings, RAG, planner, executor, scheduler, task queue) |
| `crm-ops` | `list_leads`, `search_leads`, `create_lead`, `update_lead`, `delete_lead`, `list_contacts`, `list_companies`, `pipeline_status`, `opportunities` |
| `social-ops` | `connected_accounts`, `scheduled_posts`, `drafts`, `analytics`, `publish_post`, `delete_post`, `engagement_report` |
| `marketing-ops` | `campaigns`, `campaign_metrics`, `email_campaigns`, `funnels`, `landing_pages`, `conversions` |
| `sales-ops` | `invoices`, `quotes`, `payments`, `subscriptions`, `revenue_dashboard` |
| `calendar-ops` | `events`, `tasks`, `reminders`, `appointments` |
| `documents-ops` | `search_documents`, `upload_document`, `retrieve_document`, `document_versions` |
| `reports-ops` | `dashboard_metrics`, `revenue_report`, `growth_report`, `customer_report`, `AI_usage_report` |
| `integrations-health` | `github_health`, `gmail_health`, `google_calendar_health`, `zoho_health`, `stripe_health`, `calendly_health`, `railway_health`, `supabase_health`, `openai_health`, `deepseek_health`, `integrations_status` |

Shared infrastructure lives under `src/lib/mcp/connector/` (permissions, pagination, rate limits, structured responses). The audit engine is `src/lib/mcp/audit/platformAuditEngine.ts`.

## Authentication

1. **API key**: `Authorization: Bearer ac_mcp_...` (hashed lookup in `mcp_api_keys`)
2. **OAuth access token**: `Authorization: Bearer mcp_at_...` (RFC 8707 resource indicators)
3. Discovery: `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`

Scopes: `read`, `write`, `mcp:tools`, `mcp:resources`. Fine-grained RBAC is enforced per tool via `assertPermission` (owner/admin/member/viewer).

## ChatGPT Apps setup

1. Deploy Alphaclone (Railway recommended).
2. Ensure `NEXT_PUBLIC_APP_URL` points at the public origin.
3. In ChatGPT → Settings → Connectors / Apps, add the MCP server URL:
   - `https://<your-domain>/api/mcp`
4. Complete OAuth consent (or paste an `ac_mcp_*` key if your connector flow supports it).
5. Ask: `@Alphaclone what can you do?` — ChatGPT should call `inspect_tools` / discover the catalog.
6. Ask: `@Alphaclone audit my platform` — should call `audit_platform`.

Submission metadata: `chatgpt-app-submission.json`.

## Local development

```bash
npm ci
npm run dev
# MCP endpoint: http://localhost:3000/api/mcp
npm run validate:mcp
npm run test:mcp-connector
```

## Docker

```bash
docker build -f Dockerfile.mcp -t alphaclone-mcp .
docker run --env-file .env -p 3000:3000 alphaclone-mcp
```

Health: `GET /api/mcp/health` and `GET /api/health`.

## Security notes

- `restart_service` requires `platform:restart` (owner) + `confirm: true` and is rate-limited.
- Secrets never appear in tool responses; only configuration booleans.
- All mutating tools write audit log rows when `auditAction` is set.
- Rate limits use Upstash Redis when configured, otherwise in-memory fallback.

## Verification checklist

- [ ] `tools/list` returns connector tools (no hidden tools)
- [ ] OAuth well-known endpoints resolve
- [ ] `audit_platform` returns a health score + recommendations
- [ ] `list_leads` / `integrations_status` return live tenant data
- [ ] ChatGPT can invoke tools after connecting the app
