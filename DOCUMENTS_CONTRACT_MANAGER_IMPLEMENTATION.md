# Documents and Contract Manager implementation

## Architecture and reuse map

The authenticated catch-all dashboard and its existing sidebar remain the application shell. `documents` is the canonical tenant metadata catalogue. `file_uploads` remains the upload/security/storage record and the private `uploads` bucket remains the binary source of truth. `doc_os_*` remains the immutable lifecycle, version, signature, approval and retention ledger. The existing `contracts` table remains the operational contract record and now references one canonical document.

Existing systems reused:

- Authentication and membership: `requireTenantAccess`, `tenant_users`, Supabase Auth.
- Storage and signed access: the private `uploads` bucket, tenant storage paths, `/api/storage`.
- File validation: the existing tenant file API MIME, size and generated-key checks.
- Lifecycle and immutable versions: `src/lib/document-os` and `doc_os_*`.
- Approval/signature: existing contract approvals, signature envelopes and signing services.
- Tasks/calendar: existing shared task and calendar tables; obligation/milestone rows store their shared record IDs.
- Notifications, automation and audit: existing notification services, `business_automation_events`, `audit_logs`, plus the append-only document activity ledger.
- Bonnie: existing permissioned MCP document and contract tools.
- UI: existing dashboard shell, workspace colours, responsive header, tables, skeletons and mobile navigation.

## Domain model

A document owns metadata, content/storage references, status, expiry, access state and relationships. `document_relationships` is the tenant-safe polymorphic join that exposes the same record in CRM, projects, invoices, campaigns and contracts. It does not copy files.

A contract owns lifecycle and commercial metadata and references `documents.id`. Parties preserve signed legal snapshots while optionally retaining CRM IDs. Obligations and milestones link to shared tasks, calendar events, invoices and evidence documents through IDs and idempotency keys.

Contract transitions and deterministic, explainable risk signals live in `src/lib/contracts/contractManagerDomain.ts`. Signed document content is rejected by the update API; amendments must create a new document/version.

## Storage and processing

New uploads use generated tenant paths. The upload route records the object once in `file_uploads`, then registers its metadata in `documents` and creates relationships. Download/preview continues through authenticated proxy or short-lived signed access; permanent public URLs are not introduced.

The current upload scan is a synchronous signature/pattern check and marks accepted uploads clean. Production malware scanning, preview conversion, OCR and full-text extraction still require an external scanner/converter worker (see limitations).

## Routes

Dashboard routes are handled by the existing `/dashboard/[[...slug]]` catch-all:

- `/dashboard/business/documents`
- `/dashboard/business/documents/all`
- `/dashboard/business/documents/mine`
- `/dashboard/business/documents/shared`
- `/dashboard/business/documents/recent`
- `/dashboard/business/documents/favourites`
- `/dashboard/business/documents/templates`
- `/dashboard/business/documents/requests`
- `/dashboard/business/documents/approvals`
- `/dashboard/business/documents/expiring`
- `/dashboard/business/documents/archive`
- `/dashboard/business/documents/trash`
- `/dashboard/business/documents/settings`
- Existing contract routes remain `/dashboard/business/contracts` and `/dashboard/business/contracts/manage`.

APIs:

- `GET/POST /api/tenant/[tenantId]/documents`
- `GET/PATCH /api/tenant/[tenantId]/documents/[documentId]`
- Existing tenant upload and contract creation APIs now register shared documents.

## Deployment

1. Back up the database and verify the `tenants`, `tenant_users`, `documents`, `file_uploads`, `contracts`, tasks and calendar tables.
2. Apply `20260726180000_documents_contracts_shared_platform.sql`.
3. Verify its backfill counts and ensure every active `file_uploads` row has a `document_id`.
4. Deploy the application.
5. Smoke test cross-tenant list/detail/update attempts, upload, document creation, contract creation, storage proxy access, archive/trash and signed-document mutation.
6. Start or connect production malware scanning and preview workers before allowing untrusted external uploads.

## Rollback

Deploy the previous application version, then run the paired down migration. It drops only newly introduced relation/operations tables. New columns are deliberately retained because removing them could destroy production metadata. Storage objects, existing documents, uploads and contracts are never deleted by rollback.

## Known limitations and manual setup

- External sharing/request redemption endpoints and provider email delivery are schema-ready but not enabled until a production email provider, rate limiter and malware scanner are configured.
- Native Office preview requires a document conversion worker; unsupported formats use secure download fallback.
- The existing contract manager remains the drafting/signature UI. The shared-document link is created for new API-created contracts; historical contracts require a controlled backfill once their source content is reviewed.
- Obligation-to-task and milestone-to-calendar workers need deployment against the existing durable workflow runtime. Idempotency columns are present, but no recurring worker is enabled by this migration.
- Clause library, redlining and rich inline collaboration are not yet exposed in the UI.
- Database-generated TypeScript types must be regenerated after applying the migration.
