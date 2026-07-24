# Alphaclone Systems — AI Risk Register

**Framework mapping:** NIST AI RMF (Map / Measure / Manage / Govern) | ISO/IEC 42001 Clause 6.1  
**Last updated:** 2026-07-24

| ID | Risk | Likelihood | Impact | Category | Control | Owner | Status |
|----|------|------------|--------|----------|---------|-------|--------|
| AI-01 | Unsupervised send/publish by AI agent | Med | High | Art. 14 oversight | ToolPolicyGate queues send/bulk/financial; Approval Center + MCP approve | Platform | Mitigated |
| AI-02 | Autonomous mode without DPA | Med | High | GDPR / ISO 42001 | Deny autonomous high-risk without `dpa_acceptances` | Compliance | Mitigated |
| AI-03 | Cross-tenant data leakage via MCP | Med | Critical | Access control | Membership revalidation; fail-closed connector permissions | Security | Mitigated |
| AI-04 | Compromised account used for AI tools | Med | High | Auth | Real TOTP MFA; 12-char + HIBP password policy; rate limits | Security | Mitigated |
| AI-05 | Prompt injection causing financial actions | Med | High | Financial | Financial tools classified high-risk; admin-only approve | Platform | Mitigated |
| AI-06 | Marketing email without consent | Med | High | Privacy | `email_opt_in` + suppression list on campaign sends | Privacy | Mitigated |
| AI-07 | Contract signature dispute | Low | Med | Legal | contract_audit_trail + PDF audit trail with content hash | Legal | Mitigated |
| AI-08 | Provider outage / hallucinated actions | Med | Med | Reliability | DeepSeek-default routing; readiness 503; decision logs | Platform | Partial |
| AI-09 | Annex III misuse (recruitment/credit) | Low | Critical | EU AI Act | Policy prohibition; no dedicated recruitment/credit tools | Compliance | Accepted |
| AI-10 | Approval queue backlog / stalled sends | Med | Med | UX | MCP `list_pending_approvals` / `approve_pending_action`; BonnieApprovalCard diffs | Product | Mitigated |

## Measurement

- Unit tests: `tests/unit/compliance-hardening.test.mjs`
- Decision logs: `nexusDecisionLogService` / `mcp_sessions`
- Quarantine: `tenant_isolation_quarantine`

## Manage cadence

Review this register after each major AI release or security incident. Escalate Critical residual risks to executive owners before enabling new autonomous capabilities.
