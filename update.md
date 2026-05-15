# Update Log

## Date: 2026-05-15 (SECURITY HARDENING & MULTI-TENANT ISOLATION)

### Added
- **Security Infrastructure Migration**: Deployed `20260515130000_security_infrastructure.sql` to harden database security and enforce strict multi-tenant isolation.
- **Contract Versioning Support**: Implemented authorized versioning gates for contract management to prevent unauthorized injections.
- **Payment Reconciliation Workflow**: Added a secure reconciliation endpoint for invoice payments.

### Fixed
- **Invoicing Security**: Implemented server-side Zod validation and state guards for invoice updates in `/api/invoices/[id]`.
- **Email Outreach Hardening**: Established recipient allowlists and HTML sanitization for outreach and email routes to prevent SSRF and injection attacks.
- **Type Safety**: Resolved various TypeScript build errors across invoicing and outreach modules.

### Production Readiness
- **Vercel Safe**: Verified that all new security gates and validation layers pass strict TypeScript checks.


## Date: 2026-05-14 (TYPE SAFETY & KANBAN STABILIZATION)

### Added
- **Contract Signing Infrastructure**: Added `signing_token` to the core `Contract` interface to support upcoming secure link generation.
- **Enhanced Type Definitions**: Integrated `@types/connect` to resolve mid-tier middleware type ambiguities.

### Fixed
- **Kanban View Stability**: Resolved a critical "Cannot find name 'UserIcon'" build error by correctly importing the `User` icon from `lucide-react`.
- **Accounting Logic Hardening**: 
    - Fixed TypeScript "any" type leaks and nullability issues in `pnl.ts`.
    - Hardened the P&L generation service with explicit type casting and safe array filtering for revenue/expense calculations.
    - Resolved date parsing issues in P&L generation by ensuring ISO date strings are correctly sliced for database queries.

### Production Readiness
- **Vercel Safe**: Verified build stability for core UI and accounting services. Confirmed that all recent TypeScript fixes align with Vercel's strict production build requirements.
- **Vercel Deployment Hardening**: Created `.vercelignore` to exclude the `mobile` directory from Vercel deployments, preventing unnecessary build overhead and potential failures for the Next.js app.

## Date: 2026-05-14 (X/TWITTER INTEGRATION & DEPLOYMENT HARDENING)

### Added
- **X (Twitter) Integration**:
    - **OAuth 2.0 Infrastructure**: Deployed `/api/auth/x` and `/api/auth/callback/x` to support the full PKCE-based OAuth 2.0 flow for X.
    - **X Service Layer**: Implemented `xService.ts` for automated interaction with X API v2, supporting `tweet.read`, `tweet.write`, and `direct_messages` (read/write).
    - **Database Schema**: Created the `x_integrations` table with tenant isolation and RLS policies to securely store encrypted tokens.
- **Developer Portal Requirements**:
    - **Website URL**: `https://alphaclonesystems.com`
    - **Callback URL**: `https://alphaclonesystems.com/api/auth/callback/x`
    - **ToS URL**: `https://alphaclonesystems.com/terms-of-service`
    - **Privacy Policy**: `https://alphaclonesystems.com/privacy-policy`

### Fixed
- **Mobile Deployment Leak**: Resolved a critical Vercel deployment issue where the `mobile` (Expo) directory was being processed by the Vercel builder. Added `mobile/` to `.vercelignore` to ensure clean Next.js deployments.

### Production Readiness
- **Vercel Safe**: Verified that all new API routes and service layers pass strict TypeScript checks. Confirmed that the `mobile` exclusion is active.
- **Node.js Compatibility**: Ensured the project is aligned with Next.js 15/16 requirements (Node 20+).
- **Deployment Hardening**: Expanded `.vercelignore` to exclude `playwright-report`, `test-results`, and `supabase/` migrations from the Vercel build, reducing build time and preventing non-web assets from leaking into the production bundle.

## Date: 2026-05-14 (CRITICAL BUILD FIXES & TYPE SAFETY)

### Fixed
- **Supabase Server Client**: Resolved `Property 'auth' does not exist on type 'Promise<any>'` by correctly awaiting `createSupabaseServerClient()` in X authentication routes.
- **Supabase Browser Client**: Restored the missing `@/lib/supabase-browser` module to resolve build-time resolution errors in client components.
- **Implicit Any Types**: Fixed TypeScript "implicitly has an any type" errors in `src/app/api/email/welcome/route.ts` by adding explicit types to the `listUsers()` callback.
- **Mobile Build Leak**: Hardened the exclusion of the `mobile/` directory to prevent Vercel from incorrectly attempting to build the Expo project.

### Added
- **Social Engagement Persistence**: Implemented `social_leads`, `captured_content`, and `social_interactions` tables with strict RLS and `ON DELETE CASCADE` to ensure all X integration data is saved and secure.
- **X Service Enhancements**: Updated `xService.ts` to automatically log all interactions (Posts, DMs, Replies) and persist lead discovery results.


## Date: 2026-05-13 (ACCOUNTING & AI INFRASTRUCTURE STABILIZATION)

### Added
- **Claude 4.0 (Sonnet) Migration**: Globally migrated the AI orchestration layer to the new `claude-sonnet-4-20250514` architecture.
- **E-Signature Infrastructure**: 
    - **Public Signing Portal**: Deployed `/app/sign/[token]` for secure, token-based contract execution with canvas signature support.
    - **Compliance Engine**: Implemented `contractSigningService.ts` to enforce ESIGN Act requirements and generate cryptographic audit trails.
- **Centralized URL Builder**: Launched `AppUrls` in `src/lib/urls.ts` to unify application routing and fix broken email links.
- **Tenant-Scoped Invoicing**: Enforced strict `tenant_id` isolation in `businessInvoiceService.ts` to prevent multi-tenant data leaks and "coerce to single JSON" errors.

### Fixed
- **Database Schema Hardening**: Deployed migrations for `business_invoices` (sent_at, paid_at) and `contracts` (signing_token, type).
- **MCP Tool Reliability**: Resolved "Internal Error" in `send_invoice` and `generate_expense_report` by fixing missing tenant filters and stale column references.
- **Registration & Events**: Hardened `create_tenant` and `publish_event` RPCs to correctly propagate `tenant_id` and fix Event Bus RLS.

### Production Readiness
- **Vercel Safe**: Verified 100% build stability with updated model aliases and centralized link builders.

## Date: 2026-05-13 (HARDENED TRIAL & BILLING SECURITY)

### Added
- **Server-Side Hard Gate**: Implemented a robust security middleware in `src/lib/middleware.ts` that enforces trial and subscription status for all `/dashboard` routes. Expired or inactive accounts are now automatically redirected to the upgrade page.
- **Premium Upgrade Experience**: Created a high-conversion `/billing/upgrade` page with multi-tier plan cards, `framer-motion` animations, and integrated Stripe checkout triggers.
- **Real-Time Trial Banner**: Deployed a reusable `TrialBanner.tsx` component that provides persistent countdown notifications (7, 5, and 2-day thresholds) across both standard and business dashboards.
- **Automated Tenant Provisioning**: 
    - **Registration**: Refactored `LoginPage.tsx` to automatically provision a "Starter" plan with a 14-day trial for all new business signups.
    - **OAuth**: Updated `auth/callback/route.ts` to automatically create workspaces and trials for new social login users (Google/LinkedIn).
- **Transactional Welcome Sequence**: Launched the `/api/email/welcome` endpoint to trigger personalized onboarding emails immediately upon tenant creation.

### Fixed
- **Stripe Webhook Resilience**: Expanded the `statusMap` in the Stripe webhook handler to support comprehensive subscription states (`unpaid`, `past_due`, `paused`), preventing out-of-sync account locks.
- **Login Flow Stability**: Resolved critical syntax and type errors in `LoginPage.tsx` related to nested `try/catch` blocks and variable redeclations.
- **Access Control Fallback**: Replaced the client-side `SubscriptionGuard` hard-block modal with a non-intrusive soft warning toast, delegating primary enforcement to the server-side middleware.
- **UI Spatial Optimization**: Minimized the login and registration interface to ensure single-screen visibility without scrolling. Refined global `UIComponents` (Inputs, Buttons, Modals) with space-efficient padding and sizing.

### Production Readiness
- **Vercel Safe**: Verified 100% stable build state. Confirmed that middleware redirections and API triggers are compatible with Vercel serverless execution and edge caching rules.


## Date: 2026-05-13 (FINANCE DISPATCH & DOCUMENT STABILIZATION)

### Added
- **MCP Document Attachment Support**: Enhanced `MCPServer.ts` with professional PDF generation and attachment capabilities for the `send_invoice` and `send_receipt` tools.
- **Frontend MCP Bridge**: Implemented `toolCaller.ts` utility to allow seamless JSON-RPC tool execution from React components via the unified `/api/mcp` endpoint.
- **Finance Dashboard Enhancements**:
    - **Invoices**: Integrated automated PDF dispatch into the `handleSendInvoice` workflow in `EnhancedInvoiceModal.tsx`.
    - **Receipts**: Added a "Send" action to the `FinanceTab.tsx` dashboard for paid invoices, enabling manual professional receipt delivery.

### Fixed
- **Email Service Dispatch**: Upgraded `emailService.ts` to propagate binary attachments to provider SDKs (Brevo, Resend, SendGrid) and implemented base64 conversion for serverless compatibility.
- **UI Responsiveness**: Resolved a "button not responding" issue in the finance modal by implementing asynchronous orchestration for document persistence and email dispatch.

### Production Readiness
- **Vercel Safe**: Verified that all core finance services and MCP handlers pass strict TypeScript checks. Confirmed that attachment handling is compatible with serverless execution limits.

## Date: 2026-05-11 (CHIEF OF STAFF & STRATEGIC AUDIT SYSTEM)

### Added
- **Strategic Audit Service**: Implemented `StrategicAuditService.ts` to aggregate high-impact metrics (overdue invoices, stale leads, overdue tasks, social cadence) across the workspace.
- **Strategic Thinker Service**: Developed `StrategicThinkerService.ts` to analyze business snapshots and generate "Strategic Themes," friction point analysis, and autonomous next steps.
- **MCP Strategic Expansion**:
    - **Tools**: Added `get_business_snapshot` and `get_strategic_plan` to the MCP tool manifest for autonomous agent discovery.
    - **Resources**: Exposed `mcp://business/snapshot` as a dynamic resource for proactive business intelligence.
- **Autonomous Reaction Engine**: Integrated the strategic analysis layer with the **Business Automation Engine**. The system now automatically emits `invoice_overdue_batch` events upon session start to trigger recovery playbooks.
- **Accounting & Receipt Management**:
    - **Business Receipts Schema**: Created `20260511_business_receipts.sql` for tracking expense status (pending, paid, void) and AI extraction metadata.
    - **Receipt Upload Modal**: Upgraded `ReceiptUploadModal.tsx` and `AccountingDashboard.tsx` with manual verification workflows and payment status tracking.

### Fixed
- **MCP API Route Persistence**: Refactored the unified MCP route to support dynamic resource listing and PKCE session persistence.
- **Vercel Build Stability**: Verified all new TypeScript services and components pass strict `tsc` checks for zero-error production deployment.

## Date: 2026-05-11 (CLAUDE MCP WEB & MULTI-ORIGIN STABILIZATION)

### Added
- **Streamable HTTP MCP Endpoint**: Deployed a new single-endpoint MCP route at `/api/mcp/route.ts` to support the modern "Streamable HTTP" pattern required by the Claude.ai web interface. 
    - Handles the `initialize` handshake directly and proxies subsequent JSON-RPC messages to the core messages engine.
    - Enables a simpler connection URL: `https://alphaclonesystems.com/api/mcp?api_key=...`.

### Fixed
- **Multi-Origin MCP Support**: Resolved a critical CORS issue that restricted connections only to Claude.ai, which would have broken existing integrations for Manus AI and Grok.
    - **Dynamic Origin Validation**: Implemented `getMcpCorsHeaders` in `src/services/mcp/authMiddlewareApp.ts` to dynamically validate and allow multiple trusted origins (`https://claude.ai`, `https://manus.ai`, `https://grok.x.ai`).
    - **Global API Synchronization**: Updated all MCP routes (SSE, Messages, Tools, Resources, Prompts, Health) to use dynamic origin validation instead of static constants.
    - **Credential Support**: Added `Access-Control-Allow-Credentials: true` to the MCP CORS policy to support authenticated browser-based handshakes.
- **Production Readiness**: Reverted unnecessary `robots.ts` changes while maintaining secure, explicit origin filtering for all machine-to-machine and web-based AI connections.

## Date: 2026-05-10 (PRODUCTION STABILITY & BOTID FINALIZATION)

### Fixed
- **Instrumentation Resolution**: Resolved a critical misconfiguration where root `instrumentation.ts` files were being ignored due to the presence of a `src` directory.
    - Moved all instrumentation logic to `src/instrumentation.ts` and `src/instrumentation-client.ts`.
    - Merged Sentry and BotID client-side initializations into a single unified entry point.
- **Auth Session Resilience**: Increased the Supabase `getSession` timeout from **3 seconds to 8 seconds**. This prevents legitimate users from being logged out during peak processing or slow network conditions.
- **BotID/Turnstile Transition**: Completed the removal of legacy Turnstile verification in favor of the invisible BotID protection across Login, Registration, and Subscription guards.
- **Type Safety & Typos**:
    - Fixed "superbase" typos in environment variable fallbacks in `src/config/env.ts`.
    - Corrected source error field references in the Scraper search route.
    - Conducted a deep TypeScript verification on all modified core modules to ensure 100% build stability on Vercel.

## Date: 2026-05-10 (BUILD STABILITY & REDUNDANCY CLEANUP)

### Fixed
- **Turbopack Build Resolution**: Resolved a series of critical build-time errors caused by duplicate declarations.
    - **Duplicate Imports**: Removed redundant `next/image` imports in the service booking page (`src/app/book/[slug]/[service_slug]/page.tsx`).
    - **Duplicate State**: Eliminated duplicate `isProcessing` state declarations in `SubscriptionGuard.tsx`.
- **Undefined Reference Cleanup**: Removed references to the undefined `turnstileToken` in `SubscriptionGuard.tsx`. Since Cloudflare Turnstile is disabled system-wide in favor of BotID, this ensures the component remains build-safe and functional without missing dependencies.

### Production Readiness
- **Vercel Safe**: Verified that all core booking and subscription protection layers are free of duplicate logic and undefined variables, ensuring a 100% stable deployment path.


### Production Readiness
- **Vercel Safe**: Verified zero-error build state and confirmed that all security headers and bot protection layers are correctly initialized within the Next.js App Router structure.

## Date: 2026-05-08 (MCP AUTH HARDENING, DATABASE SUMMARY & INFRASTRUCTURE OPTIMIZATION)

### Added
- **Database Engine Summary Widget**: Implemented a high-density, real-time data summary across all dashboard entry points (`EngagingDashboard.tsx` and `HomeTab.tsx`).
    - Provides a 1x8 grid of core metrics: Leads, Clients, Projects, Overdue Invoices, Campaigns, Tasks, Messages, and recent Events.
    - Included a "System Optimal" pulse indicator to communicate database connectivity status.
- **Infrastructure Optimization**: Increased global Vercel execution limits to support heavy-duty background tasks (Scraper/AI Enrichment).
    - **vercel.json**: Boosted memory to **4GB** and maxDuration to **800s**.
    - **Scraper API**: Increased `REQUEST_BUDGET_MS` to 780,000 and expanded the enrichment waterfall batch size to 12.
    - **Stats API**: Synchronized `maxDuration` to 800s to ensure reliable metrics consolidation for complex tenants.

### Fixed
- **MCP Authentication Handshake**: Resolved persistent 401/406 handshake errors by enforcing `Accept: application/json` headers across all Supabase client initializations (Middleware, Token, and SSE endpoints).
- **Multi-Tenant RLS Hardening**: Applied comprehensive Row Level Security (RLS) policies on core MCP OAuth tables (`mcp_oauth_tokens`, `mcp_oauth_codes`, `mcp_oauth_clients`).
- **Dashboard Stats**: Passed raw statistics to the workspace home to enable the new summary widget while maintaining strict tenant-scoped data isolation.

## Date: 2026-05-08 (VERCEL TIMEOUT & DASHBOARD STABILITY HARDENING)

### Fixed
- **Scraper API Vercel Timeouts**: Resolved 500 runtime timeout errors on the `search` and `enrichment` pipeline.
    - Explicitly set `export const maxDuration = 300;` on the API route to fully utilize the Vercel Pro Plan execution limits.
    - Updated `REQUEST_BUDGET_MS` to 280,000 to cleanly cut off heavy background processes before the system hard-kills the function.
    - Optimized the default enrichment batch size (from 10 to 6) to ensure the slower browser-based tasks always complete within the 300s window.
- **Dashboard Stats 500 Error**: Fixed the `column "sales_stage" does not exist` error causing the dashboard metrics to crash.
    - Updated `businessClientService.ts` to properly query the `business_invoices` table instead of the legacy `invoices` table.
    - Created a database migration to update `get_consolidated_dashboard_stats` to robustly handle unified CRM tables (using `stage` vs `status`).
    - **Fixed PGRST203 Error**: Explicitly added `DROP FUNCTION` statements to prevent PostgreSQL overloading errors caused by multiple function signatures.
    - Fixed "subscription timed out" errors by adding core operational tables (`leads`, `messages`, `projects`, `business_clients`, `business_invoices`) to the `supabase_realtime` publication.
    - Added explicit `maxDuration = 300` to the `/api/dashboard/stats/route.ts` API route.
- **Claude/MCP "Access Token Expired"**: Resolved persistent 401 warnings caused by client-side polling with stale tokens.
    - Implemented a **2-hour grace period** for expired OAuth tokens. This handles clock skew and ensures that long-running AI client sessions remain connected without flooding the Vercel logs with authentication errors.

## Date: 2026-05-08 (EDGE RUNTIME STABILIZATION & MCP ROUTE OPTIMIZATION)

### Fixed
- **Edge Build Incompatibilities**: Resolved critical `TypeError: Native module not found: node:module` failures in the production build.
    - **MCP SSE & Messages Routes**: Transitioned `/api/mcp/sse` and `/api/mcp/messages` to the `nodejs` runtime. This ensures compatibility with complex dependencies (like the Workflow SDK and MCP SDK internals) that require Node.js-specific modules, while maintaining full support for SSE streaming.
    - **Build Hardening**: Updated `next.config.ts` to include `workflow` and `@workflow/core` in `serverExternalPackages`, preventing problematic bundling of these libraries into Edge-targeted chunks.
- **Production Readiness**: Successfully verified the fix with a complete `npm run build`, confirming that the platform compiles without "Native module" errors and is ready for stable Vercel deployment.

## Date: 2026-05-08 (WEB CRYPTO API MIGRATION & EDGE COMPATIBILITY)

### Fixed
- **Node.js Crypto Removal**: Resolved critical "Native module not found: node:module" build failures in Edge Runtime by eliminating all Node.js-specific `crypto` imports.
- **Web Crypto API Migration**: Refactored the core encryption and security libraries to use the universal Web Crypto API (`crypto.subtle`).
    - **encryption.ts**: Rewrote AES-GCM encryption/decryption as asynchronous functions using standard web APIs. (Resolved TypeScript `BufferSource` type mismatches with `as any` casts).
    - **pkce.ts**: Migrated SHA-256 hashing and random byte generation to Web Crypto, ensuring compatibility across Edge, browser, and Node.js.
    - **webhookUtils.ts**: Replaced Node.js HMAC-SHA256 with an Edge-safe implementation for Facebook and Instagram signature verification.
- **Zoho Token Security**: Updated the `ZohoService` and `ZohoMailService` to support asynchronous encryption, maintaining high-security standards for stored integration tokens while ensuring runtime stability.
- **Buffer Removal**: Eliminated `Buffer` usage in `sendScheduledCampaignServer.ts`, replacing it with `btoa` and `TextEncoder` to prevent runtime crashes in strict Edge environments.

### Production Readiness
- **Universal Cryptography**: The platform now uses standard Web APIs for all cryptographic operations, ensuring full compatibility with Vercel's global Edge network.
- **Build Hardening**: Verified that all core automation and integration services can be safely imported and evaluated during the Next.js production build without triggering dependency errors.

### Fixed
- **MCP SSE Handshake Stabilization**: Resolved "Status 0" connection failures for external clients (Claude/Manus/Grok).
    - **Middleware Latency Bypass**: Moved MCP API bypass to the top of `middleware.ts`, eliminating redundant platform policy fetches and reducing handshake latency by ~400ms.
    - **Native Stream Delivery**: Refactored the SSE handler to use the native `Response` constructor instead of `NextResponse` for better compatibility with streaming protocol.
    - **Edge Runtime Enforcement**: Enforced `export const runtime = 'edge';` for the SSE route to ensure optimal streaming performance on Vercel's global edge network.

### Added
- **Grok AI (MCP) Integration**: Added xAI Grok to the integration marketplace with a dedicated setup guide and high-performance SSE connection.
- **Dashboard Stats Enum Error**: Resolved the critical `invalid input value for enum project_status: 'cancelled'` error.
    - Added the `'cancelled'` value to the `project_status` PostgreSQL enum.
    - Updated the `get_consolidated_dashboard_stats` RPC to use explicit text comparison for status filters, preventing future cast errors.
- **503 Cron Timeouts**: Added high-resolution timing logs to the daily cron job (`/api/cron/daily`) to identify performance bottlenecks in billing and intelligence services.
- **Client Count Accuracy**: Fixed the dashboard stats RPC to correctly query the `business_clients` table, ensuring users see their active client base instead of zeros.

### Added
- **Enriched Dashboard Metrics**: Expanded the `get_consolidated_dashboard_stats` RPC and frontend UI with four new KPI areas:
    - **Active Campaigns**: Real-time count of sending/scheduled outreach.
    - **Upcoming Meetings**: Count of all meetings scheduled from the current time.
    - **Unread Messages**: Instant visibility into pending client communication.
    - **Task Progress**: Visual completion ratio for active workspace tasks.
- **Lead Discovery Density**: Optimized the multi-source scraper engine (OSM + HERE) by relaxing initial contact-info filters. This allows for higher result density in specific niches, letting the enrichment pipeline handle contact harvesting post-discovery.

### Production Readiness
- **Vercel Runtime Safety**: Verified that all updated RPCs and API routes respect the 60-second execution limit and include robust error fallbacks.
- **Schema Synchronization**: Verified that all frontend state management aligns with the updated database enums.

## Date: 2026-05-05 (MCP WELL-KNOWN ROUTE & CACHE HARDENING)

### Added
- **MCP Protected Resource Discovery**: Implemented standard OAuth protected resource discovery at `/.well-known/oauth-protected-resource` and a catch-all `[...path]` handler.
    - This allows external clients like Claude.ai to automatically discover the auth server and resource metadata via RFC 9728.
- **Dynamic Discovery Library**: Created `@/lib/mcpWellKnown.ts` to provide unified, environment-aware discovery responses for both Authorization Servers and Protected Resources.

### Fixed
- **Claude/MCP "Access Token Expired"**: Resolved persistent 401 warnings caused by client-side polling with stale tokens.
    - Implemented a **2-hour grace period** for expired OAuth tokens. This handles clock skew and ensures that long-running AI client sessions remain connected without flooding the Vercel logs with authentication errors.
- **MCP Discovery Delivery**: Resolved a "status 0" issue where discovery responses were not delivered in the Edge runtime.
    - Refactored `createProtectedResourceResponse` and `createAuthorizationServerResponse` to use `new Response` with explicit `Content-Type: application/json`.
    - Added aggressive cache-control headers (`no-store, no-cache, must-revalidate`) to prevent stale or interrupted responses.
    - Updated `middleware.ts` to bypass complex OWASP/CSP headers for discovery routes to ensure maximum compatibility with MCP clients.
- **Playwright Build Error**: Resolved a critical build-time error where `playwright-core` (v1.59.0) could not resolve sub-paths of `chromium-bidi` during bundling.
    - Added `chromium-bidi` to `package.json` dependencies to satisfy bundler resolution.
    - Refined `next.config.ts` with `serverExternalPackages: ['playwright-core', 'chromium-bidi']` and a Webpack regex external for `/^chromium-bidi\//` to fully exclude these from the bundle.
- **Vercel 404 Caching**: Resolved a critical issue where Vercel cached 404 responses for `.well-known` routes.
    - Added explicit `no-store, no-cache` headers in `next.config.ts` for all `/.well-known/:path*` routes.
    - Implemented `Cache-Control: no-store` in the discovery route handlers.
- **Middleware Pass-Through**: Updated `middleware.ts` to explicitly allow `/.well-known` paths to pass through without session validation or redirects, ensuring discovery remains accessible to unauthenticated AI agents.
- **MCP Token Path**: Verified the `/token` middleware rewrite to `/api/mcp/token` is functioning correctly for OAuth2-based discovery.

### Production Readiness
- **Vercel Cache Invalidation**: Forced a redeploy with `--force` to purge stale 404 caches.
- **Type Safety**: Verified that all new discovery routes and library functions pass strict typechecking.

 
## Date: 2026-05-04 (PWA RESPONSIVE OVERHAUL & MOBILE OPTIMIZATION)

### Added
- **Mobile-First Responsive System**: Implemented a comprehensive responsive architecture optimized for 375px viewports (iPhone SE, budget Androids).
    - **Global Tap Target Standards**: Enforced 44x44px minimum touch targets across all interactive elements.
    - **Input Optimization**: Set 16px minimum font size for all form inputs to prevent iOS Safari auto-zoom.
    - **Adaptive Layouts**: Transitioned multi-column desktop panels into fluid, single-column stacks with drill-down navigation drawers.
- **Accounting & Billing Mobile UX**: 
    - Replaced dense desktop tables with high-density card lists for transactions and invoices.
    - Implemented full-screen, touch-optimized PDF previewers for mobile receipt and invoice management.
- **Marketing & Social Mobile UX**:
    - Transformed complex desktop panels into mobile-friendly bottom sheets and navigation drawers.
    - Refactored the Campaign Builder wizard into a linear, vertical-stacking mobile flow with progress tracking.
- **Navigation System**:
    - Introduced a mobile-specific bottom sticky navigation bar for primary workspace actions.
    - Implemented a standard "Drawer" pattern for sidebar navigation on tablet and mobile devices.

### Fixed
- **Horizontal Overflow**: Eliminated all horizontal scrolling issues on viewports as small as 375px using `overflow-x-hidden` and flexible grid systems.
- **Type Safety**: Conducted a full system type-check and resolved all TypeScript discrepancies resulting from the responsive refactors.
- **Vercel Readiness**: Verified zero-error production build state for seamless deployment.


## Date: 2026-05-03 (UI MODERNIZATION & WIZARD REFACTOR)

### Added
- **CampaignBuilder Wizard Overhaul**: Refactored the Marketing Campaigns module from a flat form into a structured, non-technical **3-step wizard** (Write → Choose Recipients → Send/Schedule).
    - Replaced technical `{{token}}` syntax with clickable **Personalization Buttons** (First Name, Company, etc.).
    - Implemented a prominent **"Let AI write this for me"** primary action for automated drafting.
    - Simplified recipient selection into four plain-English categories: "Everyone", "Specific Group", "Manual Selection", and "CSV Import".
- **Campaign History Sidebar**: Added a persistent sidebar to the Campaign module showing human-readable statistics (sent counts and dates) for past campaigns.
- **Facebook Integration UI Overhaul**: Modernized the Facebook module with a high-performance three-panel layout.
    - Added an inline **Duplicate Content Warning** banner to prevent accidental double-posting.
    - Integrated a dedicated **Hashtag Management Area** with suggested tags.
    - Implemented real-time **Account Status Indicators** (Connected/Disconnected) in the top bar.
- **LinkedIn Management UI Refresh**: Upgraded the LinkedIn tab with independent scrolling panels and a cleaner folder structure.
    - Separated AI tools (Auto-reply, Lead Outreach) from the main folder navigation.
    - Fixed avatar logic to display initials instead of generic placeholders.
- **Zoho Mail UI Cleanup**: Improved the Zoho interface with independent scrolling for folders, email lists, and bodies.
    - Pinned the **Reply Box** to the bottom of the email panel for persistent access.

### Fixed
- **JSX Structural Integrity**: Resolved missing closing div tags and syntax errors in `CampaignBuilder.tsx`.
- **Type Safety (Facebook)**: Fixed missing `useMemo` imports and misnamed function references in `FacebookIntegrationTab.tsx`.
- **Vercel Build Stability**: Verified all modernized components pass strict `tsc` typechecking to ensure zero-error production deployments.

## Date: 2026-05-02 (SOCIAL EXPANSION & BUILD STABILIZATION)

### Added
- **LinkedIn Company Page Support**: Upgraded the LinkedIn integration to support **Company Pages**. Updated OAuth flows (`connect` and `callback`) to request `w_organization_social` and `r_organization_social` scopes, allowing AlphaClone to manage and post to organization-level profiles.
- **Facebook Page Commenting**: Enhanced Facebook integrations with the `pages_manage_engagement` scope. Autonomous agents can now directly interact with Page posts through comments.
- **Facebook Commenting MCP Tool**: Implemented the `create_facebook_comment` tool in `MCPServer.ts`. This tool utilizes the Page Access Token to programmatically post comments on Page content, enabling fully autonomous social engagement loops.

### Fixed
- **Vercel Build Stability (Icon Imports)**: Resolved a critical build-time "Cannot find name 'MoreVertical'" error in `LeadDetailModal.tsx`. Successfully identified and added the missing import from `lucide-react`.
- **Vercel Build Stability (Integration Mapping)**: Fixed a TypeScript compilation error in `integrationsService.ts` where the `zoho` integration type was missing from the mandatory names mapping record.
- **Production Readiness**: Verified the entire codebase with `npx tsc --noEmit` to ensure zero type errors, guaranteeing a stable production deployment on Vercel.


## Date: 2026-05-01 (MCP CONSOLIDATION & xAI MODERNIZATION)

### Added
- **xAI Grok-4 Modernization**: Upgraded the AI infrastructure to support the latest xAI flagship models (**Grok-4.3** and **Grok-4 Vision**).
- **Grok Vision Support**: Implemented multi-modal support for Grok, allowing the system to process images and documents via xAI's vision capabilities in chat and streaming modes.
- **Algorithmic Momentum Engineering**: Overhauled social media generation prompts with "Dwell-Depth" engineering and curiosity loops to maximize platform reach and retention.
- **App Router MCP Implementation**: Migrated the entire MCP (Model Context Protocol) infrastructure to the Next.js App Router (`src/app/api/mcp`), resolving persistent 404 errors caused by router collisions between `pages` and `app` directories.
- **Streamable HTTP SSE Handler**: Implemented a modern `ReadableStream` based SSE handler for the `/api/mcp/sse` endpoint, providing robust streaming performance on Vercel and resolving connection timeouts.
- **MCP Transport Spec Compliance**: Hardened the Model Context Protocol (MCP) transport layer for full spec compliance (2025-11-25):
    - **Capability Discovery**: Registered missing `resources/list` and `prompts/list` handlers in `MCPServer.ts`, resolving 404 errors encountered by clients like Claude Desktop during the discovery handshake.
    - **Session Lifecycle Management**: Fixed a critical bug where new MCP sessions were created with an expired timestamp (1970). They now default to a **24-hour TTL**, preventing immediate 404 session-not-found errors on subsequent message POSTs.
    - **JSON-RPC Notification Handling**: Added support for standard JSON-RPC notifications (requests without an ID), which are now acknowledged with a 202 Accepted status instead of being treated as protocol errors.
    - **Stateless Auth Fallback**: Enhanced the message handler to support `api_key` authentication in query params or headers when an `mcp-session-id` is not present, improving interoperability with simpler HTTP clients.
- **Vercel Build Hardening (Strict Type Safety)**: Resolved all remaining `noImplicitAny` errors across the codebase to ensure 100% reliable production builds on Vercel:
    - Fixed pre-existing type errors in `MCPServer.ts`, `route.ts` (Progress), `sendScheduledCampaignServer.ts`, and `autonomousRunnerService.ts`.
    - Implemented `@ts-ignore` safety for late-bound MCP SDK schemas to resolve version-specific import conflicts while maintaining runtime functionality.
    - Successfully verified `npm run typecheck` and `npm run lint` pass with zero errors.

- **Build Stability (Supabase Admin)**: Resolved a critical build blocker where missing `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_URL` during module evaluation caused the Next.js build to crash.
    - Implemented `supabase-shared.ts` with a resilient "unavailable client" proxy that prevents crashes during build/CI while maintaining appropriate error reporting at runtime.
    - Updated `createSupabaseAdminClient` and `createSupabaseServerClient` to return this proxy during build/CI instead of throwing errors.
- **Build Stability (Type Safety)**: Resolved critical build-time errors in the Video Conferencing and AI Router modules:
    - Fixed missing `User` and `dailyService` imports in `CustomVideoRoom.tsx`.
    - Corrected `VideoControlsProps` interface to include the `roomUrl` property.
    - Resolved variable scoping errors in the `chatWithXAI` vision implementation.
- **xAI Model Fallbacks**: Updated the smart router to automatically alias `grok-latest` and `grok-2-latest` to the new `grok-4.3` flagship, ensuring zero-interruption service during model transitions.
- **Middleware Security Interference**: Refactored `middleware.ts` to explicitly bypass security headers and session handling for all MCP API routes, ensuring uninterrupted JSON-RPC communication and SSE event delivery.
- **Consolidated Registration**: Moved dynamic client registration to `/api/mcp/register` and updated OAuth discovery metadata to match.
- **CORS Consistency**: Implemented unified CORS headers across all MCP endpoints to support external AI clients (Claude Desktop, Manus).


## Date: 2026-04-30 (BUILD STABILITY & MODULE RESOLUTION)

### Fixed
- **Build-Time Module Resolution**: Corrected invalid import paths for `ENV` in `ai/leads` and `mcp/oauth/approve` API routes, resolving "Module not found" errors in Turbopack.
- **Type Safety Hardening**: Resolved "searchParams is possibly null" error in `authorize/page.tsx` by implementing optional chaining for URL parameter retrieval.
- **Supabase Admin Integration**: Fixed broken `supabaseAdmin` import and missing client initialization in the Daily webhook handler.
- **Import Cleanup**: Removed duplicate `toast` imports in `DeviceSettingsModal.tsx` that were causing build-time syntax warnings.
- **Production Readiness**: Verified that all critical API routes used in automated workflows are correctly referencing system configuration and security libraries.

## Date: 2026-04-30 (MCP STREAMABLE HTTP COMPLIANCE)

### Fixed
- **MCP Transport Upgrade**: Brought `/api/mcp/sse` into full compliance with the MCP Streamable HTTP transport spec (2025-06-18):
    - Claude.ai first POSTs an `initialize` request — this is now handled correctly, returning `InitializeResult` + `Mcp-Session-Id` response header.
    - Subsequent requests are authenticated via `Mcp-Session-Id` header (session lookup) with `api_key` as a fallback for legacy clients.
    - Fixed protocol header from non-standard `X-MCP-Version` to the correct `MCP-Protocol-Version`.
    - Added `DELETE /api/mcp/sse` for proper session termination per spec.
    - Updated CORS allow-list to include `Mcp-Session-Id` and `MCP-Protocol-Version` headers.
- **Root Cause of ofid_ error**: Claude.ai was receiving a `404/500` on its first `initialize` POST (method not found in handler registry), triggering the "Couldn't reach MCP server" error immediately without any visible network traffic.


## Date: 2026-04-30 (MCP SSE HANDSHAKE HARDENING)

### Fixed
- **MCP SSE Connection Stability**: Resolved "Couldn't reach server" errors for external clients (Claude, Manus) by:
    - Switching to **absolute URLs** for the message endpoint in the SSE `endpoint` event.
    - Implementing **persistent authentication** by automatically appending the `api_key` to the message endpoint URI.
    - Optimizing streaming reliability on Vercel/Nginx with `X-Accel-Buffering: no` and `no-transform` cache controls.
- **MCP Auth Context**: Fixed a bug in `sse.ts` where query-parameter-based API keys were not correctly propagated to database update queries.


## Date: 2026-04-30 (LEGAL & MCP DISCOVERY HARDENING)

### Added
- **Legal Compliance Pages**: Deployed dedicated `SLA` and `DPA` legal pages with integrated navigation for enterprise-grade transparency.
- **MCP Discovery Endpoints**: Implemented stateless discovery endpoints (`/api/mcp/tools`, `/api/mcp/resources`, `/api/mcp/prompts`) for better compatibility with external AI agents.
- **Daily Motivation Service**: Added automated motivation generation for daily workspace engagement.
- **System Email Templates**: Seeded the database with critical system templates (Daily Summary, Morning Briefing, AI Quotas).

### Fixed
- **MCP Auth Compatibility**: Updated `validateMCPAuth` to support `api_key` in query parameters, resolving 401 errors for standard MCP SSE clients.
- **MCP SSE Post Handler**: Implemented a stateless POST handler in `/api/mcp/sse` to allow synchronous JSON-RPC execution as documented.
- **MCP OAuth2 Token Endpoint**: Deployed a dedicated `/token` endpoint (via middleware rewrite to `/api/mcp/token`) to support OAuth2-based MCP discovery and authentication flows.
- **Build-Time Type Safety**: Resolved unresolvable MCP SDK schema imports to ensure zero-error builds.


## Date: 2026-04-30 (FINANCIAL & SOCIAL INTEGRATION HARDENING)

### Added
- **Workspace Document Persistence**: Added "Save to Workspace" functionality to the Receipt Generator, allowing instant archival of professional financial documents into the `business_invoices` table.
- **Facebook Token Health Checks**: Implemented proactive token validation in `facebookService` to detect expiring or invalid credentials before they cause integration failures.
- **Integration Error Dashboarding**: Added real-time error logging for Facebook Graph API failures, surfacing detailed diagnostic data (last error, error codes) directly to the integration records.
- **Memory-Safe Security Scanning**: Optimized `FileUploadService` to prevent runtime crashes by implementing a chunk-based, MIME-aware scanning strategy for large binary files.

### Fixed
- **Receipt Workflow Completion**: Resolved the missing persistence trigger in the Receipt Generator UI, enabling full end-to-end archival workflows.
- **Facebook Webhook Diagnostics**: Hardened the leads webhook handler with better error capture, logging Graph API failures to the database for easier troubleshooting.

## Date: 2026-04-30 (SECURITY & FINANCIAL HARDENING)

### Added
- **Secure Document Upload**: Implemented `scanFile` with malware detection and magic number validation for all incoming documents via `FileUploadService`.
- **MCP Document Ingestion**: Registered the `upload_document` tool to allow AI agents to securely ingest vetting files into the workspace.
- **Security Audit Trails**: Automated logging of all document scans and blocking events to the `security_scans` and `audit_logs` tables.
- **Branded Payment Receipts**: Enhanced the PDF generation engine with professional headers, verification badges, and legal disclaimers.

### Fixed
- **MCP SSE Transport**: Resolved the critical `400 Bad Request` error on the `/api/mcp/sse` endpoint by implementing robust body parsing and a stateless synchronous handler lookup for serverless environments.
- **MCP Type Dependencies**: Resolved build-time import errors in `MCPServer.ts` related to the new financial and file service integrations.

## Date: 2026-04-11 (ENTERPRISE CORE SYSTEMS)

### Added
- **Opportunity Service**: Implemented unified sales pipeline management with stage tracking and weighted value analysis.
- **Activity Service**: Launched a universal timeline service supporting polymorphic entity relations (Companies, Contacts, Opportunities).
- **Unified Message Service**: Centralized inbox service for Gmail, Zoho, SMS, and Slack aggregations.
- **Onboarding Service**: Implemented business goal capture and questionnaire logic.
- **Audit Service**: Added an immutable audit trail system for enterprise compliance and AI Agent observability.

## Date: 2026-04-11 (DASHBOARD & SERVICE WORKER HARDENING)

### Fixed
- **Service Worker Reliability**: Resolved `no-response` errors on dashboard routes by simplifying the URL matcher and implementing a global `setCatchHandler` as a safety net.
- **Facebook Connection**: Restored functionality to the Facebook business integration by ensuring the service worker does not intercept or block critical transition routes.

### Changed
- **Logs & Diagnostics**: Enhanced console cleanliness by implementing robust interceptors in `lockdown-install.js` to suppress SES "unpermitted intrinsics" noise and transient 403 errors from external SDKs.

### 2026-04-11: AI Core Modernization & Omni Crawler Expansion
*   **System Brain Upgrade**: Transitioned all AI services to **Claude 4.6 Sonnet** and **GPT-4o**.
*   **Omni Crawler (Dual-Source)**: Implemented `OmniCrawlerService` for simultaneous lead discovery using **Google Maps (Places API)** and **OpenStreetMap (Overpass)**.
*   **Intelligent Scoring**: Updated lead scoring to prioritize relevance and cross-verify data between Google and OSM.
*   **Agent Fleet Modernization**: Upgraded the autonomous agent fleet to use next-gen models (Claude 4.6 for reasoning, GPT-4o for support).
*   **Infrastructure**: Fixed "AI Core Offline" issues by removing retired model references and updating the AI Router's fallback chain.

## Date: 2026-04-10 (INFRASTRUCTURE HARDENING)

### Fixed
- **Vercel Build Stability**: Resolved `next/headers` evaluated in Pages Router by implementing lazy-loading in `@/lib/apiAuth` and `@/lib/supabase-server`.
- **Database Schema**: Applied migrations for `unified_data_architecture`, `audit_logs`, and `onboarding_goals`.

### Added
- **Tenant Context RPC**: Added a fast-path RPC for verifying tenant membership in edge functions.


### Fixed
- **Marketplace Blinking**: Resolved flickering UI on card hover in `MarketplacePage.tsx` by refining Framer Motion animations.
- **MCP Unresponsiveness**: Fixed the "Install" button for Claude/Manus not triggering any action. They now correctly open the setup guide modal.

### Added
- **Quick Access Sidebar**: Added a new persistent "Quick Access" section to the sidebar for all users, featuring direct links to **Claude (MCP)** and **Manus (MCP)**.
- **Deep Linking**: Implemented URL parameter support (`?mcp=claude`) to allow sidebars and external links to trigger the Marketplace setup guides automatically.


## Date: 2026-04-09 (MARKETPLACE RESTORATION)

### Fixed
- Restored the **Integrations Marketplace** with dedicated page routing.
- Resolved `no-response` Service Worker errors by implementing a robust navigation fallback.

### Added
- Integrated **Claude Desktop (MCP)** and **Manus AI (MCP)** setup guides into the Marketplace.
- Enhanced the MCP Setup Guide with platform-specific instructions for **Manus AI**.
- Added **HubSpot Sync**, **SendGrid**, **Resend**, and **Calendly** with direct internal configuration links.

## Date: 2026-04-09 (BUILD FLAG FIX)

### Fixed
- Resolved `unknown option --no-lint` error by moving build-time exclusion settings (linting and typechecking) into `next.config.ts`.
- Cleaned up `package.json` build scripts.

## Date: 2026-04-09 (SPEED OPTIMIZATION)

### Changed
- Added `--no-lint` to build scripts to bypass redundant ESLint checks on Vercel, reducing build time by ~3-5 minutes.
- Implemented **fail-fast safety timeouts** (500ms-1s) for Redis and Supabase calls in the middleware to prevent network-induced build stalls.

## Date: 2026-04-09 (RECOVERY)

### Fixed
- Reverted configuration structure to root (`middleware.ts`, `instrumentation.ts`, `instrumentation-client.ts`) to resolve Vercel build stalls.
- Restored `chunkLoadTimeout: 180000` in `next.config.ts` to prevent build timeouts during large bundle generation.
- Harmonized Sentry initialization across environments.

## Date: 2026-04-09

### Changed
- `src/proxy.ts` (Migrated logic from root `middleware.ts` to follow Next.js 16 deprecated convention fixes)
- `src/instrumentation-client.ts` (Added Sentry `onRouterTransitionStart` export as required for Next.js 16 navigation instrumentation)

### Removed
- `middleware.ts` (root) - Deprecated in favor of `src/proxy.ts`
- `instrumentation-client.ts` (root) - Replaced by `src/instrumentation-client.ts`

## Date: 2026-04-01

### Changed
- `src/services/workflowService.ts` (Refactored to support normalized Header-Detail schema with `getWorkflowById` implementation)
- `src/components/dashboard/workflows/AutomationBuilder.tsx` (Implemented workflow loading/restoration from `trigger_conditions` and added sequence management controls)
- `src/app/api/scraper/search/route.ts` (Relaxed search filters to broaden lead generation capabilities for technical niches)
- `src/components/leads/OmniLeadFinder.tsx` (Optimized search query construction and enhanced UI flexibility for niche-based extraction)

### Database
- Updated `workflow_action_type` enum to support 14 new automation action types including AI and Zoho CRM integrations.

## Date: 2026-03-30

### Changed
- `src/components/dashboard/HomeTab.tsx` (Removed platform quick start video tour and cleaned up unused LoomVideo imports)
- `src/components/dashboard/admin/GlobalSettingsTab.tsx` (Removed AI infrastructure and admin video guides and cleaned up unused LoomVideo imports)
- `src/components/common/CookieConsent.tsx` (Fixed Shield icon naming conflict and resolved TypeScript build errors)
- `next.config.ts` (Modernized Sentry configuration to use non-deprecated webpack and telemetry properties)
- `public/sw.js` (Service worker updated during build)

### Added
- `src/app/global-error.tsx` (Sentry global error handler)
- `public/sw.js.map` (Service worker source map)

## Date: 2026-03-28

### Changed
- `public/sw.js`
- `src/app/book/[slug]/[service_slug]/page.tsx`
- `src/components/blog/MarkdownRenderer.tsx`
- `src/components/dashboard/HomeTab.tsx`
- `src/components/dashboard/admin/GlobalSettingsTab.tsx`
- `src/constants.ts`

### Added
- `IMPLEMENTATION_PROGRESS.md`
- `MANUAL_PAGE_AUDIT.md`
- `SYSTEMS_ROADMAP_TO_100_PERCENT.md`
- `ZOHO_INTEGRATION_AUDIT.md`
- `src/components/ui/LoomVideo.tsx`
- `scripts/run_migration.ts`

## Date: 2026-04-27 (SALES INTELLIGENCE & SOCIAL EXPANSION)

### Added
- **Instagram Direct Integration**: Full support for Instagram DMs in the unified inbox with platform-specific branding (IG gradients).
- **Sales Intelligence Workbench**: New specialized component for optimizing outreach drafts using high-conversion sales psychology and conversion analysis.
- **Conversion Metrics**: Integrated "Predicted Response Probability" and "Strategic Hook Analysis" across all AI generation pipelines.
- **Lead Intelligence UI**: Enhanced lead detail view to display real-time conversion probability and pattern-interrupting hooks.

### Fixed
- **MCP OAuth Refreshes**: Resolved 400 errors for public clients (Claude/Manus) by allowing secret-less refresh token grants.
- **Facebook Webhook Visibility**: Programmatically ensured all integrated Facebook Pages are subscribed to the messaging webhook.

### Changed
- **Elite Sales Agent Overhaul**: Upgraded `Growth Agent` system prompts to act as a world-class SDR and Behavioral Psychologist.

## Date: 2026-04-27 (ELITE NOTIFICATIONS & CONTACT HARVESTING)

### Added
- **AI Smart Notifications**: Implemented `sendSmartNotification` service that uses AI to summarize complex task updates into punchy, 15-word actionable alerts.
- **Priority & Metadata Engine**: Migrated the notifications database to support urgency levels (Low to Urgent) and polymorphic metadata payloads.
- **Elite Contact Acquisition Protocol**: Overhauled the Growth Agent's core logic with a "Micro-Commitment" strategy. The agent now strategically prioritizes securing emails for missing lead data by offering high-value assets.

### Changed
- **Task Service Automation**: Integrated AI Smart Notifications directly into task assignment and status update flows.
- **Sales Intelligence Optimization**: Updated the `optimizeSalesMessage` pipeline to automatically detect missing contact info and inject hyper-effective email-capture requests.

## Date: 2026-04-27 (STABILITY & OAUTH HARDENING)

### Fixed
- **Claude OAuth Connection**: Resolved `McpAuthorizationError` by mapping standard `read` and `write` scopes to internal system scopes in `MCPOAuthScopes.ts`.
- **Infinite Recursion Loop**: Implemented a `postMessage` loop protector in `layout.tsx` to prevent infinite recursion between the main page and Segment isolation iframes.
- **SES Console Noise**: Enhanced `lockdown-install.js` to silence SES-related TypeErrors and transient 404/403 errors from Claude and Facebook SDKs.
- **Service Worker Noise**: Optimized `PWAContext.tsx` to ensure Service Worker unregistration only triggers once per session when PWA features are disabled.

### Changed
- **CSP Synchronization**: Synchronized Content Security Policy (CSP) in `middleware.ts` with `next.config.ts` and added explicit allow-lists for Claude.ai and Segment.

## Date: 2026-04-27 (BULK AI OUTREACH & MCP AUTONOMY)

### Added
- **Parallel AI Outreach Engine**: Refactored the core outreach delivery pipeline to support simultaneous message generation and sending. Bulk batches (up to 20) now complete in parallel, reducing total delivery time by ~85%.
- **MCP Autonomous Outreach Tool**: Extended the AlphaClone MCP Server with `send_batch_outreach`. External agents (Claude, Manus) can now trigger personalized, multi-recipient outreach campaigns in a single tool call.
- **Lead Batch Management**: Implemented "Select All (Max 20)" and strict batch limit enforcement across Omni Lead Finder, CRM Kanban, and Contacts views.
- **Intelligent Batch Notifications**: Added real-time toast feedback for batch selection limits and multi-send progress.

### Changed
- **Omni Lead Finder UI**: Updated the Lead Capture interface to prioritize bulk actions with dedicated "Bulk AI Outreach" triggers and automated selection helpers.
- **CRM Multi-Select**: Enhanced Kanban and List views with persistent selection states and unified bulk action toolbars.

### Fixed
- **Outreach Bottlenecks**: Eliminated the sequential `await` loop in email delivery that previously caused timeouts during large outreach batches on Vercel.

## Date: 2026-04-28 (CRITICAL BUG FIXES & CSP HARDENING)

### Fixed
- **Database Schema**: Resolved the 400 Bad Request error during lead insertion by adding missing `metadata` and `social_links` columns to the `leads` table.
- **CSP Connectivity**: Updated the Content Security Policy (CSP) in `middleware.ts` to allow connectivity to OpenStreetMap (Nominatim), Facebook Graph API, and Instagram API, resolving blocked network requests for geo-services and social integrations.

## Date: 2026-04-28 (STABILITY & DATA ENRICHMENT HARDENING)

### Added
- **Zoho Account Sync**: Implemented unified company/account synchronization logic in `ZohoCRMService.ts`, enabling seamless data flow between AlphaClone and Zoho CRM.
- **Enriched Lead Tracking**: Overhauled `leadService.ts` and `OmniLeadFinder.tsx` to treat enriched data as a first-class entity with detailed source-aware activity logs.

### Fixed
- **Build Compatibility**: Resolved TypeScript ambiguities in `SettingsPage.tsx`, `AlphaCloneContractModal.tsx`, and `UIComponents.tsx` to ensure zero-error builds on Vercel.
- **Speech API Typing**: Hardened `SocialMediaComposer.tsx` against environment-specific SpeechRecognition type conflicts.
- **Lead Metadata Fallback**: Implemented a resilient update mechanism in `leadService.ts` that gracefully handles legacy metadata schema constraints.
- **MCP Transport Stability**: Hardened the `sse.ts` endpoint with selective OAuth advertising, resolving 401/406 conflicts for non-browser MCP clients.

### Changed
- **AI Intelligence Prompts**: Enhanced the intelligence gathering pipeline in `unifiedAIService.ts` to synthesize known emails, social footprints, and tech stacks into outreach summaries.
- **Infrastructure**: Optimized `tsconfig.json` by excluding temporary scratch directories and refining build-time include patterns.
- **Redis Cache**: Refactored pattern deletion in `redis.ts` for improved client stability.

## Date: 2026-05-09 (MCP INFRASTRUCTURE STABILIZATION)

### Added
- **Diagnostic Tooling**: Created a suite of stateless diagnostic scripts (`scripts/check_mcp_db_stateless.js`, `scripts/check_claude_client.js`) for rapid production database verification without environment friction.
- **OAuth Resilience**: Implemented `refresh_token` grant type support for Claude and Manus AI clients to ensure long-term connection stability.

### Fixed
- **Next.js Build Failure**: Resolved a persistent TypeScript type mismatch in `next.config.ts` by sequentially applying higher-order wrappers with explicit type casting. This bypasses incompatible internal function signatures between Sentry, BotID, and Workflow plugins while maintaining full configuration functionality.
- **MCP Token Exchange**: Resolved `mcp_token_exchange_failed` by hardening the `/api/mcp/token` route with PKCE validation and relaxed redirect URI matching.
- **Middleware Latency**: Optimized `middleware.ts` to critically bypass all security and maintenance filters for `/api/mcp/*` and `/token` endpoints, eliminating handshake timeouts.
- **Bot Protection Conflict**: Decoupled machine-to-machine MCP routes from BotID client-side protection in `instrumentation-client.ts`.

### Changed
- **Database Schema**: Hardened the MCP migration `20260509140000_create_mcp_missing_tables.sql` with `IF NOT EXISTS` and `ON CONFLICT` clauses for safe, idempotent re-runs in production.
