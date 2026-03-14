# Repo Health Audit (2026-03-14)

This audit captures the highest-impact issues currently visible from local checks.

## What is wrong today

1. **Lint quality gate is failing with 23 errors and 134 warnings.**
   - `npm run lint -- --max-warnings=0` exits non-zero.
   - A large fraction of previous noise came from generated service worker assets.
2. **Production builds are brittle in restricted/offline environments.**
   - `npm run build` fails because `next/font/google` must fetch multiple fonts from Google at build time.
3. **Codebase contains framework deprecation drift.**
   - Next.js warns that `middleware` convention is deprecated in favor of `proxy`.
4. **A lot of generated diagnostic artifacts are committed in the repo root.**
   - Build/lint error logs and reports significantly increase repository noise and make review harder.

## Improvements made in this change

1. **Migrated ignore patterns from deprecated `.eslintignore` to flat config `globalIgnores`.**
   - Added generated service worker and local log files to ESLint ignores in `eslint.config.mjs`.
2. **Removed legacy `.eslintignore`.**
   - This removes the ESLint v9 warning and centralizes lint behavior in one file.

## Recommended next improvements (prioritized)

1. **Fix the 23 blocking lint errors and enforce CI lint gate.**
   - Why: prevents runtime bugs (hook immutability/order errors) and keeps quality from regressing.
2. **Self-host fonts or switch to local font fallback strategy.**
   - Why: avoids build failures when Google Fonts is unreachable in CI/private networks.
3. **Migrate `middleware` to `proxy` convention.**
   - Why: remove deprecation risk before framework updates turn warnings into breakage.
4. **Purge historical generated logs from git tracking and add guardrails.**
   - Why: smaller diffs, faster reviews, and lower risk of leaking sensitive debug data.
