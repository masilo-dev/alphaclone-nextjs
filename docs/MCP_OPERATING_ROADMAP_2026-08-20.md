# AlphaClone Systems MCP operating roadmap

Date: 20 August 2026

This implementation translates the supplied operating audit into a backward-compatible rollout. “Alpha Clean Systems” in the source report is a naming error; the product and company name is **AlphaClone Systems**.

## Compatibility policy

- Existing MCP clients retain the full catalog by default.
- `tools/list` accepts `catalogMode: "stable"` for a bounded canonical core and `catalogMode: "progressive"` for the core plus session-loaded domain packs.
- Legacy aliases remain executable. Discovery marks them as deprecated and identifies their canonical replacement.
- No tool is removed without a separately announced migration window and contract-test evidence.

## Implemented foundation and P0 repairs

- Added canonical lifecycle metadata (`stable`, `legacy_alias`, `experimental`), module ownership, and replacement mappings to discovery results.
- Corrected the `list_tools` contract so it returns the bounded stable core instead of claiming to do so while returning the full catalog.
- Removed hard-coded catalog counts from live discovery capabilities.
- Centralized tenant write readiness for social publishing, media upload, and email sending; verification failures now fail closed.
- Aligned `create_client` runtime behavior with its published schema: name is required and email is optional.
- Guaranteed valid JSON serialization for business snapshot, document register, and email campaign statistics responses, including empty and bigint-bearing results.
- Preserved the social media guards, provider-specific Facebook verification, reviewed batch-outreach queue, tenant scope, permissions, and action approval controls already present on `master`.

## Governed workflow missions

The canonical mission targets remain Lead-to-Meeting, Meeting-to-Deal, Quote-to-Cash, Contract-to-Project, Project-to-Delivery, and Content-to-Publish. They are composed from the existing workflow runtime and approval controls; new mission-specific aliases should not be added until their entry conditions and completion receipts have contract tests.

## Release gates

Every MCP catalog change must pass:

1. TypeScript and unit tests.
2. Full-catalog parity for existing clients.
3. Stable-core size and canonical-name checks.
4. Registry/execution exposure audit.
5. Schema/runtime compatibility checks.
6. Social catalog and production guard validation.

Operational provider tests still require a configured non-production tenant. No email, social post, payment, contract, or external communication should be sent by static/unit validation.
