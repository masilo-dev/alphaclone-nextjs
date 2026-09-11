# Penpot on Railway — AlphaClone integration contract

Penpot is an isolated design engine. AlphaClone remains the business system of record.

## Safety gate

Keep `PENPOT_ENABLED=false` globally until the service, storage, database, access token and health checks are verified. A Penpot outage must never block login, CRM, Projects, invoices, contracts, Bonnie, MCP or normal email.

## Railway services

Provision Penpot as isolated services in the existing Railway project, not inside `alphaclone-nextjs`:

- Penpot frontend/backend according to the supported self-host topology.
- Dedicated Penpot PostgreSQL database.
- Dedicated Penpot storage (Railway volume or supported object storage).
- Optional Redis/Valkey only where required by the Penpot version being deployed.

Do not reuse AlphaClone Supabase as Penpot's database.

## AlphaClone web variables

Set only on the AlphaClone server service:

- `PENPOT_BASE_URL=https://<penpot-service>`
- `PENPOT_ACCESS_TOKEN=<server-only personal access token>`
- `PENPOT_TEAM_ID=<team UUID used for AlphaClone-created design projects>`
- `PENPOT_ENABLED=false` until verification completes

Never expose `PENPOT_ACCESS_TOKEN` through `NEXT_PUBLIC_*` variables or browser responses.

## Penpot configuration

Enable access tokens and webhooks in the Penpot deployment. Keep backend API documentation enabled only in controlled non-production environments if needed for integration diagnostics.

## Verification before rollout

1. Penpot UI loads independently.
2. Penpot backend can return `get-profile` with the AlphaClone token.
3. Creating a test Penpot project succeeds.
4. Creating a test file succeeds.
5. AlphaClone `/api/tenant/<tenant>/projects/<project>/designs` returns mappings when the tenant flag is enabled.
6. Stop Penpot and verify AlphaClone Projects, CRM, finance, Bonnie/MCP and normal email still work.
7. Restore Penpot and verify retrying the same idempotency key does not create another design file.
8. Enable `PENPOT_ENABLED` for one test tenant only before wider rollout.

## Business workflow

`Project -> Design task -> Penpot file -> AlphaClone approval -> approved -> dependent task unlocks`

The Penpot file ID/preview URL is mapped to the AlphaClone project/task/approval. Approval state remains in AlphaClone's `project_client_approvals` and immutable history tables.
