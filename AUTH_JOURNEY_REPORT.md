# Authentication journey report

Implemented routes include login, OAuth callback, server-side token-hash confirmation, reset-password, auth-code error, and welcome gate. The callback exchanges authorization codes server-side and uses the canonical public origin.

Verified:

- Production Auth logs refer to `https://alphaclonesystems.com`.
- OAuth callback uses `exchangeCodeForSession`.
- Password recovery uses `resetPasswordForEmail`.
- `/auth/confirm` verifies OTP token hashes server-side and routes recovery, signup, invitation, magic-link, and email-change events without exposing tokens to client JavaScript.
- Membership checks fail closed and no longer probe the missing `tenant_users.status`.

Remaining runtime tests:

- Confirmation, resend, expired/scanner-consumed confirmation.
- Password reset success, reuse, expiry, password-changed notification.
- Invitation and MFA journeys.
