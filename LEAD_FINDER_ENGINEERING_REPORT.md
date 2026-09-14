# Lead Finder engineering report

Audit date: 2026-09-14. This source-level audit did not query or change production data.

## Root causes addressed

- Discovery previously filtered out contactless businesses before they could be enriched. This loses recoverable candidates and conflates discovery with qualification.
- Manual candidate acceptance could create a CRM lead without deterministic business-entity, contact, or provenance gates.
- Discovery source labels were not centrally screened for directory/search-result phrases before candidate persistence.
- Qualification calculated a score but did not make its hard-gate result explicit, allowing an invalid contact to receive an A grade.

## Validation and qualification architecture

`src/lib/lead-finder/core.ts` is the shared normalization and entity-resolution boundary. It normalizes email/domain/phone values and rejects obvious directory or search labels. `qualificationEngine.ts` remains the single deterministic qualification engine. It now returns hard-gate results, disqualification reasons, and a `qualified` outcome; missing contact evidence, missing source provenance, or an invalid entity force `Reject`.

Candidates are retained for future enrichment when no contact requirement is selected. Configured email/phone requirements are still strict. Candidate review now refuses CRM promotion until the same canonical qualification gates pass.

## Evidence and duplicate architecture

Existing `lead_signals`, canonical business keys, and candidate dedupe constraints are retained. The new additive migration adds `lead_evidence` for append-only, tenant-scoped provenance and adds explicit candidate lifecycle/entity/qualification state. It never turns inference into verified evidence and does not auto-promote historical records.

## Security and tenancy

All changed API queries retain `requireTenantRole` plus a `workspace_id` scope. The new evidence table is protected by the existing tenant membership function and service-role policy. The migration includes only tenant-scoped indexes and foreign keys.

## Tests added/updated

- Contactless candidate remains available for enrichment, but configured contact gates still fail.
- Directory/article-style entity labels are rejected.
- Qualification source now contains deterministic hard gates and the email-required error code.
- Migration contract verifies lifecycle/provenance/immutability artifacts.

## Remaining risks and next phase

The repository already contains parallel historical lead entry points (webhooks, imports, MCP, legacy scraper tables). They need to be migrated one by one through the canonical candidate writer before claiming complete P0 coverage. A production database scan is still required to populate the re-verification report and identify malformed historical emails, duplicate entities, and non-business records. Browser UX, full contact MX verification, outreach worker idempotency, and funnel analytics are subsequent phases; no outreach was sent or enabled by this change.
