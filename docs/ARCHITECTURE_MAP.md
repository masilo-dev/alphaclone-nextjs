# AlphaClone Systems — Architecture Map

**Architecture**: Full-Stack Multi-Tenant Next.js Operating System  
**Design System**: Charcoal Dark (`#0e1015`) / Light Mode with Untitled UI Design Tokens  
**Domain**: Enterprise Autonomous Business Operating System (BOS)

---

## 1. High-Level System Architecture

```
                      +--------------------------------------------------+
                      |         AlphaClone Public Web & Auth             |
                      |  - Landing Page (alphaclonesystems.com)          |
                      |  - Client Finance Portal (/portal/[token])       |
                      |  - Public Signing Gateway (/contracts/sign/[t])  |
                      |  - Public Invoice Gateway (/invoice/[id])        |
                      +------------------------+-------------------------+
                                               |
                                               v
                      +--------------------------------------------------+
                      |       Next.js 16 App Router & Edge Gateway       |
                      |  - Auth Middleware & Session Expiry Guards       |
                      |  - Tenant Boundary Validation (Header/Bearer)    |
                      |  - Route Rate Limiters & Daily Resource Quotas   |
                      +------------------------+-------------------------+
                                               |
         +-------------------------------------+-------------------------------------+
         |                                     |                                     |
         v                                     v                                     v
+------------------+                 +--------------------+                +-------------------+
|  Dashboard UI    |                 |  API & Webhooks    |                |  MCP Server Layer |
|  - OS Home       |                 |  - Invoices / Pay  |                |  - 568 Tools      |
|  - CRM & Leads   |                 |  - Contracts       |                |  - Finance Tools  |
|  - Deals / Pipe  |                 |  - Outreach API    |                |  - Contract Tools |
|  - Billing / Inv |                 |  - Zoho Webhook    |                |  - CRM Tools      |
|  - Projects & Ms |                 |  - Brevo Webhook   |                |  - Project Tools  |
|  - Unified Comms |                 |  - Twilio/WhatsApp |                |  - Outreach Tools |
+--------+---------+                 +---------+----------+                +---------+---------+
         |                                     |                                     |
         +-------------------------------------+-------------------------------------+
                                               |
                                               v
                      +--------------------------------------------------+
                      |       Durable Execution & Domain Engines         |
                      |  - ToolPolicyGate & Bonnie AI Safety Engine      |
                      |  - Connected Lifecycle Engine (Deal->Inv->Proj)  |
                      |  - Scrapy Research & Outbound Acquisition Engine |
                      |  - Outbound Queue Worker & Idempotency Replayer  |
                      |  - TabFocusCoordinator & Instant UI Query Cache  |
                      +------------------------+-------------------------+
                                               |
                                               v
                      +--------------------------------------------------+
                      |         Multi-Tenant Supabase Substrate          |
                      |  - PostgreSQL 15+ with Strict RLS Policies       |
                      |  - Atomic Signature RPCs & Mutation Locks        |
                      |  - Storage Buckets (invoice-documents, contracts)|
                      |  - Realtime Change Subscriptions                 |
                      +--------------------------------------------------+
```

---

## 2. Core Subsystems

### 2.1 Multi-Tenant Data Isolation
- **Tenant Context**: Every operational table contains `tenant_id UUID NOT NULL REFERENCES tenants(id)`.
- **Row-Level Security (RLS)**: Enforced via `auth.uid()` checking `tenant_users` membership. In server contexts, `set_tenant_context(tenant_id)` scopes transactions safely.
- **Cross-Tenant Prevention**: Mutations fail immediately when attempting to reference records outside the authenticated tenant boundary.

### 2.2 Connected Revenue Lifecycle Engine
Automates state transitions across revenue lifecycle links:
1. **Outreach Inbound Reply**: Inbound positive response classifies sentiment -> auto-qualifies Lead -> creates Deal -> writes `revenue_lifecycle_links` (`target_type: 'deal'`, `relationship: 'converted_to'`).
2. **Deal Close / Contract Execution**: All required canonical signers sign via identity-bound links -> triggers `runContractSignedFlow`.
3. **Contract Signed Workflow**:
   - Generates and persists `business_invoices` record (`relationship: 'billed_by'`).
   - Kicks off delivery `projects` (`relationship: 'provisions'`).
   - Links project to deal and contract.
   - Schedules milestone payments in `invoice_payment_schedules`.
   - Idempotently creates default project tasks (`toInsert = defaultTasks.filter(t => !have.has(t.title))`).
   - Emits client milestone notification without requiring public portal enablement.

### 2.3 Resilient Email & Delivery Pipelines
- **Dual Provider Architecture**:
  - **Zoho Mail**: Primary business inbox integration, IMAP/SMTP sync, folder management, draft management. Supports multipart attachment upload with automatic fallback to raw binary endpoint on HTTP 415.
  - **Brevo (Sendinblue)**: High-speed transactional delivery with verified provider message ID returns.
- **Idempotency & Replay Safety**:
  - Base idempotency key ensures duplicate clicks return cached `replayed: true` receipt.
  - Intentional resends issue a unique `attemptId`, generating a fresh receipt while tracking delivery lineage.
  - Rejection vs. Unknown distinction: Timeouts preserve `pending_verification` without unsafe automatic duplicate sending.

### 2.4 Frontend Caching & Tab Focus Synchronization
- **Instant UI Caching**: Eliminates loading skeletons on dashboard navigation by hydrating initial state from session cache.
- **`TabFocusCoordinator`**: Listens for window focus and visibility transitions, throttling events to prevent database connection spikes.
- **`useOnTabVisible`**: Background revalidation refreshes stale data silently without triggering layout shifts or loading spinners.
- **Auth Expiry Guard**: Restricts automatic JWT refresh to tokens expiring within 5 minutes (`EXPIRY_BUFFER_MS = 300,000`), avoiding unnecessary auth round-trips.

### 2.5 Bonnie AI & Model Context Protocol (MCP)
- **Universal Tool Registry**: 568 typed MCP tools covering all BOS capabilities.
- **`ToolPolicyGate`**: Financial mutations, mass emails, and contract modifications require human-in-the-loop confirmation (`bonnie_action_approvals`), preventing autonomous hallucinations from executing destructive actions.
