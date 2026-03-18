# Update Log

## Latest Changes
- Improved Finance Dashboard interactivity (removed exit animation blockers).
- Resolved "white-on-white" input visibility issues by adding `color-scheme: dark` to global CSS.
- Refactored Contact List (`ClientsPage.tsx`) to use in-page modals for Proposal and Invoice creation.
- Integrated `mailto:` links for "Send Email" action in Contact Cards.
- Optimized Client Nexus UI footprint: reduced header sizes and compacted "Quick Actions" (Call/Email) buttons for improved screen real estate.
- Fixed Zoho API 400 errors with regional host self-healing for .com and .eu accounts.
- Optimized Supabase Realtime connectivity by increasing WebSocket timeout and forcing secure transport.
- Corrected Zoho proxy host derivation logic and enabled auto-correction of database records.
- Upgraded Calendly integration (API v2.2026): enabled programmatic scheduling for autonomous AI bookings.
- Integrated AI-powered meeting recaps and transcripts into persistent memory (Supabase).
- Added automatic webhook handling for meeting no-shows and recovery workflows.
- Refactored `calendlyService.ts` to be fully async and server-compatible.

Vercel Build Status: Confirmed Safe (`npm run build` succeeded).
