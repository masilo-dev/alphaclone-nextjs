# LLM / Agent Execution Audit

AlphaClone’s execution layer is the **primary trust boundary** between LLMs and real business effects.

## Entry points

| Path | Role |
|------|------|
| `POST /api/mcp` | ChatGPT/Claude/Cursor MCP JSON-RPC |
| `/api/ai/chat`, `/api/ai/stream`, … | In-app AI (session auth + tenant context) |
| Bonnie worker / tools | Internal agent runtime |
| `POST /api/engine/execute` | Engine ingest/execute (review in remediation) |

## MCP authentication

1. Bearer OAuth token or API key → `lookupOAuthToken` / `lookupMcpApiKey`.
2. Binds **`tenant_id`**, **`user_id`**, scopes, optional resource audience match.
3. Session persistence uses service role (`mcp/route.ts`) — server-only.

## Authorization stack

```
MCP request
  → validateMCPAuthApp
  → validateMcpQuota (RPC check_daily_resource_quota)
  → MCPServer.executeTool
  → guardToolExecution (toolExecutionGuard.ts)
  → evaluateToolPolicy (ToolPolicyGate.ts)
  → handler OR domain command (executeDomainExternalWrite)
```

**Policy outcomes:** deny, queue_approval, allow. Financial money movement tools blocked from MCP auto-allow (unit test in P0 suite).

## Tool surface (exposure)

From `artifacts/audit/mcp-exposure-report.json`:

| Metric | Value |
|--------|-------|
| Registered tools | 523 |
| Write tools | 349 |
| External action tools | 189 |
| Tools with verification hooks | 6 |
| Hidden tools | 0 |

**Risk:** Large write surface increases impact of any authorization bug or over-scoped token.

## Read vs write

- **Reads:** CRM queries, analytics — still sensitive (PII) but no provider side effect.
- **Writes:** email, social, invoices, contracts, tickets, lead promotion — must have policy + audit + idempotency where duplicated cost is high.

## Converged writes (P0 substrate)

These UI/API paths delegate to domain commands (also reachable via MCP where wired):

- Email → `executeSendEmailCommand`
- Invoice send → `executeInvoiceSendCommand`
- Social → `executeSocialPublishCommand`
- Contract send → `executeContractSendCommand`
- Project create → `executeProjectCreateCommand`

Shared primitive: `executeDomainExternalWrite` — idempotency replay, `external_actions` logging, unknown state reconciliation cron.

## Prompt injection / excessive agency

| Class | Mitigation observed | Gap |
|-------|---------------------|-----|
| Prompt injection to tool args | Policy gate, typed tools | Tool-specific validation uneven |
| Indirect injection (email/HTML) | Partial sanitization elsewhere | **NEEDS VALIDATION** per template |
| Tool chaining | MCPServer dispatches single tool per call | Orchestration in client may chain |
| Confused deputy | Token bound to tenant/user | Internal API key routes separate trust |
| Cross-tenant execution | Token tenant vs args tenant must match | **NEEDS VALIDATION** per tool handler |
| Confirmation bypass | `queue_approval` path exists | Not all write tools require approval |
| Replay | Idempotency keys on converged domain writes | Many MCP tools `supports_idempotency: false` |

## NL → SQL path

`naturalLanguageSqlService.ts`:

- LLM generates SELECT only; blacklist + single-table allowlist + mandatory `tenant_id = '<uuid>'` regex.
- Executes via RPC `secure_read_only_query` with `expected_tenant_id`.
- **Defense-in-depth:** Even if LLM bypasses prompt rules, static checker blocks `UNION`, `JOIN`, comments, multi-statement.

**Status:** Strong static guard; **NEEDS VALIDATION** that RPC enforces tenant on server regardless of query string.

## LLM truthful completion claims

`src/lib/mcp/llmTruthfulResponse.ts` — blocks unverified completion claims (P0 test coverage).

## Recommendations (report only)

1. Tier MCP tools: default-deny writes without idempotency + receipt for external actions.
2. Expand `supports_verification` beyond 6 tools.
3. Automated test: token for tenant A cannot pass `tenantId` B in tool args (param override audit).
4. Rate limit MCP per tenant (already partially via quota RPC).

## Findings

- **MCP-SURFACE-001** (P2, CONFIRMED): High write tool count with limited verification metadata.  
- **MCP-IDEM-001** (P2, NEEDS VALIDATION): Many tools lack idempotency flags in exposure report.  
