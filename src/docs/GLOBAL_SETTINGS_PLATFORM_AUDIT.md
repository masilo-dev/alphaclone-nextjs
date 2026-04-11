# Global settings, mobile UX, and platform gap audit

Date reference: 2026. Scope: super-admin Global Settings, tenant Settings, and cross-cutting gaps.

## 1. Global Settings (`/dashboard/admin/settings`, `GlobalSettingsTab.tsx`)

### What was wrong

| Issue | Severity | Notes |
|-------|----------|--------|
| Save showed success but did not persist anything | High | Misleading; now surfaces an explicit toast that no API exists. |
| Static integration statuses (Stripe, Postmark, Slack, Intercom) | High | Not read from environment or database. |
| Security toggles (2FA enforcement, registration) only in component state | High | Lost on refresh; not industry-standard admin behavior. |
| AI keys shown as masked read-only fields | Medium | Placeholder only; real keys must never appear in client bundles. |
| No disclosure that the screen was a mock | High | Violates honest UX for production admins. |

### Mobile-specific issues (phone)

| Issue | Notes |
|-------|--------|
| Header row crowded title + primary action | Fixed: stacked layout and full-width save on narrow viewports. |
| Vertical section nav consumed height | Fixed: horizontal scroll for section pills on small screens; vertical on `lg+`. |
| Security rows used tight horizontal flex | Fixed: column stack on small screens so toggles stay tappable (44px+ target). |
| Long monospace detail strings | Fixed: `break-words` on integration detail lines. |

### Versus industry standard (e.g. Stripe Dashboard, Vercel, Supabase)

Typical expectations:

- Persisted settings with optimistic UI or clear save-per-section.
- Audit log or at least last-updated metadata.
- Feature flags / maintenance mode backed by API and RBAC.
- Integration health from real API checks, not static labels.
- Secrets only on server; admin UI shows “configured yes/no”, not key material.

**Conclusion:** Global Settings was a **UI shell**, not an industry-standard admin surface. The in-app banner and save behavior now state that explicitly. Full parity requires API routes, a `global_settings` or feature-flag store, and service-role reads for integration status.

---

## 2. Tenant Settings (`SettingsPage.tsx`, `/dashboard/settings`)

### What works better

- Profile and notifications persist via `userService`.
- Password change and account deletion flows are real.
- **Mobile drill-down:** On viewports under `lg`, users see the section list first; opening a section shows content with a **Back to Settings** control. This matches common responsive settings patterns.

### Gaps

| Area | Gap |
|------|-----|
| Appearance | `handleSaveAppearance` only shows a toast; likely not persisted (verify `user_preferences` / theme). |
| Footer “System Status / Core Latency” | Static marketing-style copy, not live status. |
| Version string “Enterprise Intelligence v2.4.0” | Hardcoded; drifts from release. |

---

## 3. Cross-platform gaps (high level)

These recur outside Global Settings:

- **Zoom OAuth route** referenced from integrations catalog but not implemented (`/api/zoom/oauth`).
- **Claude / Manus MCP** marketplace entries are roadmap; DB has `mcp_*` tables for future OAuth.
- **Integration Preferences** tab: already labeled placeholders in `IntegrationSettings`.
- **E2E coverage:** confirm critical paths (auth, billing, booking) in CI; not fully verified in this audit.
- **i18n / locales:** English-first; no systematic multi-language settings.
- **Accessibility:** mixed; Global toggles improved with `role="switch"` and labels; full WCAG pass not claimed.

---

## 4. Recommended next engineering steps

1. Add `GET/PATCH /api/admin/global-settings` (super-admin only) and a single JSON or normalized table for flags (2FA enforcement, registration, maintenance).
2. Replace static integration cards with checks against env + optional `tenant_integrations` / provider tables.
3. Remove or replace fake latency/status blocks with real health endpoint or remove them.
4. Align Appearance save with stored user or tenant theme preferences.

---

## 5. Files touched in the UX honesty + mobile pass

- `src/components/dashboard/admin/GlobalSettingsTab.tsx` — banner, responsive header, scrollable section nav, security row layout, toggle a11y, integration row wrapping, disabled Configure, honest save toast.
