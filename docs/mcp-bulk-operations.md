# Safe Bulk MCP Operations

## Goal

Provide one consistent MCP surface for safe, high-volume operations across CRM, client, invoice, project, task, document, media, and email workflows. The feature must make simulation the default, preserve tenant isolation, enforce maximum batch sizes, return item-level outcomes, and require explicit execution confirmation for customer-facing sends.

## New MCP actions

| Tool | Purpose | Default behavior |
|---|---|---|
| `bulk_update_records` | Move uniform sets of leads, clients, contacts, invoices, projects, or tasks into a requested status or stage. | Dry run only. |
| `bulk_upload_media` | Ingest multiple image, video, or document inputs into permanent tenant storage. | Executes storage ingestion with per-item outcomes; it does not publish anything. |
| `send_bulk_email` | Prepare or send one approved message to a defined list of CRM recipients. | Dry run only; sending requires an explicit confirmation field and idempotency key. |

## Guardrails

Every request is tenant-scoped. Each tool validates all record identifiers, rejects unsupported state fields for the selected record type, and limits requests to 250 record or media items. Read-before-write simulation is the default for record transitions and email. A non-dry execution must include a unique idempotency key. Batch email also requires `confirm_send: true`, deduplicates recipients by normalized email, excludes records without a valid email address, and returns individual successes, skips, and failures.

Bulk updates affect only one record type and one common patch per request. They return the pre-change and proposed values during simulation. Executed updates return the IDs updated, IDs skipped, and a receipt carrying the batch correlation identifier. The implementation does not send any email, publish content, charge money, or create a campaign as a side effect of a record-stage update.

## Supported record operations

| Record type | Supported common patch |
|---|---|
| `lead` | `status`, `stage`, `notes` |
| `client` | `sales_stage`, `is_active`, `notes` |
| `contact` | `status` |
| `invoice` | `status`, `lifecycle_status` |
| `project` | `status` |
| `task` | `status`, `priority`, `assigned_to`, `due_date` |

## Acceptance criteria

1. The three new tools are registered in the connector tool registry and visible to MCP clients.
2. Each tool rejects missing, invalid, cross-tenant, or oversized item collections.
3. `bulk_update_records` and `send_bulk_email` default to `dry_run: true`.
4. Non-dry record changes and sends require an idempotency key; email sends additionally require `confirm_send: true`.
5. Batch responses include requested, eligible, updated/sent, skipped, and failed counts with item-level summaries.
6. Media upload returns a permanent storage receipt for every successfully ingested asset.
7. Automated tests check registration, default dry-run semantics, explicit confirmation requirements, supported record types, batch-size constraints, and receipt/idempotency integration.

## Out of scope

This change does not automatically execute future batches, enroll recipients in campaigns, or bypass approval policies. High-impact activity remains subject to the existing approval queue and provider readiness checks.
