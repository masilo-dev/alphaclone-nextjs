# AlphaClone MCP Audit Setup

## Authentication

- MCP tools require a valid OAuth session or service token with `tenant_id` and `user_id`.
- ChatGPT connector uses canonical client id `chatgpt-connector` (see `resolveCanonicalOAuthClient.ts`).

## Required provider scopes

| Provider | Scopes / setup |
|----------|----------------|
| Facebook | `pages_manage_posts`, `pages_read_engagement`, Page access token |
| LinkedIn | `w_member_social`, organization admin for company pages |
| Zoho Mail | `ZohoMail.messages.READ`, `ZohoMail.messages.CREATE` |
| Gmail | OAuth with `gmail.send` |
| Calendly / Cal.com | OAuth booking integration (either satisfies `booking_ready`) |

## Queues and approvals

- Durable sends (email, social publish) enqueue Bonnie runtime tasks when `BONNIE_DURABLE_RUNTIME=true`.
- Requires Railway `bonnie-worker` service; without it, MCP tools fall back to direct execution where implemented.
- Pending approvals appear in `autonomous_runner_approvals` and `agent_approvals`; use `list_pending_approvals` then `approve_pending_action`.
- Force synchronous MCP email: set `MCP_SEND_EMAIL_DIRECT=true`.

## Running the audit

```bash
# Static + schema contract (all ~530 tools)
node --import tsx tests/unit/mcp-tool-contract-coverage.test.mjs

# Known failure regressions
node --import tsx tests/unit/mcp-known-failures-repair.test.mjs

# Full execution inventory
npx tsx scripts/mcp-full-execution-audit.ts --execute-read
```

Results: `artifacts/audit/mcp-tool-contract-results.json`, `artifacts/audit/mcp-full-execution-audit.json`.

## Staging-only writes

Set `MCP_AUDIT_TENANT_ID` and `MCP_AUDIT_USER_ID` to a seeded staging workspace before external-send or destructive tests.

## Provider mocks

Opt-in mocks live under `tests/mocks/providers/` for Facebook, LinkedIn, and Zoho. Live integration tests require explicit env flags and staging credentials.
