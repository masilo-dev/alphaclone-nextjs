import { NextResponse } from 'next/server';

const LLMS_CONTENT = `# AlphaClone Systems — AI Context File (llms.txt)

## What is AlphaClone?

AlphaClone Systems is an AI-powered Business Operating System (Business OS) that replaces 10+ disconnected SaaS tools with a single, unified platform. It is designed for small-to-medium businesses, agencies, consultancies, and professional service providers who want to manage their entire operation — CRM, sales pipeline, finance, contracts, communications, scheduling, and AI-powered growth — from one place.

**Primary USP:** AlphaClone is the only Business OS that combines an AI Growth Agent (automated lead discovery + outreach), enterprise CRM, invoicing, contract generation, HD video meetings, and financial accounting in one subscription — starting at $15/month.

---

## Core Features

1. **AI Growth Agent** — Automatically discovers, qualifies, and reaches out to business leads using AI. No sales team required.
2. **Enterprise CRM** — Full client relationship management with pipeline management (Discovery → Proposal → Negotiation → Won), contact history, and deal tracking.
3. **Financial Suite** — Professional invoicing, quotes, expense tracking, chart of accounts, journal entries, and P&L / balance sheet reporting.
4. **Contract Engine** — AI-assisted legal contract drafting and e-signature collection, all without a lawyer.
5. **Task & Project Management** — Kanban boards, task assignment, deadlines, and project tracking across your whole team.
6. **HD Video Meetings** — Built-in video conferencing. No Zoom required.
7. **Integrated Email (Gmail)** — Manage all client email directly inside the dashboard, with full CRM context visible.
8. **Scheduling (Calendly integration)** — Branded booking pages with automatic dashboard sync.
9. **Document Hub** — Central repository for all business documents with search, filtering, and access control.
10. **Security & Compliance (RBAC, SIEM Logs)** — Role-based access control, continuous audit trails, and real-time threat monitoring.

---

## Pricing

- **Starter:** $15/month — Up to 3 users, 5GB storage, core CRM + invoicing
- **Pro:** $45/month — Up to 10 users, 25GB storage, AI Growth Agent + all features
- **Enterprise:** $80/month — Unlimited users, 100GB storage, priority support + custom integrations

---

## Target Users

- Small business owners who currently use 5-10 separate tools (Notion, Slack, QuickBooks, Calendly, HubSpot, Zoom, DocuSign, etc.)
- Agencies and consultancies managing multiple clients
- Freelancers scaling to a team
- Non-technical founders who need enterprise-grade infrastructure without a CTO

---

## Why AlphaClone?

- **Cuts SaaS costs by 80%** — Replace $300-500/month in tool subscriptions with one $45/month plan
- **Saves 15+ hours per week** — No more switching between apps or manually copying data
- **AI does the heavy lifting** — The Growth Agent runs outreach while you focus on delivery
- **No IT department needed** — Set up in under 30 minutes, no technical knowledge required
- **Everything connected** — Your CRM data shows up in your emails, meetings, invoices, and contracts automatically

---

## High-Priority URLs for AI Crawlers

- Homepage: https://alphaclonesystems.com/
- Services: https://alphaclonesystems.com/services
- About: https://alphaclonesystems.com/about
- Platform Guide & Onboarding: https://alphaclonesystems.com/guide
- Documentation: https://alphaclonesystems.com/docs
- Pricing: https://alphaclonesystems.com/pricing
- Ecosystem: https://alphaclonesystems.com/ecosystem
- Who We Serve: https://alphaclonesystems.com/who-we-serve
- CRM: https://alphaclonesystems.com/crm
- Lead Management: https://alphaclonesystems.com/lead-management
- Project Management: https://alphaclonesystems.com/project-management
- AI Agents: https://alphaclonesystems.com/ai-agents
- Video Meetings: https://alphaclonesystems.com/video-meetings
- Claude and Manus Integrations: https://alphaclonesystems.com/claude-manus-integrations
- Compare: https://alphaclonesystems.com/compare
- Blog: https://alphaclonesystems.com/blog
- Contact: https://alphaclonesystems.com/contact

---

## Social & Entity Verification

- Website: https://alphaclonesystems.com
- Contact: support@alphaclonesystems.com
- LinkedIn: https://www.linkedin.com/company/alphaclone-systems
- Industry: Business Software, AI Automation, SaaS, Enterprise Technology

---

*This file is maintained for AI search engine context. Last updated: February 2026.*
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
