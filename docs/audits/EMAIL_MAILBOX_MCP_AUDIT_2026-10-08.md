# Email mailbox MCP audit — 8 October 2026

## Root cause

The generic MCP readers queried project notification dispatches and outbound execution logs instead of the connected mailbox. The registered sync handler returned `synced` without provider sync or completion evidence. Connected-account reporting checked configuration, not mailbox access. Reply lookup was bounded and could swallow provider failures, while reply sends bypassed the ordinary execution pipeline and could invent a message reference. Direct addresses were supported at argument resolution but rejected by the downstream CRM recipient gate. CC/BCC, exact content and attachments were lost in several intermediate paths; argument normalization flattened recipient arrays and generated fresh retry keys.

## Implementation

Added a tenant- and mailbox-scoped canonical Zoho mailbox service shared by account discovery, reading, search, content, conversations and sync. Real access checks discover account identity and folders and distinguish provider failures from an empty inbox. Provider IDs remain exact strings. Reads include full content and attachment metadata without implicitly marking read. Cached conversations report their coverage and freshness.

Added a restricted PostgreSQL ingestion function and resumable sync jobs with pagination, incremental watermarks, leases, progress, completion and errors. Ingestion preserves native account/folder/message/thread identity and deduplicates messages atomically. Pending jobs can be resumed explicitly or by the cron route; they are not reported completed.

Replies resolve their original mailbox and use the Zoho native reply endpoint with reply/reply-all recipient selection, attachments and provider references. They run through the normal execution gateway with duplicate-safe operation claims. New conversations accept explicit validated To/CC/BCC addresses without CRM creation, preserve content, select a user sending mailbox and persist durable provider acceptance references. Platform notification accounts are excluded from ordinary conversation selection. Ambiguous send outcomes remain unknown and are not blindly retried.

The global navigation, PWA design and typography were not changed.

## Live evidence

The deployed generic `read_emails` returned zero and account listing lacked sender/capabilities. Through the authenticated production native Zoho MCP handler, actual Inbox and Sent folder IDs were discovered, and an existing incoming Azure service notice was listed and its full body retrieved. A provider search found the same message. This proves this mailbox was not empty and existing credentials had read access; configuration alone was not used as proof. No reconnection was required by the observed evidence.

No live reply or new conversation was sent. No arbitrary real contact was used for testing.

## Local verification

- TypeScript: `npm run typecheck` passed.
- Email regressions, mailbox handler behavior, execution truth and static registry loading: 99 checks passed.
- Broader contract run: 133 passed, two failed. Both failures also reproduce on the unchanged initial checkout: the execution-gateway source contract and invoice-entrypoint source contract. They are unrelated to mailbox behavior.
- Local PostgreSQL (PGlite): migration applied twice; deduplication, shared thread identity, chronological ordering, tenant isolation and restricted RPC access passed.
- Behavioral tests exercise actual production handlers/modules with controlled provider/database boundaries: read/content/search/conversation, empty inbox versus provider failure, credential/scope failure, sync continuation and retries, tenant/platform isolation, native replies/references, direct recipients absent from CRM, exact CC/BCC/content, attachment propagation and duplicate-safe sends.

These controlled tests are not proof of a deployed provider send or sync.

## Remaining live verification and deployment

Apply `supabase/migrations/20261008090000_mcp_mailbox_sync.sql`, deploy the application, and confirm the sync cron remains scheduled. The current production application does not contain these changes; this is the blocker for live generic-handler retesting.

Then use an owner-authorized mailbox and recipient to test: list/read/search/conversation; receive a fresh message, run/resume sync and confirm it is readable; send a native threaded reply and inspect provider references; send a new conversation to an owner-controlled address absent from CRM and verify no contact was created; read Sent; retry the same operation and confirm no duplicate. Provider acceptance must not be called inbox delivery.

This implementation provides the Zoho read/sync adapter. Other providers without a mailbox adapter report an explicit unsupported error. A complete cached conversation requires completing mailbox sync; bounded reads and partial initial sync explicitly report their coverage/state. Previously stored OAuth credentials without recorded scopes cannot establish send capability from configuration alone; actual accepted sending supplies verification.
