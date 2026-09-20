# Integration Directory Audit — 2026-09-20

## What Whelp does well

Whelp’s integrations page is fast to scan. It uses recognizable logos, a short category label, a compact category filter, and a uniform grid. This reduces the effort required to understand the available ecosystem at a glance. It also keeps the conversion path visible with signup and pricing actions.

## What Whelp leaves unclear

The cards are intentionally minimal, but they do not explain what a connection enables, which data is accessed, whether data flows in one or both directions, how authentication works, which roles or permissions are required, or how the user disconnects the service. A directory listing can therefore be mistaken for a live, fully capable integration.

That sparse model is not sufficient for AlphaClone because AlphaClone’s promise includes approvals, permissions, execution, verification, and durable business records. Users need to understand the boundary between AlphaClone and the connected system before authorization.

## Patterns reviewed

Intercom is strong at presenting a curated ecosystem overview before handing users to a searchable App Store. It also uses concrete job-to-be-done descriptions, product categories, setup requirements, and shared-data documentation.

HubSpot is strong at progressive marketplace discovery, structured connector detail pages, compatibility requirements, shared-data tables, installation governance, and distinct certification or partner signals.

Zapier is strong at operation-level specificity. Its app pages describe triggers, actions, required inputs, connection status, reconnection, ownership, and workflow dependencies.

## What AlphaClone should adapt

AlphaClone should combine Whelp’s fast scanning with deeper operational transparency:

1. Add search and category filtering so users can browse by system and capability.
2. Use one standardized card format: connector identity, category, bounded capability description, status, and a clear next step.
3. Add intent-oriented discovery alongside tool browsing: CRM, email, social, projects, contracts, invoices, permissions, approvals, execution, verification, and records.
4. Create connector detail views showing what the connector can read, draft, propose, create or update, execute, verify, and record. Only show capabilities that are verified for that connector.
5. Show authentication method, required role, requested access, system-of-record boundary, direction of data flow, approval behavior, limitations, and disconnect/revocation behavior before authorization.
6. Use status-aware actions: Ready to connect, Request access, Beta, Custom/API, Talk to us, or Coming soon. Do not use one generic Connect button for every state.
7. Add a governed connection control center later with owner, connection health, last check, dependent workflows, scopes, reconnect, replace, and disconnect controls.

## Implemented in this pass

The AlphaClone ecosystem page now has an intent-aware introduction, keyword search, category filtering, result counts, explicit status legend, clearer connector cards, capability explanations by category, and empty search feedback. Cards link users to the connection model rather than pretending that every card is an immediate activation flow.

## Sources reviewed

- [Whelp Integrations](https://whelp.co/integrations)
- [Whelp Privacy Policy](https://whelp.co/privacy-policy)
- [Intercom Integrations](https://www.intercom.com/integrations)
- [HubSpot App Marketplace](https://ecosystem.hubspot.com/marketplace/apps)
- [Zapier Apps](https://zapier.com/apps)

Vendor counts, customer metrics, partner badges, and certification claims should be treated as vendor-published claims and should not be reused by AlphaClone without independent substantiation.
