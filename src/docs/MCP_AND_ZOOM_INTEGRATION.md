# MCP audit (Claude and Manus) and Zoom video integration

This document describes what is implemented in the repository today, how the Supabase MCP fits in, and how to add Zoom alongside Daily.co with a production-oriented path and custom UI.

## 1. MCP audit: what actually works

### 1.1 Cursor / IDE MCP (this workspace)

Under the Cursor MCP file system for this project, only the **Supabase** MCP plugin is configured (`plugin-supabase-supabase`). It exposes project management, migrations, SQL, logs, and docs search. There is **no** separate “Claude MCP” or “Manus MCP” server definition in the repo’s `mcps` folder.

**Verdict:** Supabase MCP works when your Cursor account is linked to Supabase and the plugin is enabled. Use it for migrations (`apply_migration`, `execute_sql`), advisors, and type generation.

### 1.2 “Claude MCP” and “Manus MCP” in the app UI

In `src/services/integrationService.ts`, **Claude Desktop (MCP)** and **Manus AI (MCP)** are wired as follows:

- **Connect** sends the user to **Marketplace → MCP setup** (`/dashboard/marketplace?mcp=claude` or `manus`) where `MCPSetupGuide` issues or rotates an `mcp_api_keys` row.
- **Connected** status in Settings → Integrations is derived when that tenant has an MCP API key (both catalog entries share the same key infrastructure).
- **Disconnect** deletes the tenant’s `mcp_api_keys` row (revokes Claude and Manus access together).

The **HTTP MCP transport** is implemented under **`/api/mcp/sse`** (Pages Router). In API-key mode, the setup guide uses **`/api/mcp/sse?api_key=<token>` only**; tenant and user are inferred from `mcp_api_keys` (no `tenant_id` in the URL). Optional **OAuth 2.1** for MCP clients uses `mcp_oauth_*` tables plus `/.well-known/oauth-authorization-server` and `/api/oauth/token`.

**What is already in the database for MCP (OAuth 2.1 style)**

Migration `20260409181012_oauth_2_1_mcp_authorization.sql` (and related usage of `mcp_api_keys`) supports **MCP OAuth-style flows** at the platform level: `mcp_oauth_clients`, `mcp_oauth_codes`, `mcp_oauth_tokens`, `mcp_api_keys`. That is the correct place to persist **client registrations and tokens** for external MCP clients (e.g. Claude Desktop) calling **your** API — not the same as “click Connect” on a static catalog row.

**Verdict:** Claude/Manus are **operational** for API-key mode via the setup guide. Hardening steps: encrypt tokens at rest, narrow RLS on `mcp_api_keys`, and add refresh-token rotation for Zoom metadata stored in `tenant_integrations`.

### 1.2b Zoom OAuth (tenant connect)

Routes:

- `GET /api/zoom/oauth?tenant_id=<uuid>` — starts OAuth (user must be a member of the tenant).
- `GET /api/zoom/oauth/callback` — exchanges code, writes `tenant_integrations` (`zoom`) and `tenant_zoom_settings` when that migration exists.

Environment:

- `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`
- Optional `ZOOM_OAUTH_SCOPES` (default `user:read:user meeting:read meeting:write`)
- Register the callback URL in the Zoom app: `{NEXT_PUBLIC_APP_URL}/api/zoom/oauth/callback`

Database: `oauth_states.tenant_id` (migration `20260412100000_oauth_states_tenant_id.sql`) links the OAuth state to the workspace.

### 1.3 Making Claude / Manus “work well” (recommended next steps)

1. **Claude Desktop:** Register an OAuth client in your MCP authorization layer, document the redirect URL and scopes, and issue tokens into `mcp_oauth_tokens`. Point Claude Desktop’s MCP config at your **HTTPS** MCP endpoint.
2. **Manus:** Same pattern — Manus needs a documented MCP server URL, client id/secret or API key strategy, and strict tenant scoping on every tool.
3. **Never** store long-lived secrets in `tenant_integrations.metadata` without encryption; prefer **Supabase Vault** or **server-only environment variables**, with only opaque references in the database.

---

## 2. Zoom vs Daily.co: official product choice

Zoom offers two main developer paths relevant to “our own custom UI”:

| Approach | Custom UI | Typical use | Official docs |
|----------|-----------|-------------|----------------|
| **Zoom Video SDK** | Full — you build layout, controls, screen share, etc. (optionally start from [UI Toolkit for web](https://developers.zoom.us/docs/video-sdk/web/ui-toolkit/)) | In-app video that feels like **your** product | [Video SDK](https://developers.zoom.us/docs/video-sdk/), [Web get started](https://developers.zoom.us/docs/video-sdk/web/get-started/) |
| **Zoom Meeting SDK** | Partial — hosted meeting experience with some branding/customization | Faster to ship if embedding standard Zoom meetings is acceptable | [Meeting SDK](https://developers.zoom.us/docs/meeting-sdk/) |
| **REST Meeting API only** | None in-app — you create meetings and open `join_url` in a new tab or embedded web client | Scheduling + links, minimal engineering | [Zoom Meeting API](https://developers.zoom.us/docs/api/) |

**Alignment with “custom UI”:** The documentation Zoom publishes for **full custom UI** is centered on the **Video SDK** (and the optional **UI Toolkit** as a starting point). Meeting SDK is appropriate if you accept more Zoom-hosted UI.

**Session model (Video SDK):** Sessions are created on demand; Zoom documents concurrent sessions and scale limits on their site (see Video SDK overview).

---

## 3. Database support (implemented in repo migration)

Migration `20260411200000_zoom_video_provider.sql` adds:

**`video_calls`**

- `video_provider`: `daily` | `zoom_meeting` | `zoom_video_sdk` | `external`
- `zoom_meeting_id`, `zoom_join_url`, `zoom_start_url` (host-only; do not leak to guests via public APIs)
- `zoom_session_name` (Video SDK session identifier as returned by your backend)
- `provider_metadata` (jsonb for extra fields without further migrations)

**`tenant_zoom_settings`**

- Per-tenant `integration_mode`: `none` | `meeting_api` | `video_sdk`
- Non-secret metadata such as `zoom_account_id` and `default_meeting_settings`
- RLS aligned with `tenant_integrations` (tenant admins + platform admin read)

**Apply locally:** run your normal Supabase migration command. **Apply via Supabase MCP:** use `apply_migration` with the same SQL (already done for the linked project when this change was shipped).

---

## 4. Application integration outline (engineering)

### 4.1 OAuth for Zoom (Meeting API / user-level)

1. Create a Zoom Server-to-Server OAuth app or OAuth app in the Zoom Marketplace (follow current Zoom docs for your account type).
2. Implement `GET/POST /api/zoom/oauth` (currently referenced from `integrationService` but **not present** in the repo — a gap).
3. Store refresh tokens **server-side only** (encrypted or Vault); store a boolean or account id in `tenant_zoom_settings` / `tenant_integrations.metadata`.

### 4.2 Creating meetings

- **Meeting API:** `POST` meetings via Zoom REST API from a **server route**; persist `zoom_meeting_id`, `zoom_join_url`, `zoom_start_url` on `video_calls`, set `video_provider = 'zoom_meeting'`.
- **Video SDK:** Your backend creates a **session** (or JWT) per Zoom’s Video SDK auth sample; persist `zoom_session_name` and short-lived join credentials as required; set `video_provider = 'zoom_video_sdk'`.

### 4.3 Join flow and branding

- **Daily (today):** `meetingAdapterService` resolves `/meet/:token` to Daily URLs server-side.
- **Zoom Video SDK:** Add a parallel branch: same token validation, but return **session name + signature/JWT** for your embedded client, and render your **custom UI** using the Video SDK web client.
- **Zoom Meeting only:** Redirect or embed according to Meeting SDK / web client guidance.

### 4.4 Security

- Never return `zoom_start_url` to non-host users.
- Validate `meeting_links` and `video_calls` on every join.
- Rate-limit meeting creation per tenant (reuse quota patterns from `quotaEnforcementService`).

---

## 5. End-user guide (in-app checklist)

Use this as copy for a wizard (Settings → Integrations → Video and meetings):

1. **Choose provider:** Keep **Built-in video (Daily)** or enable **Zoom** (Meeting API or Video SDK — your deployment chooses).
2. **Connect Zoom (admin):** Click **Connect Zoom**, approve OAuth in the Zoom window, return to the dashboard when the success message appears.
3. **Verify:** Open **Meetings**, create a test meeting, confirm the join link or in-app room opens.
4. **Team usage:** Instruct users to join from the **Meetings** page or the calendar event; hosts use **Start as host** only when the product requires it.
5. **Troubleshooting:** If the join fails, check firewall rules per [Zoom network guidance](https://developers.zoom.us/docs/video-sdk/) (linked from Zoom’s firewall / connection articles).

---

## 6. References

- Zoom Video SDK: https://developers.zoom.us/docs/video-sdk/
- Zoom Video SDK Web: https://developers.zoom.us/docs/video-sdk/web/get-started/
- Zoom Video SDK UI Toolkit (web): https://developers.zoom.us/docs/video-sdk/web/ui-toolkit/
- Zoom Meeting SDK: https://developers.zoom.us/docs/meeting-sdk/
- Internal video architecture (Daily): `src/VIDEO_ARCHITECTURE.md`
