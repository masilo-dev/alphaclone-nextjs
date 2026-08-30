# AlphaClone MCP ChatGPT Audit Report

Generated: 2026-08-30T19:46:51.128Z

## Counts (dynamic)

| Metric | Count |
| --- | ---: |
| Internal registered tools | 524 |
| MCP discoverable tools | 524 |
| ChatGPT exposed (full catalog) | 524 |
| Stable core slice | 53 |
| Progressive default slice | 55 |
| Read tools | 195 |
| Write tools | 329 |
| Admin tools | 8 |
| Catalog-only (non-executable) | 0 |

## Why counts differ

- Internal registry registers 524 executable handlers.
- Unified tools/list full catalog merges registry + manifest aliases → 524 discoverable tools.
- ChatGPT connector (catalogMode=full) exposes 524 tools directly.
- Stable core slice exposes 53 tools (used by list_tools / bounded clients).
- Progressive default slice exposes 55 tools until load_module_tools expands modules.
- Legacy curated allowlist retained for annotations only: 144 names.
- Historical ~79 tool snapshots usually come from progressive/stable slices or paginated tools/list pages (default 75/page for non-full catalogs), not server-side hiding in full mode.

## Priority business tools

| Tool | ChatGPT exposed | Internal working | Status |
| --- | --- | --- | --- |
| send_email | true | true | ok |
| reply_to_email | true | true | ok |
| read_emails | true | true | ok |
| create_email_draft | true | true | ok |
| publish_social_post | true | true | ok |
| create_task | true | true | ok |
| create_event | false | false | missing |
| create_invoice | true | true | ok |
| add_note | true | true | ok |
| run_workflow | true | true | ok |
| create_lead | true | true | ok |
| update_lead | true | true | ok |
