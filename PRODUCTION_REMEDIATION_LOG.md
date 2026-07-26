# Production remediation log

| Date | Finding | Change | Verification | Deployment |
| --- | --- | --- | --- | --- |
| 2026-07-26 | MCP tokens coupled by user/client | Added grants, token families, sessions, encryption fields, preservation backfill | MCP suites passed | Pending |
| 2026-07-26 | Flat 462-tool discovery | Added bounded 26-tool progressive discovery | Registry suite passed | Application deploy pending |
| 2026-07-26 | Public PII/quarantine tables | Added RLS/revoke migration and rollback | Static security tests passed | Pending backup/dry-run |
| 2026-07-26 | Membership schema probes generate 400s | Removed `tenant_users.status` probes | Targeted tests passed | Application deploy pending |
| 2026-07-26 | No consolidated baseline command | Added `audit:production`, `audit:data`, `audit:routes`, `audit:inventory` | Commands executed | Repository only |
| 2026-07-26 | Four owner-rights public views | Added security-invoker migration | Static regression test passed | Pending |
| 2026-07-26 | Mutable security-definer search paths | Added signature-preserving search-path migration | Static regression test passed | Pending |
| 2026-07-26 | Missing token-hash confirmation route | Added server-only `/auth/confirm` | Auth source regression test passed | Application deploy pending |

No production mutation was performed.
