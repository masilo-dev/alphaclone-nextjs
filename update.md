# Update Log

## Latest Changes
- Improved Finance Dashboard interactivity (removed exit animation blockers).
- Resolved "white-on-white" input visibility issues by adding `color-scheme: dark` to global CSS.
- Refactored Contact List (`ClientsPage.tsx`) to use in-page modals for Proposal and Invoice creation.
- Integrated `mailto:` links for "Send Email" action in Contact Cards.
- Optimized Client Nexus UI footprint: reduced header sizes and compacted "Quick Actions" (Call/Email) buttons for improved screen real estate.
- Fixed Zoho API 401 Unauthorized errors by implementing recursive token refresh and retry logic in `zohoServerService.ts`.
- Resolved Zoho API 400 Bad Request (`EXTRA_PARAM_FOUND`) errors by removing unsupported `sortBy` and `sortOrder` parameters from `messages/view` endpoint.
- Corrected regional host derivation logic and enabled auto-correction of database records for improved reliability.
- Optimized Supabase Realtime connectivity by increasing WebSocket timeout and forcing secure transport.
- Upgraded Calendly integration (API v2.2026): enabled programmatic scheduling for autonomous AI bookings.

Vercel Build Status: Confirmed Safe (Zoho fixes verified with `tsc`).
