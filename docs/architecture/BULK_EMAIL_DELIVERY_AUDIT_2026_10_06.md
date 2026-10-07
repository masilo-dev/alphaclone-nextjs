# Bulk email execution and delivery audit — 2026-10-06

Implementation is ready for review, but production delivery validation is incomplete. No deployment or new live email was performed. Recipient addresses and production secrets are deliberately omitted from this repository document.

## Confirmed production evidence

- The approved Zoho bulk operation preserved the original five contact IDs, `provider: zoho`, `dry_run: false`, and `confirm_send: true`. Its full MCP receipt reports **processed 5, eligible 5, sent 0, failed 5**. Each recipient failed with `zoho: Tenant provider sender email is missing`. These are pre-transmission failures, not delivery failures. No provider message IDs exist for this batch.
- Approval returned execution success without useful recipient results. The approval payload's `details` was cut at 2,000 characters, while the complete MCP receipt contains the failures. The bulk handler classified completion of the loop as success despite all recipient sends failing.
- The tenant Zoho integration is enabled and contains an account ID and OAuth configuration, but no sender email. Its canonical provider account also has no email address and no sender address is persisted. Health checks verified configuration presence, not a functioning sender or delivery.
- Account discovery queried legacy `integrations.provider` and `status`; the actual Zoho and Brevo rows use `type` and `enabled`, with `provider` and `status` null. Discovery also ignored query errors. This explains the empty account list despite enabled integrations.
- The separately accepted Brevo message has an actual provider message ID, a canonical message and a `provider_accepted` event. `delivered_at`, `bounced_at` and `failed_at` are null. Acceptance is the only available message evidence. The recipient reported no receipt.
- That message's recorded sender was `bonnie@alphaclonesystems.com`; the connected Brevo sender listing returned only active `sales@alphaclonesystems.com`. This mismatch warrants correction, but does **not** establish the cause of nonreceipt. The connected Brevo application's credential identity relative to the tenant's saved credential was not proven.
- Brevo's connected account reported relay enabled and a free plan with 300 credits. This does not prove the exact tenant credential's restrictions, quota at send time, domain authentication or message-specific outcome.
- Production variable names did not include `EMAIL_WEBHOOK_TOKEN` or `EMAIL_WEBHOOK_SHARED_TOKEN`, required by the existing email webhook endpoints. Provider callback configuration was not available, so the audit does not assert which endpoint was configured.
- No stuck email queue event was found in the inspected period. HTTP 200 and successful audit entries are not delivery evidence.
- PostgreSQL rejected contact status `lead` with constraint `valid_status`; allowed contact values are `active`, `inactive`, `unsubscribed`, `bounced`. Explicit `active` succeeded.
- Logs repeatedly warned that sanitizer `allowedTags` included `style`.

## Changes

The existing `EmailExecutionService → gateway → sendEmail → provider adapter → canonical persistence` path remains the sending pipeline. There is no additional sender implementation.

- Preserve complete approval arguments, generate the retry identity before approval, atomically claim a pending approval, and retain/return full structured execution results independently of short summaries.
- Use tenant-scoped durable operation claims in existing `mcp_action_receipts`, with one batch record, checkpointed recipient results, and canonical individual send records. Concurrent or uncertain operations cannot trigger a second send. Interrupted batches retain checkpointed outcomes.
- Preserve explicit provider/account selection. Include provider/account in generated send identities and derive stable individual keys from batch key plus normalized email. Deduplicate CRM recipients across record types by normalized email.
- Keep dry runs out of the send pipeline and return validation, suppression and duplicate results. Preserve approval, consent, unsubscribe, suppression and permission controls.
- Resolve missing Zoho sender identity through its authenticated account API for the selected account; reject ambiguous accounts or unverified senders. Preserve all recipients in Zoho's adapter instead of extracting only the first address. Never fabricate provider message IDs.
- Validate Brevo's configured sender against its exact credential before transmission. An invalid sender is an actionable failure, not silent substitution.
- Stop provider fallback after an unknown network/timeout outcome. Retain actual provider IDs and acceptance evidence even if local persistence fails.
- Expose acceptance separately from delivery in MCP, execution commands and workers. Unknown worker outcomes require intervention/reconciliation instead of automatic retry.
- Discover canonical tenant provider accounts and report configuration limitations honestly. Zoho health explicitly reports its limited verification scope.
- Add exact tenant/account/message Brevo event reconciliation to receipt reads. Authenticated webhook events update canonical messages and recipients; unprocessed events can be reapplied after projection failures. Out-of-order acceptance does not downgrade stronger recipient evidence. Suppression cleanup still applies to bounces, complaints and unsubscribes.
- Default `create_contact` to `active`, validate allowed statuses, and retain `lead` as the separate sales pipeline stage.
- Remove unsafe style blocks from sanitizer tags, retain narrowly allowed inline layout styles, and drop active HTML/CSS content.

## Validation

Focused tests execute real TypeScript modules with external provider/database boundaries mocked. They cover approval argument/result preservation, retry key generation before approval, zero-send dry runs, normalized deduplication, partial failures, explicit provider routing, concurrency/idempotent replay, unknown-outcome reconciliation, stopping fallback after uncertain responses, sender identity selection and rejection, safe rendering, and acceptance versus delivery.

The focused suite passed 39 tests; the related regression suite passed 44 tests (83 total, zero failures). Standalone TypeScript validation passed. `npm run build` completed successfully, including the post-build TypeScript check, against the committed implementation. Warnings remain for scraper dependency loading, service-worker registration and missing local VAPID configuration. No mocked test is presented as live delivery evidence.

## Live result matrix

Recipients R1–R6 follow the private order supplied in the task. Addresses are not published here.

| Recipient | Previous Zoho result | Previous Brevo result | New verification sends |
| --- | --- | --- | --- |
| R1 | Failed before provider request: missing sender | No attempt identified | Not performed |
| R2 | Failed before provider request: missing sender | No attempt identified | Not performed |
| R3 | Failed before provider request: missing sender | No attempt identified | Not performed |
| R4 | Failed before provider request: missing sender | No attempt identified | Not performed |
| R5 | Failed before provider request: missing sender | No attempt identified | Not performed |
| R6 | No attempt identified | Provider accepted; delivery unknown | Not performed |

The five Zoho rows have no selected usable sender, provider message ID or delivery evidence. The Brevo row has a recorded sender and provider message ID but no downstream delivery evidence.

## Remaining gates

1. Review and explicitly authorize deployment separately. This task did not authorize deployment.
2. Reconcile the original Brevo message in the exact tenant provider account's transactional event log; obtain delivery, deferral, blocking, suppression or bounce evidence. The installed Brevo connector lacks an exact transactional-message event lookup. The new authenticated reconciliation code cannot run in production until deployed.
3. Verify Zoho's selected sender/account and Brevo's saved sender, account restrictions, credentials, quotas and SPF/DKIM/DMARC against their actual tenant credentials. No secret was printed and no unsupported cause is asserted.
4. Configure the existing authenticated callback path as appropriate without weakening verification.
5. After those gates, send a distinct Zoho and Brevo test run only to the six authorized addresses, one recipient per message, with stable operation keys, distinct run IDs/subjects, and actual selected sender/provider/message IDs. Record receiving-server evidence and recipient-confirmed inbox receipt separately. Stop on uncertain outcomes and reconcile before another send.

No claim of end-to-end delivery completion is supported yet.
