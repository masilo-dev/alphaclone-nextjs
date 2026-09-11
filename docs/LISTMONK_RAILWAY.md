# Listmonk on Railway

Listmonk is auxiliary campaign infrastructure for AlphaClone Marketing Hub. AlphaClone remains the system of record and the user-facing control plane.

## Safety

- Keep `LISTMONK_ENABLED=false` until the service and database pass health checks.
- A Listmonk outage must not affect login, CRM, contracts, invoices, Projects, Bonnie, MCP, or normal transactional email.
- Do not expose the Listmonk admin UI as the normal customer experience.
- Do not store Listmonk API credentials in Supabase business tables.

## Railway services

Provision these inside the existing AlphaClone Railway project:

1. `alphaclone-listmonk`
   - Image: official Listmonk container image pinned to an approved version.
   - Internal port: `9000`.
   - Public networking is optional; AlphaClone should use a private/internal Railway URL where available.
   - Health verification: authenticated `GET /api/lists?minimal=true&per_page=1` from AlphaClone.

2. `alphaclone-listmonk-db`
   - Dedicated PostgreSQL database.
   - Must not reuse the AlphaClone Supabase application database.
   - Credentials are supplied only to the Listmonk service.

## AlphaClone web variables

Set on `alphaclone-web`:

- `LISTMONK_ENABLED=false`
- `LISTMONK_URL=http://<railway-private-listmonk-host>:9000`
- `LISTMONK_API_USER=<api-user>`
- `LISTMONK_API_TOKEN=<access-token>`

The API user should have only the permissions needed for lists, subscribers, campaigns, and campaign status/statistics.

## Listmonk variables

Configure Listmonk using its supported environment/configuration mechanism with the dedicated PostgreSQL connection. Keep database credentials scoped to the Listmonk service.

## Rollout

1. Provision the Listmonk PostgreSQL database.
2. Provision Listmonk and verify it starts independently of AlphaClone.
3. Create a dedicated Listmonk API user/token.
4. Add `LISTMONK_URL`, `LISTMONK_API_USER`, and `LISTMONK_API_TOKEN` to `alphaclone-web`.
5. Leave `LISTMONK_ENABLED=false`.
6. Deploy AlphaClone.
7. Confirm CRM, normal email, invoices, Projects, Bonnie and MCP continue to work with Listmonk stopped.
8. Start Listmonk and verify the tenant health endpoint.
9. Enable `LISTMONK_ENABLED` for one test tenant only.
10. Test list sync, suppression/unsubscribe, campaign idempotency, send status, and failure recovery before broader rollout.

## Failure behavior

When Listmonk is unavailable, AlphaClone should return a degraded integration state and keep the campaign operation retryable. It must never fall back to repeatedly sending the same campaign through another provider because a Listmonk request timed out.
