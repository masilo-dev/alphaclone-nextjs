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

## Post-deployment production MCP verification

First release 9430b820 deployed successfully as Railway deployment d988fb17-811f-4278-91fd-64babbbde074. Railway completed compilation, static generation, final TypeScript check and startup validation of 20 critical settings. The first local build process encountered workspace memory pressure after compiling; its final TypeScript check passed separately.

| Acceptance item | Result | Evidence / limitation |
| --- | --- | --- |
| Existing canonical client | Passed | Live get_client_by_id returned the supplied ID, authenticated tenant and authorized email. Read truth VERIFIED. |
| Explicit-status project | Passed | 31ab2f8b-4e8b-482c-8337-3951f96a7854, Active with no invented due date. |
| Default-status project | Passed | 84f55026-857b-416d-aca6-7403e186c2a5, Active, same canonical client. |
| Description and status updates/readback | Passed | First project read back Completed with the updated TEST ONLY description. |
| Linked draft contract creation/readback | Passed | 358f0a73-ee1a-47dd-8f5e-c08a4c8f5186, draft, linked canonical client, explicitly nonbinding. |
| Business sender discovery | Passed | Zoho and tenant Brevo now report bonnie@alphaclonesystems.com; platform notification accounts are separately labeled. Five historic platform duplicates retained/reported. |
| One test email and durable evidence | Passed for acceptance | Zoho message 1791438893060013400; action 7bb4c5cc-f1da-4ae7-a382-fc5ad10a3760; audit 7ce1d465-25a7-4a41-821b-6596acc45d2b; receipt 8c96f86a-c621-4065-85b9-4fabd1500336; canonical message 87c61bec-0ede-4f00-94c0-fe875bdec464. No final delivery evidence. |
| Existing/new provider ID delivery lookup | Passed for acceptance | Both Zoho provider IDs resolve provider_accepted and durable acceptance. Followup corrects recipient extraction for email_message target records; verify after its deployment without resending. |
| Nonbinding contract send | Failed / configuration blocked | One attempt; no resend. Zoho logged a messages endpoint 404 for the PDF request, then Brevo rejected its inactive configured sender. Correlation 8a931d94-ae58-404a-ae6b-43a73ffd7098; durable action 9a07dabf-bf94-46ee-b844-4f6d4b4901d4. |
| Failed-send safety | Passed for unsent state | Contract remained draft, sent_at null, both signatures null, no related canonical outbound message. One unused review_only token 00650a89-de76-4217-b58a-db137a5bc4b1 exists and is reusable. Do not interpret token/PDF generation as a successful send. |
| PDF/link/send evidence | Blocked for accepted contract send | Code reached PDF generation and created a review-only link before provider rejection. No durable PDF URL or accepted contract send; dependent delivery/signature tests stopped. |
| Duplicate-safe project retry | Passed | Repeated identical default-status create returned the original project and receipt; SQL found exactly one matching project. No repeated email sends. |
| Tenant isolation | Passed in selected tests and live reassignment check | Tenant-scoped canonical resolution and foreign-tenant rejection tests passed. Live update with a foreign tenant field retained the authenticated tenant (normalizer discarded the supplied tenant field). This does not establish every cross-tenant endpoint. |
| Authenticated client portal visibility | Blocked | Service filters both tenant_id and canonical client_id; no authenticated client portal session was verified. |

### Findings from the real PDF send path

Zoho plain email succeeds, but the existing attachment adapter placed base64 content directly in the send-message attachments array. Zoho's documented API requires uploading binary data first and sending storeName/attachmentName/attachmentPath references. The followup implements that protocol and tests successful upload ordering and failure-before-send when references are incomplete. The logged 404 is observed evidence; the exact provider reason for that 404 is not established by the response alone. No new contract message is sent to force a pass.

Primary provider documentation: https://www.zoho.com/mail/help/api/post-upload-attachments.html and https://www.zoho.com/mail/help/api/post-send-email-attachment.html.

Contract preflight selected Zoho, but the actual gateway fell through to Brevo after the Zoho rejection. The followup pins the gateway to the exact tenant account checked during preflight, preserves provider error codes, supplies explicit contract read/write truth, and attaches FAILED truth to structured failures. It also corrects recipient extraction for email_message receipts. These additions require deployment and read-only verification; the corrected PDF transmission remains unverified live because the authorized one-attempt send has already failed.

Remaining account action: activate bonnie@alphaclonesystems.com in the connected Brevo business account, or select an active business sender for that account. Shared notifications@alphaclonesystems.com is not used as a workaround. A properly authorized client portal session is also needed for authenticated visibility verification. Historical duplicates and broader CRM/platform provisioning concurrency require separate remediation; no automatic cleanup was performed.
