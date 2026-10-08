# Client lifecycle recovery and production deployment — 8 October 2026

## Scope and evidence

Recovered the lifecycle patch onto master base ac834834 after the prior temporary checkout expired. Preserve global navigation, typography and PWA configuration. No historical CRM duplicates or platform sender accounts were deleted. External tests are authorized only for bonniiehendrix@gmail.com, clearly marked TEST ONLY and nonbinding.

## Findings and changes

| Area | Evidence and cause | Implemented change | Remaining verification |
| --- | --- | --- | --- |
| Project creation | Tool permits missing due_date; production projects.due_date was NOT NULL. Status normalization already supports active. Plain database errors were reduced to Execution failed. | Make deadlines nullable; preserve field errors and correlated diagnostics; resolve tenant canonical clients; add creation retry marker and unique index. | End-to-end production create with explicit/default status and readback after deployment. |
| Project reads/updates | Creation uses projects; reads preferred business_projects, even when empty. Status update lacked a dedicated handler. | Read both models; update canonical projects first with normalized status and persisted-row receipt; prevent tenant/ID/retry-marker reassignment. | Actual portal session visibility. |
| Account discovery | Discovery read account/sender-address rows while sends used resolved integration configuration and Zoho account discovery. | Reuse sending resolver; expose recovered sender, discovery errors and capabilities; label platform notification accounts and duplicate groups. | Confirm live discovery after deployment. |
| Delivery lookup | Numeric Zoho provider ID was treated as UUID tracking reference; receipt/canonical evidence was not resolved. | Explicit reference_type contract, safe automatic lookup, tenant-scoped receipts and account-scoped canonical evidence. Preserve acceptance; distinguish bounce/failure/delivery. Existing Brevo reconciliation remains supported. | Live MCP lookup after deployment. |
| Contract sending | Brevo verification failures were all described as inactive sender, including provider lookup failures. Tokens were generated before provider configuration was checked; send receipts referenced URLs instead of message IDs. | Typed verification errors, preflight before token creation, reusable identity-bound links and stable email retry key; provider/message/account acceptance receipt. | Brevo account verification is not confirmed. If inactive, activate bonnie@alphaclonesystems.com in the connected tenant Brevo account or select an active tenant sender. If lookup unavailable, repair that account credential/permissions/connectivity. No platform substitution. |
| Execution truth | Successful reads had no write receipt, so defaulted to REQUESTED. Object status could override execution status. Acceptance was not mapped distinctly. | Completed reads VERIFIED with explicit lookup-only wording; persisted writes use receipts; acceptance PROVIDER_PROCESSING; unevidenced writes remain REQUESTED and failures FAILED. | Post-deployment MCP responses. |
| Contract validation | Existing draft-review policy ignored missing-law/jurisdiction blockers for sending but stored critical findings. Missing-page warning could appear without multi-page evidence. | Store draft-review warnings with signature-blocking policy; require known multi-page count for page warning. Draft links cannot sign in UI or server atomic claim. No legal terms invented. | PDF/link send evidence and final signature-mode policy. |
| Identity/duplicates | Existing client 78b3844b-73ef-4920-a13f-6505040d4269 is canonical in tenant 066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4; crm_contact_id is null. Historic QA duplicates include ambiguous links. | Resolve direct business client or one explicit contact link only; reject ambiguous/foreign records; precheck duplicate email creation without merging. | Broader concurrent CRM creation and platform provisioning races remain outside this patch. No claim of historical cleanup. |

## Verification

- TypeScript check passed during recovery and at production-build start.
- 57 selected tests passed, zero failures. Includes behavioral persistence, tenant isolation, immutable fields, canonical mapping ambiguity, acceptance evidence, reference type validation, review-only signature refusal and existing gateway/reconciliation tests.
- Production migration applied through Supabase and read back: due_date nullable YES; creation retry index present.
- Production build and Railway deployment tracked separately; do not interpret a push as a successful deployment.
- Full test suite was not run: it includes unrelated/live-capable workflows. This report does not claim a full-suite pass.

## Existing durable evidence (not a new send)

Zoho provider message 1791401742485001200; action 91ffb42b-a672-4b8e-917f-9ce4c02b567d; audit ce2b72dc-d655-4c76-834c-906d87486847; receipt 739e013f-3360-4eb4-8661-e6b0e343d121; canonical message d9336392-e72b-49d7-a5d9-93864212cfc8; provider account 7b0edca8-df8c-450d-acb1-2ddb14bc9603. Evidence supports provider acceptance, not final delivery.

Existing draft contract 9d4ad497-7b90-4e46-a6c0-2f3b1671a4f2 was draft with no successful send/PDF/token evidence in the original audit. No claim that the full production lifecycle is fixed until post-deployment verification establishes it.
