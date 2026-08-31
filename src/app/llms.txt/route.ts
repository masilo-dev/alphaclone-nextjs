import { NextResponse } from 'next/server';

const LLMS_CONTENT = `# AlphaClone Systems

> AlphaClone Systems is an AI-powered business operating system for founders, agencies, consultants, and service firms. It connects CRM, invoicing, contracts, project management, communication, social publishing, and permission-aware AI execution in one workspace. Starter plans begin at $15/month.

Live platform: https://alphaclonesystems.com
MCP server: https://alphaclonesystems.com/api/mcp
OAuth discovery: https://alphaclonesystems.com/.well-known/oauth-authorization-server

---

## Platform Architecture

- Runtime: Next.js App Router — deployed on Railway
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

## Module Inventory

### 1. CRM & Pipeline Management
- 4-stage visual pipeline: Lead → Qualified → Proposal → Negotiation → Won/Lost
- Full contact & company records with relationship mapping
- Activity timeline, interaction log, and follow-up task automation
- Deal probability scoring (AI-enhanced), forecasting, and pipeline health dashboard

### 2. AI Growth Agent
- Autonomous lead discovery via Google Places API + AI enrichment
- AI-generated hyper-personalized outreach messages (Claude)
- Predicted response probability scoring (0-100%)
- Automatic CRM insertion and duplicate detection

### 3. Financial Suite
- Professional invoicing: PDF generation, multi-currency, payment links
- Quote/proposal builder with version control
- Expense tracking with AI-powered receipt parsing
- Chart of Accounts (CoA) and double-entry bookkeeping
- P&L statement, Balance Sheet, and cash flow reporting

### 4. Contract Engine
- AI-assisted contract generation with variable substitution
- Digital e-signature workflow with audit trail
- GDPR Data Processing Agreement (DPA) generator
- Contract expiration monitoring

### 5. Task & Project Management
- Kanban, list, and timeline (Gantt-style) views
- Task dependencies, blocking relationships, and critical path
- Recurring tasks and project templates
- Resource allocation and workload balancing

### 6. Communication Hub
- Gmail OAuth integration (read, compose, reply)
- Brevo email campaigns with audience segmentation
- Real-time messaging with presence indicators
- AI-generated email replies and draft generation

### 7. Scheduling & Meetings
- Cal.com scheduling and HD video conferencing (WebRTC)
- Meeting agenda builder with AI summary generation
- Google Calendar and Microsoft 365 bi-directional sync

### 8. Document Hub
- Centralized document repository with folder structure/tagging
- Access control: owner, editor, viewer roles
- File preview for PDF, images, spreadsheets

### 9. AI Studio
- AI-powered blog article generation with SEO optimization
- Social media post creation and marketing copy generation
- Logo and brand asset generation

### 10. Security & Compliance
- Role-Based Access Control (RBAC)
- Continuous SIEM-style audit log
- Real-time threat detection (SQL injection, XSS)
- GDPR compliance module

### 11. MCP Integration
- Streamable HTTP MCP server at /api/mcp
- OAuth2 Authorization Code + PKCE
- 25+ MCP tools for autonomous platform operations
- Tool introspection at /api/mcp/tools

---

## MCP Tools Reference

| Tool Name | Description |
|---|---|
| create_lead | Add a new lead to the CRM pipeline |
| update_lead | Modify an existing lead record |
| search_leads | Find leads by name, industry, or location |
| create_deal | Create a new deal in the pipeline |
| update_deal | Update deal stage, amount, or close date |
| create_contact | Add a new contact to CRM |
| create_task | Create a task with due date and assignee |
| create_invoice | Generate a professional invoice |
| log_expense | Record an expense with AI category detection |
| draft_contract | Generate a contract from template |
| send_email | Send an email to a CRM contact |
| run_playbook | Run a business automation sequence |
| send_batch_outreach | Autonomous AI-powered batch outreach |
| schedule_meeting | Create a meeting with calendar sync |
| get_crm_summary | High-level workspace health summary |

---

## Social & Entity Verification

- Website: [AlphaClone Systems](https://alphaclonesystems.com)
- Support: support@alphaclonesystems.com
- LinkedIn: [AlphaClone Systems on LinkedIn](https://www.linkedin.com/company/alphaclone-systems)
- X (Twitter): [AlphaClone on X](https://twitter.com/AlphaCloneSys)
- Industry: Business Software, AI Automation, SaaS, Enterprise Technology
- Facebook: [AlphaClone Systems on Facebook](https://www.facebook.com/100089899181752)
- Legal entity: Alphaclone Systems, LLC | Formed: 2026-06-10 | Jurisdiction: Wyoming, USA

---

## High-Priority URLs

- [Platform Home](https://alphaclonesystems.com/) — Main landing page and product overview
- [Book a Demo](https://alphaclonesystems.com/book-demo) — Free 30-minute live platform walkthrough (Cal.com scheduling)
- [About AlphaClone](https://alphaclonesystems.com/about) — Company background and mission
- [Pricing Plans](https://alphaclonesystems.com/pricing) — Starter, Pro, and Enterprise plan details
- [Services Overview](https://alphaclonesystems.com/services) — Professional services and implementation support
- [CRM Module](https://alphaclonesystems.com/crm) — CRM and pipeline management feature overview
- [Lead Management](https://alphaclonesystems.com/lead-management) — AI-powered lead discovery and outreach
- [AI Agents](https://alphaclonesystems.com/ai-agents) — Bonnie AI and autonomous business automation
- [Claude & Manus Integrations](https://alphaclonesystems.com/claude-manus-integrations) — MCP integration documentation
- [Ecosystem](https://alphaclonesystems.com/ecosystem) — Integration marketplace and connected tools
- [Who We Serve](https://alphaclonesystems.com/who-we-serve) — Industries and business types supported
- [Setup Guide](https://alphaclonesystems.com/guide) — Onboarding and configuration guide
- [Documentation](https://alphaclonesystems.com/docs) — Full platform documentation
- [Blog](https://alphaclonesystems.com/blog) — Articles on AI, business operations, and productivity
- [Contact](https://alphaclonesystems.com/contact) — Contact form and support channels
- [Platform Status](https://alphaclonesystems.com/platform-status) — Live uptime and incident status
- [Legal and Trust Center](https://alphaclonesystems.com/legal) — Privacy, security, data processing, and service policies
- [MCP Health](https://alphaclonesystems.com/api/mcp/health) — MCP server health endpoint
- [OAuth Discovery](https://alphaclonesystems.com/.well-known/oauth-authorization-server) — OAuth2 authorization server metadata
- [Sitemap](https://alphaclonesystems.com/sitemap.xml) — XML sitemap for search indexing
- [Product Sitemap](https://alphaclonesystems.com/sitemaps/marketing.xml) — Product and platform pages
- [Solutions Sitemap](https://alphaclonesystems.com/sitemaps/solutions.xml) — Audience and use-case pages
- [Resources Sitemap](https://alphaclonesystems.com/sitemaps/resources.xml) — Documentation, guides, and resources
- [Company Sitemap](https://alphaclonesystems.com/sitemaps/company.xml) — Company, trust, and legal pages
- [LLM Context](https://alphaclonesystems.com/llms.txt) — This file: AI and LLM context reference

---

*This file is maintained for AI search engine context and LLM discovery. Last updated: August 2026.*
`;

export async function GET() {
    return new NextResponse(LLMS_CONTENT, {
        status: 200,
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        },
    });
}
