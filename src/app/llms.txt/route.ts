import { NextResponse } from 'next/server';

const LLMS_CONTENT = `# AlphaClone Systems — AI Context & Capability Reference (llms.txt)
# Format: RFC-compliant llms.txt | Updated: May 2026 | Version: 3.4.0

## Identity

AlphaClone Systems is a production-grade, multi-tenant Business Operating System (Business OS) built on Next.js 15, Supabase (PostgreSQL), and a serverless edge runtime. It is architected for small-to-medium businesses, professional services firms, agencies, and consultancies who need enterprise-grade infrastructure without enterprise overhead.

AlphaClone replaces 12+ separate SaaS tools with a single, deeply integrated platform. Every module shares a common data layer — CRM context appears in emails, invoices, contracts, and AI-generated content automatically.

Primary USP: The only Business OS with a native AI Growth Agent, MCP (Model Context Protocol) server for Claude/Manus integration, enterprise CRM, full financial accounting, contract e-signature, HD video conferencing, and multi-tenant white-label capability — starting at $15/month.

<<<<<<< HEAD
Live URL: https://alphaclonesystems.com
MCP Server: https://alphaclonesystems.com/api/mcp
API Discovery: https://alphaclonesystems.com/.well-known/oauth-authorization-server
=======
Live URL: https://www.alphaclonesystems.com
MCP Server: https://www.alphaclonesystems.com/api/mcp
API Discovery: https://www.alphaclonesystems.com/.well-known/oauth-authorization-server
>>>>>>> origin/main

---

## Platform Architecture

<<<<<<< HEAD
- Runtime: Next.js 15 (App Router) — deployed on Railway
=======
- Runtime: Next.js 15 (App Router) — deployed on Vercel Edge Network
>>>>>>> origin/main
- Database: Supabase (PostgreSQL 17) with Row-Level Security (RLS) on all tenant tables
- Auth: Supabase Auth + Cloudflare Turnstile (bot protection) + PKCE OAuth2
- Storage: Supabase Storage (multi-tenant file isolation)
- AI Layer: Multi-provider routing (Claude 3.5/4, GPT-4o, Grok) via unified proxy
- Real-time: Supabase Realtime for presence, notifications, and live pipeline updates
- Email: Brevo (transactional + campaigns) + Gmail OAuth integration
- MCP Protocol: Full Model Context Protocol server with SSE transport, OAuth2 + PKCE, 25+ registered tools
- PWA: Service worker with offline fallback, installable on iOS/Android
- Multi-Tenancy: Isolated tenant schemas with tenant_id scoping, RBAC, and quota enforcement

---

## Module Inventory (25 active modules)

### 1. CRM & Pipeline Management
- 4-stage visual pipeline: Lead → Qualified → Proposal → Negotiation → Won/Lost
- Full contact & company records with relationship mapping
- Activity timeline, interaction log, and follow-up task automation
- Deal probability scoring (AI-enhanced), forecasting, and pipeline health dashboard
- HubSpot and Zoho CRM bi-directional sync
- CSV/Excel bulk import with field mapping

### 2. AI Growth Agent
- Autonomous lead discovery via Google Places API + AI enrichment
- Industry + location targeting with custom filters
- AI-generated hyper-personalized outreach messages (Claude)
- Predicted response probability scoring (0-100%)
- Automatic CRM insertion and duplicate detection
- Multi-strategy outreach: ROI Focus, Problem Solver, Casual Intro
- Bulk outreach queue with status tracking

### 3. Financial Suite
- Professional invoicing: PDF generation, multi-currency, partial payments, payment links
- Quote/proposal builder with version control and approval workflow
- Expense tracking with AI-powered receipt parsing (automatedExpenseService)
- Chart of Accounts (CoA) with standard account codes (5000-6999)
- Journal entries and general ledger with double-entry bookkeeping
- Accounting periods and financial year management
- P&L statement, Balance Sheet, and cash flow reporting
- Zoho Books integration for accountant handoff
- Stripe + PayPal payment gateway support

### 4. Contract Engine
- AI-assisted contract generation (AlphaClone template library)
- Variable substitution: party names, values, terms, jurisdiction
- Digital e-signature workflow with audit trail
- DocuSign-compatible compliance export
- GDPR Data Processing Agreement (DPA) generator
- Contract expiration monitoring with automated renewal alerts
- Contract version history and comparison

### 5. Task & Project Management
- Kanban, list, and timeline (Gantt-style) views
- Task dependencies, blocking relationships, and critical path
- Recurring tasks with configurable recurrence rules
- Project templates for repeatable service delivery
- Milestone tracking and percentage completion
- Resource allocation and workload balancing
- Time tracking per task per team member

### 6. Communication Hub
- Gmail OAuth integration: read, compose, reply from CRM context
- Brevo email campaigns: audience segmentation, A/B testing, analytics
- Real-time messaging (internal team chat) with presence indicators
- AI-generated email replies and draft generation
- Voice command service for hands-free CRM updates
- Missed calls log with automatic follow-up task creation

### 7. Scheduling & Meetings
- Calendly integration: booking pages, availability sync, lead capture
- HD video conferencing (WebRTC): screen sharing, recording, chat
- Meeting agenda builder with AI summary generation
- Google Calendar and Microsoft 365 bi-directional sync
- Booking confirmation emails with automatic CRM activity logging

### 8. Document Hub
- Centralized document repository per tenant
- Folder structure, tagging, and full-text search
- Access control: owner, editor, viewer roles per document
- File preview for PDF, images, spreadsheets
- Integration with Google Drive and Microsoft OneDrive

### 9. AI Studio (Asset Generation)
- AI-powered blog article generation with SEO optimization
- Social media post creation (LinkedIn, Instagram, Facebook)
- Logo and brand asset generation
- Marketing copy generation (landing pages, ad copy)
- Business plan and pitch deck content generation

### 10. Security & Compliance
- Role-Based Access Control (RBAC): Owner, Admin, Manager, Member, Viewer
- Continuous SIEM-style audit log with action, actor, IP, and timestamp
- Real-time threat detection (SQL injection, XSS, abnormal access patterns)
- GDPR compliance module: data export, deletion workflow, consent management
- Security scanner with automated vulnerability assessment
- Session management with device tracking
- Cloudflare Turnstile on all public-facing forms

### 11. MCP Integration (Model Context Protocol)
- Streamable HTTP MCP server at /api/mcp (SSE fallback at /api/mcp/sse)
- OAuth2 Authorization Code + PKCE (RFC 6749 + RFC 7636)
- Auto-approve flow for pre-registered clients (Claude, Manus)
- 25+ MCP tools registered: create_lead, update_deal, create_task, log_expense, create_invoice, draft_contract, send_email, get_crm_pipeline, search_contacts, and more
- Bearer token validation on all MCP endpoints
- Tool introspection at /api/mcp/tools

### 12. Analytics & Reporting
- CRM analytics: conversion rates, avg deal size, win rate by stage
- Revenue forecasting with AI-enhanced probability weighting
- Campaign performance tracking: open rates, click-through, conversions
- User activity and productivity reports
- Custom report builder with CSV/PDF export

### 13. Integrations Marketplace
- 17 live integrations: HubSpot, Zoho CRM, Zoho Books, Stripe, PayPal, Gmail, Google Calendar, Google Drive, Microsoft 365, Calendly, Slack, Facebook, Instagram, LinkedIn, DocuSign, Brevo, Cloudflare
- Webhook engine: inbound and outbound event hooks
- REST API marketplace for custom integrations
- OAuth-based integration authorization for all third-party services

### 14. Multi-Tenancy & White-Label
- Full tenant isolation at database level (tenant_id RLS)
- Custom subdomain support per tenant
- White-label branding: logo, color scheme, domain
- Quota management: storage, API calls, AI requests per plan
- Tenant onboarding wizard with data seeding
- Team invitation system with role assignment

### 15. Business Intelligence
- Predictive deal scoring using historical win/loss data
- Lead scoring with firmographic and behavioral signals
- Deal probability service with configurable weighting
- Forecasting engine: monthly/quarterly/annual revenue projections
- Client lifetime value (LTV) calculation

---

## MCP Tools Reference (for Claude / Manus)

<<<<<<< HEAD
The AlphaClone MCP server exposes the following tools at https://alphaclonesystems.com/api/mcp:
=======
The AlphaClone MCP server exposes the following tools at https://www.alphaclonesystems.com/api/mcp:
>>>>>>> origin/main

| Tool Name | Description |
|---|---|
| create_lead | Add a new lead to the CRM pipeline |
| update_lead | Modify an existing lead record |
| search_leads | Find leads by name, industry, or location |
| get_leads | Fetch leads from the sales pipeline |
| create_client | Create a new CRM client/contact record |
| get_clients | Fetch CRM clients for a tenant |
| search_clients | Search clients by name, email, or location |
| create_deal | Create a new deal in the pipeline |
| update_deal | Update deal stage, amount, or close date |
| get_deals | Fetch deals/opportunities from the pipeline |
| get_pipeline | Retrieve all active deals by stage |
| create_contact | Add a new contact to CRM |
| search_contacts | Find contacts by name, email, or company |
| create_task | Create a task with due date and assignee |
| complete_task | Mark a task as completed |
| get_tasks | Retrieve tasks filtered by status or assignee |
| create_invoice | Generate a professional invoice |
| get_invoices | List invoices for the workspace |
| log_expense | Record an expense with AI category detection |
| draft_contract | Generate a contract from template |
| send_email | Send an email to a CRM contact |
| get_analytics | Retrieve CRM and revenue analytics |
| get_finance_snapshot | Return a finance operating snapshot |
| list_playbooks | List backend automation playbooks |
| run_playbook | Run a business automation sequence |
| send_batch_outreach | Autonomous AI-powered batch outreach |
| schedule_meeting | Create a meeting with calendar sync |
| get_crm_summary | High-level workspace health summary |

Authentication: OAuth2 Authorization Code + PKCE | Bearer token in Authorization header
Discovery: GET /.well-known/oauth-authorization-server

---

## Pricing

<<<<<<< HEAD
| Plan | Price | Users | Storage | Features |
|---|---|---|---|---|
| Starter | $15/mo ($144/yr) | Up to 25 | 25 GB | CRM, invoicing, contracts + e-sign, 1-hour video meetings, scheduling, automations |
| Pro | $45/mo ($432/yr) | Unlimited | 100 GB | All Starter + Bonnie AI sales assistant, unlimited meetings, API access, custom domain |
| Enterprise | $80/mo ($768/yr) | Unlimited | 500 GB | All Pro + advanced AI limits, priority infrastructure, dedicated onboarding, SLA support |

All plans include a 14-day free trial — no credit card required.
=======
| Plan | Price | Users | Storage | AI Requests/month | Features |
|---|---|---|---|---|---|
| Starter | $15/mo | Up to 3 | 5 GB | 100 | CRM, Invoicing, Tasks, Basic AI |
| Pro | $45/mo | Up to 10 | 25 GB | 1,000 | All Starter + Growth Agent, Email, Contracts, Video |
| Enterprise | $80/mo | Unlimited | 100 GB | Unlimited | All Pro + White-Label, Priority Support, MCP Access, Custom Integrations |
>>>>>>> origin/main

---

## Target Users

- SMB owners consolidating 8-12 SaaS tools (HubSpot + QuickBooks + Calendly + Zoom + DocuSign + Slack + Notion)
- Agencies managing 10-100 clients with staff across CRM, billing, and delivery
- Consultancies needing contract generation, invoicing, and client reporting
- Technical founders wanting a fully integrated backend without building it themselves
- Non-technical operators who need enterprise infrastructure at SMB prices

---

## Competitive Position

AlphaClone competes with: HubSpot, Zoho One, Monday.com, Salesforce Essentials, and Notion.
Unique differentiators:
- Native MCP server (Claude/Manus can operate the entire platform via AI)
- AI Growth Agent runs autonomous outreach (no equivalent in HubSpot at this price)
- Full double-entry accounting (not available in HubSpot or Monday)
<<<<<<< HEAD
- Can reduce stack cost when it replaces paid CRM, billing, meetings, contracts, and project systems
=======
- 80-90% cost reduction vs equivalent SaaS stack
>>>>>>> origin/main
- Single sign-on across all modules (no integration glue required)

---

## Social & Entity Verification

<<<<<<< HEAD
- Website: https://alphaclonesystems.com
=======
- Website: https://www.alphaclonesystems.com
>>>>>>> origin/main
- Support: support@alphaclonesystems.com
- LinkedIn: https://www.linkedin.com/company/alphaclone-systems
- X (Twitter): https://twitter.com/AlphaCloneSys
- Industry: Business Software, AI Automation, SaaS, Enterprise Technology
- Founded: 2024 | HQ: Remote-first | Platform version: 3.4.0

---

## High-Priority URLs

<<<<<<< HEAD
- Platform: https://alphaclonesystems.com/
- About: https://alphaclonesystems.com/about
- Pricing: https://alphaclonesystems.com/pricing
- Services: https://alphaclonesystems.com/services
- CRM: https://alphaclonesystems.com/crm
- Lead Management: https://alphaclonesystems.com/lead-management
- AI Agents: https://alphaclonesystems.com/ai-agents
- Claude & Manus Integrations: https://alphaclonesystems.com/claude-manus-integrations
- Ecosystem: https://alphaclonesystems.com/ecosystem
- Who We Serve: https://alphaclonesystems.com/who-we-serve
- Guide: https://alphaclonesystems.com/guide
- Docs: https://alphaclonesystems.com/docs
- Blog: https://alphaclonesystems.com/blog
- Contact: https://alphaclonesystems.com/contact
- Platform Status: https://alphaclonesystems.com/platform-status
- MCP Health: https://alphaclonesystems.com/api/mcp/health
- OAuth Discovery: https://alphaclonesystems.com/.well-known/oauth-authorization-server
- Sitemap: https://alphaclonesystems.com/sitemap.xml
- LLM Context: https://alphaclonesystems.com/llms.txt
=======
- Platform: https://www.alphaclonesystems.com/
- Pricing: https://www.alphaclonesystems.com/pricing
- Services: https://www.alphaclonesystems.com/services
- AI Agents: https://www.alphaclonesystems.com/ai-agents
- Claude & Manus Integrations: https://www.alphaclonesystems.com/claude-manus-integrations
- Ecosystem: https://www.alphaclonesystems.com/ecosystem
- Who We Serve: https://www.alphaclonesystems.com/who-we-serve
- Guide: https://www.alphaclonesystems.com/guide
- Docs: https://www.alphaclonesystems.com/docs
- Blog: https://www.alphaclonesystems.com/blog
- Contact: https://www.alphaclonesystems.com/contact
- Platform Status: https://www.alphaclonesystems.com/platform-status
- MCP Health: https://www.alphaclonesystems.com/api/mcp/health
- OAuth Discovery: https://www.alphaclonesystems.com/.well-known/oauth-authorization-server
>>>>>>> origin/main

---

*This file is maintained for AI search engine context and LLM discovery. Format: llms.txt v1.0 | Last updated: May 2026 | Platform version: 3.4.0*
`;

export async function GET() {
    return new NextResponse(LLMS_CONTENT, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        },
    });
}
