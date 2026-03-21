# Update Log

## Latest Changes
- Improved Finance Dashboard interactivity (removed exit animation blockers).
- Resolved "white-on-white" input visibility issues by adding `color-scheme: dark` to global CSS.
- Refactored Contact List (`ClientsPage.tsx`) to use in-page modals for Proposal and Invoice creation.
- Integrated `mailto:` links for "Send Email" action in Contact Cards.
- Optimized Client Nexus UI footprint: reduced header sizes and compacted "Quick Actions" (Call/Email) buttons for improved screen real estate.
- Fixed Zoho API 401 Unauthorized errors by implementing recursive token refresh and retry logic in `zohoServerService.ts`.
- Resolved Zoho API 400 Bad Request (`EXTRA_PARAM_FOUND`) errors by removing unsupported `sortBy` and `sortOrder` parameters from `messages/view` endpoint.
- Refined Zoho Mail pagination to use 1-indexed `start` parameter, ensuring alignment with Zoho V1 API specifications.
- Implemented `search_messages` action in Zoho API handler for full email activity search support.
- Enhanced Zoho error mapping to provide descriptive feedback for specific error codes (e.g., rate limits, account status).
- Removed legacy Zoho CRM logic and AI tool integrations (`createCRMLead`) to focus exclusively on robust email management.
- Corrected regional host derivation logic and enabled auto-correction of database records for improved reliability.
- Resolved Zoho "ZERO CONVERSATION" issue by implementing strict `sortBy=date&order=desc` sorting and robust folder ID resolution.
- Standardized Zoho API response payload with normalized fields (`id`, `date`, `from`, `snippet`) for simplified UI rendering.
- Enhanced Zoho Mail UI with resilient date parsing and improved folder synchronization.
- Upgraded system-wide AI models to **Claude 4.5/4.6** (Claude Sonnet 4.6 & Claude Haiku 4.5) for improved 2026 reasoning and performance.
- Implemented `aiHealthService.ts` for real-time monitoring of AI provider connectivity and key validity.
- Resolved model ID mismatch by standardizing all agent fleet roles on 2026 frontier models.
- Established a strategic roadmap for **Long-Term AI Memory** and **Capability-Based Orchestration** to ensure 10-year platform longevity.

Vercel Build Status: Confirmed Safe (AI upgrades verified with `tsc`).
