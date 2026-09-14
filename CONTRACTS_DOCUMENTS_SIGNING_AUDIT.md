# Contracts, documents, signing and portal audit

Audit date: 2026-09-14. This is a source audit; no production tenant, storage object, email provider, or database was changed.

## Current journey map

| Journey | Current path | Finding |
| --- | --- | --- |
| Owner sends an agreement | contract APIs, signing tokens, parties, lifecycle/audit records | Existing tenant-scoped structures and ordered-party handling are present. |
| Client reviews/signs | `/contract/[token]` → `/api/contracts/sign` | Token expiry/revocation and atomic claim are implemented server-side. |
| Multiple signers | `contract_parties`, signing order checks, reminder service | Earlier required signers are checked before a later signature. |
| Completion effects | signing route → notifications, automation, PDF filing | Existing server route generates the PDF and triggers downstream actions. |
| Client retrieval | public signing view / existing finance portal | A unified client document workspace and authenticated short-lived download surface are still incomplete. |

## P0 issue fixed

The public signing page generated a browser-side PDF labelled “CERTIFIED CONTRACT” with a “VERIFIED” seal after the browser submitted a signature. That was not authoritative and could be produced without server storage verification. The page now submits only to the server signing API, removes the generic AI disclaimer from the primary signing surface, and presents a receipt-oriented completion state without creating or certifying a browser PDF.

## Gap table

| Requirement | Status | Evidence |
| --- | --- | --- |
| Tenant-scoped signing token resolution | PASS | `contract_signing_tokens` lookup includes `tenant_id`; token service checks expiry/revocation. |
| Ordered multi-signer gate | PASS | `contractServerService.signContract` checks earlier required parties. |
| Browser cannot certify contract | PASS | [public signing page](src/app/contract/[id]/page.tsx) now calls only `/api/contracts/sign`. |
| Server-owned frozen PDF/certificate pipeline | PARTIAL | Server generates/files a PDF, but immutable version storage, certificate artifact, and storage verification are not yet evidenced end-to-end. |
| Private authenticated short-lived download | FAIL | Existing completion code still calls storage `getPublicUrl`; it requires a separate protected download endpoint and storage migration. |
| Unified client Home/Documents/Contracts/Invoices/Projects/Messages/Help | PARTIAL | Finance and project portal surfaces exist, but the requested unified document workspace is not yet present. |
| Full external signer accessibility/mobile/E2E | PARTIAL | Existing signing UI has consent and signature input; required automated mobile/accessibility and two-signer E2E coverage was not found. |

## Recommended next phase

Add an immutable envelope/version/certificate schema, private storage objects, signed download issuance with token/revocation checks, a post-storage-verification completion worker, then migrate the owner/client UI to the authoritative envelope endpoints. Do not represent legal verification or PDF certification until that evidence pipeline is complete.
