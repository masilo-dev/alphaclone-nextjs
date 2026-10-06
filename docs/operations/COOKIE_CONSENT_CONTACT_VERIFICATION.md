# Website cookie consent and contact verification

Audit date: 2026-10-06. Code baseline: master f5bec8fbf42c82ebc8cbb06cf477b429a69c363f.

## Reference and gaps

Reference: https://www.cookieconsent.com/ (TermsFeed). Its free implementation describes category-gated scripts, a reopenable preferences center, and Google Consent Mode v2. It explicitly does not store consent logs; AlphaClone keeps its own first-party audit endpoint. Retain the existing AlphaClone UI and Zaraz, rather than adding a competing consent banner. This is an implementation audit, not a legal certification or a complete cookie scan.

| Gap observed | Code change / remaining configuration |
| --- | --- |
| Duplicate head/runtime bridges trusted stale, expired or old-version grants | Shared validated bridge; version 2026-10-v2; 365-day expiry; denied startup; cookie fallback |
| Guessed purpose aliases and no acknowledgement | Actual purpose IDs or exact category names, unknown purposes denied, getAll readback, release queued events after a verified grant |
| Restored consent/revocation missed loaded tags | Google updates and GA disable flag; Meta grant/revoke; latest state on Zaraz readiness and cross-tab updates |
| Functional preselected; preferences unavailable in workspace routes | Optional defaults denied; dialog remains reopenable on dashboard/meeting routes |
| Audit API falsely acknowledged failed storage and used wrong table | cookie_consent_records, real DB receipt, queued retries and UUID replay protection |
| Contact retries could duplicate inquiries | Client attempt UUID, in-flight guard, database replay matching, existing notification idempotency key |
| Owner routing silently fell back to a zero UUID | Explicit production tenant configuration; no inquiry loss when notification delivery fails |
| Cookie descriptions claimed anonymous advertising and undocumented cookie names | Updated descriptions and real consent-cookie name; translations aligned |

## Live Cloudflare findings and prepared changes

Zone: alphaclonesystems.com, active. Consent enabled; purpose IDs are functional, analytics and marketing. Current workflow is realtime. Live tools have category strings in permissions but no defaultPurpose; permissions does not bind a tool to a consent purpose.

Apply these changes preserving every unrelated trigger, action, tool setting and variable:

- Meta Pixel tool-ac-fb-pixel: defaultPurpose marketing.
- Rollbar tool-ac-rollbar: defaultPurpose functional.
- GA4 tool-ac-ga4: defaultPurpose analytics and enabled false. Its measurement ID is currently the placeholder G-XXXXXXXXXX; obtain a real property ID before enabling.
- Turnstile tool-ac-turnstile: enabled false. The app already loads Turnstile independently for form security; remove the duplicate optional Zaraz loader.
- Remove the functional/analytics/marketing strings from these tools' permissions arrays; they are not Managed Component privileges.
- consent.hideModal true: AlphaClone owns the preferences UI.
- consent.cookieName ac-zaraz-consent-v2: invalidate old Zaraz grants when introducing validated policy consent.

No Cloudflare mutations were completed. Automatic approval review rejected switching workflow to preview as a potentially disruptive production workflow change. Do not apply the configuration or claim live tag gating until approval and readback verification. No secrets or full Cloudflare configuration are included here.

## Database and contact checks

Read-only Supabase checks confirmed cookie_consent_records exists with the required boolean, version, UUID and zaraz_synced columns, RLS enabled and service-role-only policy. No migration needed.

The earlier production contact test returned success=true and notificationSent=true. Read-only verification confirmed submission bbc01788-5334-4ebd-be10-047d76fdedf0 was persisted under the owner tenant with status New. Provider acceptance does not prove inbox delivery. The current patch has not yet been deployed or tested through the live browser.

## Validation

- 28 passing targeted unit/regression tests: cookie-consent-enforcement, website-booking-contact-regressions and microsoft-outlook-turnstile-regressions.
- Full TypeScript typecheck passed.
- ESLint passed for all changed TypeScript/TSX files.
- guard-no-raw-hex passed.
- Serialized head script executed in JSDOM and tested for real consent signals, readback, cookie fallback, late readiness and revocation.

## Release checks

After approval, deploy the code and coordinated Zaraz changes, then verify fresh visit, essential only, selective consent, accept all, reload, revoke, cross-tab change and expiry. Inspect actual network requests and cookies: Meta/GA4/optional monitoring must not initialize before the corresponding category grant. Confirm the only banner is AlphaClone's and that Turnstile works after essential-only selection. Test the contact UI once with a clearly labeled internal QA inquiry, retry the same submission ID and confirm one persisted row and notification idempotency. Verify a consent-record response against the stored row. Do not interpret localStorage or a successful API receipt alone as proof of production tracker enforcement.
