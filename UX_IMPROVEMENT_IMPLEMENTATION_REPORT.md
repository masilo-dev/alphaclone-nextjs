# AlphaClone First-Use UX Improvement Report

**Scope.** This implementation improves the first-time path for a non-technical small-business owner, using a restaurant in Poland as the representative scenario. It preserves existing tenant boundaries, role checks, social-publishing safeguards, campaign recipient consent gates, and server-side delivery logic. The changes are designed to reduce decision fatigue and make the next action explicit rather than to remove capability or authorize new actions.

## Executive summary

The previous initial experience had three competing entry layers: a persona-based onboarding picker, a generic business welcome modal, and a separate new-workspace checklist. It also exposed an oversized 16-step campaign explanation alongside a different campaign builder. The revised journey has a single short sequence: a welcome, an outcome-led choice, and a direct hand-off to an existing workspace. A restaurant owner can now select **Get more customers**, **Post to social media**, **Send emails and promotions**, **Manage customers and enquiries**, **Create quotes and invoices**, **Manage projects and tasks**, or **Run my business in one workspace**.

The campaign route now has one four-step orientation that mirrors the real builder. Sending requires a meaningful sender name, a reply-to business email, a recipient group, a subject, content, and a valid schedule where relevant. The UI acknowledges campaign work immediately, prevents duplicate submission, reports direct-provider counts as **completed** or **partial**, and labels Listmonk acceptance as **queued** instead of claiming it has sent.

## Implemented improvements

| Area | Problem found | Change delivered | User benefit |
|---|---|---|---|
| First-use onboarding | Persona labels did not answer what a small business owner wants to do first. | Replaced the persona choice with seven business-outcome cards, each with a plain-language explanation, next step, and existing destination route. | A restaurant owner can choose a practical goal without knowing product taxonomy. |
| Welcome and setup duplication | The welcome modal and home checklist repeated setup guidance. | Reduced the welcome to one decision and suppresses the generic setup checklist after the durable outcome choice. | One clear first action instead of stacked modals and checklists. |
| Onboarding state | Client cache could imply success after an update failed. | Saves through the profile endpoint and authentication metadata before updating local cache or navigating. A failure stays visible inline and gives a retry path. | No silent fallback or false completion state. |
| Campaign path | A local 16-step guide conflicted with a four-step builder. | Replaced it with a concise, non-interactive four-step orientation that matches the builder. | The user sees one coherent process. |
| Campaign sender identity | The sender address could be missing and was only treated as a warning. | Added editable sender name and reply-to email fields; a missing value is a launch-blocking issue. | A clearer, safer email identity before delivery. |
| Campaign feedback | Submission could look unresponsive and success language was overly broad. | Added visible live-status messaging, one-click submission locking, saved-draft recovery, and truthful completed/partial/queued wording. | Immediate feedback and an understandable recovery path. |
| Public product guide | The guide used non-interactive cards and included unverified setup-duration, trial, and provider claims. | Rebuilt it as a concise action map with focus-visible deep links and only workflow claims supported by the implemented path. | A public guide that helps rather than becomes a second product manual. |
| Navigation clarity | Several sidebar group names were internal or abstract; mobile navigation could push twice. | Renamed selected labels in plain language, added Spanish and Polish translations, and delegated mobile navigation to the parent exactly once. | Less jargon and fewer perceived mobile lag/duplicate-transition issues. |

## Representative journey: restaurant owner in Poland

1. The owner creates an account and confirms their email when prompted.
2. They see the short welcome and select **Get more customers**. AlphaClone records the starting choice and opens the existing lead campaign workspace directly.
3. They describe the local customers they want to reach, save useful results, and can then select **Send emails and promotions** from the normal navigation.
4. In the campaign builder they enter a campaign label, subject line, sender name, and reply-to business email. They choose contacts who are eligible for marketing, create a message, review it, and send a test or schedule delivery.
5. The application displays actual work states while the campaign is created and recipients are added. Direct delivery shows confirmed counts or a partial result; provider acceptance that is not final delivery stays labelled **queued**.
6. At any point the owner can return to the Dashboard, customers, finance, projects, or social workspace without completing a hidden setup wizard or losing permissions.

## Validation performed

| Check | Result | Notes |
|---|---|---|
| TypeScript | Passed | `npm run typecheck` completed with exit code 0. |
| Production build | Passed | `npm run build` completed with exit code 0. |
| Design-system guard | Passed | `npm run guard:design-system` completed with exit code 0. |
| Focused onboarding, localization, social-isolation and auth tests | Passed | 64 tests passed in the targeted safety suite. |
| First-use and language regression suite | Passed | 18 tests passed, including new UX, sender, delivery-language, mobile-navigation, Spanish, and Polish contracts. |
| Lint | Passed with existing warnings | `npm run lint` returned exit code 0; it reports 60 repository-wide warnings and no errors. |
| Public-guide smoke check | Passed | The production guide loaded at the sandbox URL; all first-win and platform-map cards appeared as accessible links. |

The complete `npm test` suite was also run. It was blocked by one unrelated pre-existing source-contract failure: `tests/unit/media-ingestion-instagram-e2e.test.mjs` expects `waitForInstagramContainerReady` in `src/lib/social/providerAssetPublishers.ts`, but the current implementation uses durable reconciliation instead. This UX change does not modify that module. The only failure introduced by the navigation wording was repaired by adding complete Spanish and Polish translations, and its dedicated language test now passes.

## Intentional non-changes and follow-up opportunities

The workspace-creation sector selector was not wired to a durable tenant property in the existing service contract; the core onboarding path does not surface it, so this implementation does not pretend it is saved. A subsequent scoped backend change could add an optional, tenant-owned `industry` setting and save it through the bootstrap/update API.

Direct provider delivery is still synchronous in the existing server design. The UI now makes that waiting state explicit and accurately describes outcomes. For larger campaigns, the recommended next reliability improvement is a durable background delivery job with persisted per-recipient progress and a delivery-status endpoint; it should retain the current consent, suppression, idempotency, and tenant filters.

## Files of interest

The most relevant implementation areas are `src/components/onboarding/OnboardingFlow.tsx`, `src/components/dashboard/business/BusinessWelcomeModal.tsx`, `src/components/dashboard/business/CampaignBuilder.tsx`, `src/components/dashboard/marketing/EmailCampaignsPage.tsx`, `src/components/pages/PlatformGuide.tsx`, and the matching delivery client/server route files. Regression coverage is in `tests/unit/first-time-ux-contract.test.mjs`.

## Reference

The implementation is based on the selected AlphaClone source repository and its existing routes, service contracts, tests, and design guard. [1]

[1]: https://github.com/masilo-dev/alphaclone-nextjs
