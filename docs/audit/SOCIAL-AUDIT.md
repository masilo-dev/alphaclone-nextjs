# Social Execution Security Audit

## Scope

Facebook, Instagram, LinkedIn publishing and management APIs under:

- `src/app/api/facebook/**`
- `src/app/api/instagram/**`
- `src/app/api/linkedin/**`
- `src/app/api/social/schedule/route.ts`
- `src/app/api/cron/social-publish/route.ts`
- MCP: `socialPublishTool` → `executeSocialPublishCommand`
- `src/lib/social/SocialPublishingService.ts`

## Execution trace (converged path)

```
User / MCP
  → requireTenantAccess (UI) or MCP token tenant
  → executeSocialPublishCommand
  → executeDomainExternalWrite (idempotency key: domainIdempotencyKeys social)
  → SocialPublishingService (provider SDK)
  → Persist post status + external_actions + receipt
```

## Identity selection

- OAuth connections per tenant stored in integration tables (encrypted config).
- **Risk:** Wrong `page_id` / `account_id` in request body could target wrong identity if handler does not verify ownership — **NEEDS VALIDATION** per route (Facebook management, upload-photo, etc.).

## Idempotency

- Domain key stable across UI/MCP/cron (unit test `cross-surface social idempotency key stable`).
- Cron scheduled publish uses same command path (P0 convergence).
- **Retry scenario:** Timeout + user retry should hit receipt replay in `executeDomainExternalWrite` when same idempotency key supplied.

## Duplicate publish

| Scenario | Control |
|----------|---------|
| Double-click UI | Idempotency key material |
| MCP + UI collision | Shared receipt lookup (P0 test) |
| Cron + manual | Same command + keys tied to scheduled job id — **NEEDS VALIDATION** for scheduler id material |

## Media privacy

Prior audit: `artifacts/audit/media-privacy-publish-report.md` — review for cross-tenant media URLs in remediation.

## Provider token storage

- Stripping helpers: `productionGuard.stripOAuthTokens`, `maskIntegrationConfig`.
- Encryption required in production: `assertProductionEncryptionConfigured()`.

## Findings

- **SOC-IDEM-001** (P2, CONFIRMED partial): P0 domain layer provides idempotency for converged schedule path; legacy/direct Instagram post routes **NEEDS VALIDATION**.  
- **SOC-IDENT-001** (P1, NEEDS VALIDATION): Provider identity substitution via manipulated account/page ID parameters.  
