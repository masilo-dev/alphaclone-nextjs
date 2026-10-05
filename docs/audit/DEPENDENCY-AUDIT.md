# Dependency Audit

**Command:** `npm audit` (2026-10-05, workspace root)  
**Totals:** 66 vulnerabilities — **1 critical**, 47 high, 15 moderate, 3 low (dev dependencies included in full audit).

## Critical

| Package | Advisory theme | Deployment note |
|---------|----------------|-----------------|
| `next` | Unauthenticated RCE on **Windows-hosted** servers | Production: Railway **Linux** Node 22 — **likely REJECTED** as exploitable on current host but **CONFIRMED** outdated advisory surface |

**Pinned version:** `next@16.2.12` (`package.json`). Audit suggests upgrade path to 16.3.8 — **compatibility impact not assessed** (report-only).

## High-volume highs

Majority in transitive deps (41 high in production subtree per audit summary). Triage required:

1. Map advisories to runtime reachability (server vs client bundle).
2. Prefer targeted overrides/resolutions over blind major upgrades.

## Supply chain

- Private package lockfile assumed (`package-lock.json`).
- `postinstall`: `scripts/postinstall.mjs` — review in remediation for script integrity.

## Abandoned / privileged packages

- **NEEDS VALIDATION:** manual review of `dependencies` vs `devDependencies` for unused native modules.

## Recommendations

1. Run `npm audit fix` only after CI pass on selective bumps.
2. Enable Dependabot/Renovate with allowlist for Next.js coordinated upgrades.
3. Document accepted risks for Linux-only Next CVE with expiry date.

## Finding

- **DEP-NEXT-001** (P1, NEEDS VALIDATION): Critical Next advisory vs deployed 16.2.12 on Linux.  
