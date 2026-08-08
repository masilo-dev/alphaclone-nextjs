# Hermes Agent Integration Plan

## Architecture Map

AlphaClone is a Next.js application deployed as the primary web/API service. The frontend lives under `src/app` and `src/components`, with authenticated workspace modules under the dashboard routes. Backend behavior is implemented with Next route handlers under `src/app/api`, server services under `src/services` and `src/lib`, and Supabase as the primary database/auth/storage layer.

Authentication and tenancy remain AlphaClone-owned. User and workspace access flows through Supabase auth, tenant membership tables, and server-side helpers such as tenant access checks. Hermes must never receive browser-direct authority or become a new source of truth for users, tenants, billing, permissions, or business data.

Bonnie remains the primary AlphaClone AI identity. Existing Bonnie code, MCP routes, tool registries, scheduled jobs, and automation services stay intact. Hermes is introduced only as an internal execution runtime Bonnie and AlphaClone APIs may delegate to for long-running autonomous tasks.

Railway currently hosts the AlphaClone web service using `railway.toml`, `nixpacks.toml`, and the root Docker/build setup. Hermes should be deployed as a separate Railway service on private networking with persistent storage mounted for Hermes state.

## Integration Boundary

The intended flow is:

User -> AlphaClone UI -> AlphaClone authenticated API -> permission/subscription policy -> AlphaClone agent service -> Hermes internal service.

The browser must never call Hermes directly. AlphaClone must attach and enforce:

- `tenant_id`
- `user_id`
- `session_id`
- `task_id`
- plan/usage limits
- deterministic execution policy
- audit/observability records

## Hermes Service Strategy

Use a dedicated internal Hermes service rather than copying Hermes code into random AlphaClone folders. Preferred production strategy:

1. Create a controlled Hermes service/fork or submodule pinned to a specific commit.
2. Build that service with its own Dockerfile and Railway service config.
3. Expose only an internal API over Railway private networking.
4. Keep AlphaClone-specific policy, auth, billing, and tenancy logic in AlphaClone.
5. Pull upstream Hermes updates intentionally after testing, never automatically.

## AlphaClone Adapter Surface

Add AlphaClone-owned APIs in phases:

- `/api/agents`
- `/api/agents/tasks`
- `/api/agents/tasks/[taskId]`
- `/api/agents/sessions`
- `/api/agents/memory`
- `/api/agents/skills`
- `/api/agents/schedules`

These APIs should call a server-only Hermes adapter. The adapter should read `HERMES_INTERNAL_URL` and `HERMES_INTERNAL_API_KEY` from server env only.

## Execution Policy

Hermes actions must map to AlphaClone policy categories:

- `READ`: safe reads within tenant/user permission.
- `CREATE`: reversible drafts, notes, reports, internal tasks.
- `EXTERNAL_ACTION`: email, social publishing, outreach, customer contact. Requires existing AlphaClone approval rules.
- `SENSITIVE`: finance, billing, deletion, permissions, credentials, security configuration. Requires explicit authorization.

LLM output must never bypass deterministic backend authorization.

## Multi-Tenant Isolation

Every Hermes task, session, memory item, file reference, skill grant, and execution log must be tenant-scoped. Server-side checks must prevent Tenant A from reading or mutating Tenant B data even if task IDs or session IDs are guessed.

Minimum tests:

- cross-tenant task read denied
- cross-tenant memory read denied
- cross-tenant file read denied
- cross-tenant cancellation denied
- tenant-scoped list endpoints return only owned records

## Persistence and Recovery

Hermes must persist state on a Railway volume or external storage documented by the pinned Hermes version. AlphaClone should also store its own execution ledger so tasks do not disappear if Hermes restarts.

Task statuses:

- `queued`
- `running`
- `waiting_for_approval`
- `completed`
- `failed`
- `cancelled`

External side effects need idempotency keys so retries cannot resend emails, republish posts, or duplicate finance actions.

## Cost Controls

Before broad rollout, enforce:

- max execution time
- max iterations
- max model calls
- token budget
- max concurrent agents per tenant/user
- max subagents
- plan-level enablement
- tenant/user kill switches
- provider/model allowlist

## Kill Switches

AlphaClone must be able to disable:

- Hermes globally
- Hermes for a tenant
- Hermes for a user
- autonomous execution
- specific capabilities
- specific model providers
- running tasks

Hermes unavailability must degrade only agent execution, not the whole AlphaClone app.

## Railway Target

Create a separate Railway service:

- private internal URL only where possible
- health endpoint
- restart policy
- persistent volume for Hermes state
- server-only API key between AlphaClone and Hermes
- no public admin surface

Environment variables to document:

- `HERMES_INTERNAL_URL`
- `HERMES_INTERNAL_API_KEY`
- `HERMES_STORAGE_DIR`
- `HERMES_PROVIDER_ALLOWLIST`
- `HERMES_MAX_CONCURRENT_TASKS`
- `HERMES_MAX_TASK_SECONDS`
- `HERMES_GLOBAL_DISABLED`

## Implementation Phases

1. Architecture audit and integration plan.
2. Isolated local Hermes service.
3. AlphaClone server-only Hermes adapter.
4. Auth, tenant isolation, and policy gates.
5. Basic task execution.
6. Persistent sessions and memory.
7. Approvals and sensitive action controls.
8. AlphaClone Agents UI.
9. Observability and cost controls.
10. Railway service deployment.
11. Security and adversarial testing.
12. Limited internal beta.

## First Proof Of Concept

The first acceptable POC is:

1. User opens AlphaClone Agents.
2. User submits a multi-step task.
3. AlphaClone authenticates, authorizes, and creates a tenant-scoped task ID.
4. Hermes executes through the internal adapter.
5. AlphaClone records progress and logs.
6. User leaves and returns.
7. Task result is retrieved from AlphaClone.
8. Hermes service restarts.
9. Persistent state survives where required.
10. Another tenant cannot access the task.

Do not call Hermes production-ready until this flow passes with isolation, persistence, retries, and approvals tested.
