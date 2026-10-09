# Portal theme, logout, language and conversation follow-up

Prepared 2026-10-09. Prior portal PR #196 deployed successfully as master eda95248bae3571a548dbe14c2f1b96ebd6e54b3. This follow-up is prepared for deployment; update the release status after Railway completes.

- Sidebar and mobile drawer now use the panel background matching their text tokens. Portal routes respect the saved theme at initial paint and in ThemeContext; a visible accessible theme toggle is available on desktop and mobile.
- Logout remains visible on mobile. Session revocation no longer writes the nonexistent client_portal_sessions.updated_at column. Database failures remain explicit and are not reported as successful sign-out.
- English, Polish and Spanish portal controls, navigation, statuses and recovery text use the language context. Financial/date formatting follows the selected language; customer content remains unchanged.
- Persisted project messages notify the recorded creator (owner/tenant owner fallback when absent). Staff project replies notify the scoped active client. Provider acceptance is distinguished from inbox delivery. Notification failure does not discard a saved conversation. Stable request UUIDs prevent duplicate persistence on uncertain retries, and the duplicate UI-side project email was removed.

Validation: 46 targeted portal, API, session and security tests passed; typecheck passed; scoped lint has zero errors (three existing warnings); git diff --check passed. All email tests use mocked providers and synthetic addresses. No real messages or payments were sent, and no signed agreements or production records were edited.

Live authenticated verification and screenshots remain blocked by the previously declined secure sign-in and subsequent automatic approval rejection. The synthetic browser fixture requires Chromium, whose download was denied by the environment allowlist. Neither visual browser verification nor actual inbox delivery is claimed. With an approved secure session and Chromium available, run scripts/client-portal-fixture-qa.mjs, then inspect desktop/mobile light and dark modes, keyboard navigation, language switching and logout. Test both message directions using dedicated test accounts and verify provider logs and actual test inbox receipt. Replies are sent through the portal conversation; inbound email replies are not implemented by this change.

Prior data blockers remain: locate and restore authentic signed files and references with retained signature evidence; reconcile E2E-LIVE-1787911897 and configure genuine payment instructions only if an actual balance is owed; verify/link/share the client's real projects. See audit.md for exact record IDs and resolution steps. These are not solved by UI changes.
