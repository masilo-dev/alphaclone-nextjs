# Production status monitoring

Public pages: `/platform-status`, `/platform-status/history`.
Public data: `/api/platform-status` (fixed service names, generic messages, bounded reads, no secrets or tenant records).
Admin: `/admin/platform-monitoring`, `/api/admin/platform-monitoring` (existing platform super-admin authorization).
Runner: `/api/cron/platform-monitoring` (existing CRON_SECRET authorization).

Supabase schedules `platform-health-monitor` every minute. An atomic minute claim prevents duplicate runs across Railway replicas. Results, daily aggregates and incidents are persisted in Postgres. External pg_net probes run from the database and record website/API failures independently of the app process. Responses are evaluated on the next scheduler tick. Three-minute-old evidence becomes unverified. Detailed samples are kept seven days; daily aggregates ninety days; incidents are retained.

Green requires fresh verified probe results. Missing credentials, absent heartbeat, and incomplete synthetic workflow coverage are unverified, not green. Public messages never contain provider responses, tokens, emails, tenant IDs, SQL errors or database connection details. Monitoring tables and RPCs reject anonymous and authenticated users; server service-role access is required. RLS has no public policies intentionally.

## Probe scope and setup

Existing runtime settings are used for Supabase, Stripe, Brevo and the scheduler. Required: Supabase service-role credential, app origin, and CRON_SECRET matching `platform_global_settings.settings.cron_secret`. The migration never embeds secrets.

Dedicated read-only monitoring credentials can enable provider probes:
- MONITOR_MCP_TOKEN: a valid scoped MCP bearer token; verifies unauthenticated rejection and authenticated tools/list.
- MONITOR_ZOHO_TOKEN, MONITOR_ZOHO_REGION (eu or default com).
- MONITOR_OUTLOOK_TOKEN, MONITOR_LINKEDIN_TOKEN, MONITOR_FACEBOOK_TOKEN, MONITOR_INSTAGRAM_TOKEN.
- MONITOR_AUTH_EMAIL and MONITOR_AUTH_PASSWORD: a non-customer synthetic Supabase user. Login and refresh are exercised and the session is signed out.

OAuth callback coverage additionally requires a fresh verified `oauth_synthetic` receipt in the private current-evidence table from a trusted external synthetic runner. That runner is not installed by this change. The authentication service remains unverified without it. Expiring provider monitoring tokens need renewal; expired tokens produce actual probe failures. No customer account or tenant is implicitly chosen for monitoring.

Stripe verifies its API, invalid webhook signature rejection, and a processed signed webhook received within 24 hours. No fresh real receipt means unverified, not evidence of an outage. The monitor does not create payments or fabricate signed Stripe events.

CRM, projects, contracts, billing, dashboard and client portal have data/route/dependency probes. They remain unverified pending dedicated end-to-end workflow synthetic coverage; successful table reads or redirects do not prove business execution works. Worker checks require existing successful cron log heartbeats; absent logs are unverified and expired/failed logs are degradation. Provider API checks do not assert inbox delivery, settlement or social publication.

Observed uptime is the passing fraction of verified samples, with verified/total sample counts shown. It is not a time-weighted availability SLA. Monitoring gaps are unverified and are not counted as passing samples. Incidents open on verified failures and resolve only on a verified passing sample; loss of telemetry never resolves an incident.

## Validation

Run `npm run build`, `npm run test`, and the focused platform-monitoring unit tests. Verify anonymously that the page and status API work, the admin API rejects access, and the cron endpoint rejects a missing bearer. Confirm a minute-spaced increase in `platform_health_checks`, external probe evidence, the database read/write probe, and the two cron jobs. Monitor storage permissions must remain private.

Known acceptance gaps: dedicated synthetic account/provider credentials and external OAuth/business workflow runner; calendar-time uptime/coverage; complete queue age/backlog and scheduler registry checks. Do not claim full end-to-end production acceptance until these are supplied and exercised.
