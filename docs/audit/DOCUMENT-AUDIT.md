# Document & Contract Security Audit

## Subsystems

- Document requirements / data rooms: `/api/document-requirements`, `/api/document-data-rooms`
- Contracts: `/api/contracts/management`, `/api/contracts/respond`, signatures via contract services
- Client finance portal document access: `/api/client-finance/document`
- Google Drive upload: `/api/google/drive/upload`
- MCP document tools (`accept_document`, etc.) — see MCP exposure report

## Access paths

| Path | Auth | Isolation mechanism |
|------|------|---------------------|
| Staff CRM documents | Session + tenant | `requireTenantAccess` + tenant filters |
| Client portal | Portal JWT + token | `requireClientPortalAccessDoubleGuarded` + `documentId` scoped to client |
| Public contract respond | Token/link | **NEEDS VALIDATION** on respond route |
| Signed URLs / storage | Supabase storage | Bucket policies + path conventions |

## Client portal document GET

Evidence: `src/app/api/client-finance/document/route.ts`

- Requires `token` (portal) + `documentId`.
- Double guard resolves client; fetches document with client/tenant constraints (see file lines 40+).

**Attack:** Replace `documentId` with another client’s UUID — must return 403/404 if guard compares `client_id` on row.

## Contract send (converged)

`executeContractSendCommand` wraps domain external write — audit trail + idempotency.

## Storage path manipulation

- **Hunt:** User-supplied paths in upload handlers must normalize and prefix with tenant — **NEEDS VALIDATION** per upload route (`facebook/upload-photo`, drive upload, attachments).

## Sensitive leakage

- `stripOAuthTokens` / masking used in admin responses.
- Templates should not embed service credentials in HTML emailed to clients — **NEEDS VALIDATION** on email template audit artifact.

## Findings

- **DOC-PORTAL-001** (P1, NEEDS VALIDATION): IDOR on `documentId` for client finance routes — requires live test with two portal sessions.  
- **DOC-STORAGE-001** (P2, NEEDS VALIDATION): Storage RLS/path prefix consistency across all upload entrypoints.  
