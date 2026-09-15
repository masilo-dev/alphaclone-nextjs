# Social publishing pipeline audit — 2026-09-15

## Findings fixed

- Direct MCP upload rejected `openai_file_id` and `local_file_path` instead of resolving bytes.
- Large transfers depended on Base64 JSON despite resumable upload primitives already existing.
- Video assets were signature-checked but not fully probed before `ready`.
- Direct Instagram publishing waited synchronously for container processing, causing 15-second client timeouts.
- Instagram ledger rows were created after provider work, leaving retries unsafe.
- Instagram records could omit container ID, media ID, permalink, and verification timestamp.
- `create_social_post_with_media` could infer Facebook when a LinkedIn organization ID was supplied without `platform`.
- Instagram deletion could remove only the internal record without honest provider capability evidence.

## Implemented architecture

1. Resolve local/OpenAI/HTTPS attachment references as streams; never interpret references as Base64.
2. Inspect signature, enforce configurable size limits, upload original bytes, read them back, compare size/checksum, and fully probe media.
3. Persist original/final technical metadata. They are identical unless a future explicit transcoding policy changes the bytes.
4. Resolve an active identity inside the authenticated tenant and reject type/provider mismatches.
5. Atomically create `social_publish_operations` using the deterministic tenant/identity/platform/checksum/caption/time key.
6. Persist the Instagram container and return a pending receipt immediately.
7. Reconcile via the existing authenticated social reconciliation cron with bounded exponential backoff.
8. Store and verify final provider media ID and permalink before `published`.

## Provider limitations

- Meta's Instagram Content Publishing API does not provide a general delete endpoint for already-published Instagram media. `delete_social_post(delete_from_provider=true)` now reports `INSTAGRAM_PROVIDER_DELETE_UNAVAILABLE` and preserves the internal ledger.
- OpenAI file references require `OPENAI_API_KEY` with access to that file. ChatGPT-host-private file IDs cannot be downloaded by an unrelated AlphaClone credential; in that case the connector must stream/multipart-upload the bytes or use the resumable upload tools.
- Live Facebook/Instagram E2E publication requires dedicated Meta test identities and tokens. The provider-backed regression is opt-in and refuses to use implicit production identities.

## Verification performed

- TypeScript: pass.
- Targeted ESLint: pass.
- Social/identity regression selection: 81 pass.
- New production-pipeline tests: 7 pass.
- Generated and probed a 9,827,055-byte, 15-second, 1080×1920 H.264/AAC MP4 at 30 fps without transcoding: pass.
- Full repository unit command: not green because of unrelated existing suites and missing test environment configuration; see command output in the development handoff.
- Live provider E2E: not run; no dedicated provider test credentials were available. Completion must not be claimed until it passes.

## Rollback

1. Stop the social reconciliation cron.
2. Revert the application commit.
3. Keep `social_publish_operations` for audit history, or drop the new foreign key/columns and table only after exporting operation receipts.
4. Resume the prior publisher. Do not replay operations in `provider_processing` or `reconciliation_required` without provider reconciliation.
