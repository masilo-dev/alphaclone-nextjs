# Stripe production migration report — 2026-10-06

Overall: FAIL — production readiness is incomplete. PR #173 remains draft. Do not merge, apply the Railway staged variables, or deploy this revision until the gates below pass.

## Implemented

- One authorized platform Starter checkout command shared by HTTP and MCP. Configured live price must be USD 15/month, exclusive tax. No inline-price fallback. Platform customer/subscription ownership is checked; credentials must resolve to the expected platform account.
- Native invoice payment creation requires a current connected account and outstanding payable balance. Both Checkout and Elements use direct charges; Elements receives the connected-account context. No application fee or destination transfer is added.
- Reconciliation verifies tenant, invoice, connected account, currency and successful provider payment before the existing atomic invoice-payment RPC. Browser, webhook and automation paths share the payment-intent deduplication key.
- Raw-body webhook verification precedes database access. Separate platform and Connect signing secrets are supported. Connected events require an account mapped to the tenant. Stored event payloads redact common secret fields, and active concurrent processing is retried rather than acknowledged.
- Connect onboarding/status uses the current SDK v2 account APIs, full Dashboard accounts, live capability checks, explicit legacy-account reconnection and an audit entry. Dashboard settings reuse the shared UI.
- Stripe SDK pinned to 23.0.0; API version 2026-09-30.endive. Old hardcoded platform price IDs removed. Add-on checkout fails closed until configured. A tenant recurring-subscription ownership contract is added, but the complete tenant subscription product is not implemented.

## Verified provider and database state

Live platform: acct_1UNWZEEXRUDDQt0p (Alphaclone systems, llc).
Created product: prod_VOJplHSfPFER8v.
Created price: price_1UNXBqEXRUDDQt0pvKzRS7iP; USD 1500/month; exclusive tax; lookup key alphaclone_starter_monthly.
Created platform webhook: we_1UNXS8EXRUDDQt0p5jlz3wtz.
Created Connect webhook: we_1UNXSMEXRUDDQt0pRJjmLz1u.
Both point to https://alphaclonesystems.com/api/stripe/webhook. Delivery with the new production configuration is unverified.

Stripe Tax settings are active, but there are zero registrations. Tax registrations and the appropriate product tax classification require a business decision; they were not invented. Checkout fails closed while registrations are absent.

Supabase read-only audit found 64 tenants and zero platform customer, subscription or connected-account mappings. Existing invoice, payment, webhook-event and atomic payment RPC structures are reused. No database migrations or mutations were applied.

## Railway

Project c75eaf5f-1ec8-4565-b3b6-8e318f1251bd; production environment 78325a44-cd94-4b10-aa41-c09ebd978c7f; service a98fc4dc-4047-4647-a74a-985f6ff667ce.
Staged patch 488e19a2-c0c3-4802-9ddf-8a06481501c2 contains STRIPE_PLATFORM_ACCOUNT_ID, STRIPE_STARTER_MONTHLY_PRICE_ID, STRIPE_WEBHOOK_SECRET and STRIPE_CONNECT_WEBHOOK_SECRET. Staging is not activation. No secret values are committed in this report.

MANUAL SECRET REQUIRED: install the rotated live API key and matching publishable key securely. The existing compromised key must not be reused. Account identity and webhook delivery must then be verified before cutover. Obsolete Pro/Enterprise environment variables still require removal during approved cutover.

No merge commit or new deployment exists. Last observed deployment 4ce79bfe-e9da-409f-9497-30039a15bbe7 was SUCCESS at 2026-10-06T11:25:07.080Z, before these changes.

## Validation and release gates

| Gate | Result | Evidence / limitation |
| --- | --- | --- |
| Stripe boundary tests | PASS | 9 local tests; mocked provider, no real charges |
| TypeScript | PASS | Final npm run typecheck exited 0 after all code additions |
| ESLint | PASS | 0 errors, 60 warnings |
| Full test suite | FAIL | 1253 passed, 17 failed; same 17 failures reproduced on original PR HEAD |
| Production build | FAIL | Both webpack attempts terminated by SIGKILL; first attempt confirmed cgroup OOM in an 8 GiB runtime |
| Live price configuration | PASS | Provider-created exclusive USD 15 monthly price |
| Rotated production credentials | FAIL | Required secret unavailable; existing redacted Railway values not validated |
| Tax readiness | FAIL | No registrations; classification and registration decisions outstanding |
| Live Connect onboarding/direct charge | FAIL | Code and mocked checks only; no real-account end-to-end verification |
| Signed live webhook delivery/replay | FAIL | Endpoints created; runtime secrets staged only |
| Tenant recurring customer subscriptions | FAIL | Ownership contract only; complete lifecycle/UI/storage mapping not delivered |
| Lifecycle completeness | FAIL | Out-of-order platform events, connected failed-payment/subscription events, refund/dispute financial reconciliation and disconnect handling need completion |
| Durable notifications | FAIL | Retriable webhook email side effects removed; durable outbox not implemented |
| Unified finance/MCP coverage | FAIL | Core checkout/reconciliation shared; remaining finance registry tools and lifecycle commands need consolidation |
| Full pricing/product audit | FAIL | Starter corrected; future/annual marketing offers still need explicit approval and cleanup |
| Merge and deployment | FAIL | Blocked intentionally by the above gates |

The automated cases cover configured price validation, outstanding balances, ownership/currency rejection, payment-intent deduplication, secret redaction, unsigned/invalid webhook rejection before DB access, missing/cross-tenant account rejection, connected-context reconciliation and tenant recurring ownership scope. They do not substitute for signed event replay or production account testing.

## Changed files

```text
 M package-lock.json
 M package.json
 M src/app/api/stripe/connect/callback/route.ts
 M src/app/api/stripe/connect/login/route.ts
 M src/app/api/stripe/connect/onboarding/route.ts
 M src/app/api/stripe/connect/status/route.ts
 M src/app/api/stripe/create-addon-session/route.ts
 M src/app/api/stripe/create-checkout-session/route.ts
 M src/app/api/stripe/create-checkout/route.ts
 M src/app/api/stripe/create-invoice-session/route.ts
 M src/app/api/stripe/create-payment-intent/route.ts
 M src/app/api/stripe/create-portal-session/route.ts
 M src/app/api/stripe/manage-subscription/route.ts
 M src/app/api/stripe/reconcile-payment/route.ts
 M src/app/api/stripe/webhook/route.ts
 M src/components/dashboard/business/StripeConnectSettings.tsx
 M src/components/dashboard/integrations/StripeConnectOnboarding.tsx
 M src/components/payments/PaymentPage.tsx
 M src/config/pricingPlans.ts
 M src/lib/mcp/tools/gap-tools-finance.ts
 M src/lib/stripe.ts
 M src/services/autonomousRunnerService.ts
 M src/services/mcp/MCPServer.ts
 M src/services/mcp/toolManifest.ts
 M src/services/paymentService.ts
 M src/services/subscriptionService.ts
 M src/services/tenancy/types.ts
?? src/config/platformBilling.ts
?? src/lib/stripeConnectAccount.ts
?? src/lib/stripeInvoiceExecution.ts
?? src/lib/stripePaymentPolicy.ts
?? src/lib/stripePlatformCheckout.ts
?? src/lib/stripePlatformIdentity.ts
?? src/lib/stripeTenantSubscriptionScope.ts
?? tests/unit/stripe-payment-boundaries.test.mjs
```

This report is also new. Original PR work is retained; the branch is based on 4f459f5c61274cf55eba1c678eabba4d72bd85eb. No real charges were created during validation.

## Approved three-plan update — 2026-10-06

User approved monthly Starter USD 15, Pro USD 45 and Enterprise USD 85, before applicable tax.
Live Pro product prod_VOKVRiiutrcIqj / price price_1UNXqyEXRUDDQt0pTR7P4CWa.
Live Enterprise product prod_VOKW9UZ4IMJEzE / price price_1UNXrHEXRUDDQt0p0cD4j0pZ.
Both are active exclusive-tax monthly prices. Their STRIPE_PRO_MONTHLY_PRICE_ID and STRIPE_ENTERPRISE_MONTHLY_PRICE_ID settings are staged in the same Railway production patch, now six changes.
HTTP and MCP checkout now select and validate each approved plan against its configured monthly price. Public Enterprise monthly copy is USD 85. Annual offers remain unapproved/unconfigured; original annual marketing values need removal or separate approval. Prior Starter-only statements above describe the earlier audit snapshot. Remaining release gates still apply.

## Connected invoice payment audit — 2026-10-06

Verified code path: invoice send/reminder uses a stable public invoice token and payment URL; the public page submits token-authorized checkout; checkout and authenticated Elements create direct charges scoped to the mapped tenant account. No application fee, destination transfer, charge capture, refund or payout write exists in tenant payment paths. Full Dashboard account onboarding assigns fee and loss collection to Stripe. AlphaClone reads the successful PaymentIntent in the same connected account and records a native invoice payment through the atomic RPC.

Fixed currency conversion for zero-decimal charges and ISK/UGX whole-unit special cases. Incorrectly precise amounts are rejected rather than rounded. Three-decimal currencies remain blocked pending native invoice precision support. Provider country/currency/payment-method eligibility still applies.
Removed the public page's unverified 'payment received' assertion from the return URL; the page polls native invoice state after returning. Public token persistence errors now block sending a broken payment link.

Validation: 12 Stripe tests pass, including actual signed webhook HTTP requests against fixture provider/DB adapters, Checkout and PaymentIntent notifications for the same receipt, replay and cross-tenant rejection. No external network or real money in the fixture. TypeScript passes after currency/UI changes.

Live read-only account listing returned zero connected accounts. Thus real onboarding, existing standalone Stripe account linking, payment-method eligibility, webhook delivery and payout behavior are NOT verified. Current onboarding creates a full Dashboard connected account; existing-account linking still needs a supported Connect authorization flow and testing.

Additional release gate: invoice checkout and Elements can produce separate charge attempts. The shared receipt key deduplicates the same PaymentIntent; it does not prevent two distinct successful PaymentIntents for one invoice. A persistent per-invoice payment-attempt reservation/cancellation policy and concurrent-charge testing remain required. Refund/dispute ledger updates do not yet reverse native invoice balances. Do not claim universal production readiness.

References: https://docs.stripe.com/connect/direct-charges.md?platform=web&ui=stripe-hosted and https://docs.stripe.com/currencies.
