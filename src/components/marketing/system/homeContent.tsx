import Link from 'next/link';
import type { AlphaIconName } from '@/components/marketing/icons';
import { PrimaryCTA, SecondaryCTA } from './CtaButtons';


export const HOME_TRUST_NOTES = [
  { label: '14-Day Free Trial', icon: 'trust-card' as AlphaIconName },
  { label: 'Zero credit card required', icon: 'trust-card' as AlphaIconName },
  { label: '10-minute setup', icon: 'trust-clock' as AlphaIconName },
  { label: 'Instant data import', icon: 'trust-secure' as AlphaIconName },
] as const;

export const HOME_PLATFORM_FEATURES = [
  {
    name: 'Living CRM',
    body:
      'Every lead, client record, and email thread linked to active deals. Zero lost context when passing prospects from sales to project delivery.',
    href: '/crm',
    icon: 'crm' as AlphaIconName,
  },
  {
    name: 'Smart Proposals & E-Sign Contracts',
    body:
      'Draft scope, capture digital signatures, and trigger delivery rules automatically—without paying $400/year for DocuSign or Pandadoc.',
    href: '/docs',
    icon: 'documents' as AlphaIconName,
  },
  {
    name: 'Project Delivery & Milestones',
    body:
      'Manage deliverables, team tasks, and client approvals directly tied to the client contract and budget timeline.',
    href: '/project-management',
    icon: 'projects' as AlphaIconName,
  },
  {
    name: 'Financial Invoicing & P&L',
    body:
      'Convert completed milestones into compliant invoices, collect payments via Stripe, and reconcile your real-time profit and loss ledger.',
    href: '/docs#financials',
    icon: 'invoicing' as AlphaIconName,
  },
  {
    name: 'Bonnie AI & MCP Engine',
    body:
      'An operational assistant grounded in your actual workspace data. Reads client notes, drafts proposals, and executes actions safely via Model Context Protocol.',
    href: '/ai-agents',
    icon: 'bonnie' as AlphaIconName,
  },
  {
    name: 'Connected Communications',
    body:
      'HD video meetings, calendar scheduling, and Gmail inbox unified inside the client timeline—so no meeting notes or follow-ups slip away.',
    href: '/ecosystem',
    icon: 'connected' as AlphaIconName,
  },
] as const;

export const HOME_HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Ingest & Qualify Leads',
    body:
      'Leads arrive via web forms or outreach. AlphaClone instantly creates unified client records, records activity, and assigns follow-up owners.',
    icon: 'setup' as AlphaIconName,
  },
  {
    step: '2',
    title: 'Draft & E-Sign Scope',
    body:
      'Use Bonnie AI to turn discovery notes into customized proposals. Send legally binding agreements with instant e-signatures and audit logging.',
    icon: 'organisation' as AlphaIconName,
  },
  {
    step: '3',
    title: 'Execute & Get Paid',
    body:
      'Signed contracts automatically instantiate project boards. Completed deliverables generate invoices and reconcile your financial P&L.',
    icon: 'growth' as AlphaIconName,
  },
] as const;

export const HOME_OUTCOMES = [
  {
    title: 'Zero Data Copy-Pasting',
    detail:
      'Client details flow naturally from lead capture into contract terms, delivery tasks, and invoice line items.',
    icon: 'connected' as AlphaIconName,
  },
  {
    title: '10+ Hours Saved Weekly',
    detail:
      'Eliminate manual status updates, lost email threads, and chasing client approvals across 5 separate tabs.',
    icon: 'workflow' as AlphaIconName,
  },
  {
    title: '$4,600+ Annual Savings',
    detail:
      'Replace separate subscriptions for CRM, DocuSign, QuickBooks, Harvest, and Zoom with one transparent backbone.',
    icon: 'integrations' as AlphaIconName,
  },
  {
    title: '100% Operational Clarity',
    detail:
      'Monitor deal pipeline, project delivery deadlines, and cash flow in one live executive view.',
    icon: 'reports' as AlphaIconName,
  },
] as const;

export const HOME_FAQ = [
  {
    id: 'difference',
    question: 'How is AlphaClone different from HubSpot or Zoho?',
    answer:
      'Traditional CRMs like HubSpot or Zoho focus primarily on lead tracking and force you to buy third-party tools for contracts, project delivery, invoicing, and video calls. AlphaClone is a single connected operating backbone: when a deal closes in AlphaClone, the e-signed contract automatically instantiates project delivery boards and sets up billing milestones without extra plugins or Zapier hooks.',
  },
  {
    id: 'trial',
    question: 'How does the 14-day free trial work?',
    answer:
      'You get full access to your own private AlphaClone instance for 14 days. You can test real workflows with actual client data—CRM, proposals, project tasks, and invoicing—without entering a credit card.',
  },
  {
    id: 'ai-security',
    question: 'What makes Bonnie AI different from generic ChatGPT?',
    answer:
      'Generic AI chatbots have zero context about your business and live in a separate browser tab. Bonnie AI runs on Model Context Protocol (MCP), meaning it securely reads your workspace data (client notes, deal sizes, contract clauses) and executes real operational tasks—like drafting a proposal or preparing an invoice—with owner approval.',
  },
  {
    id: 'data-import',
    question: 'Can I import my existing client data?',
    answer:
      'Yes. You can import contacts, active projects, and past invoices via CSV or direct API connection within minutes during initial setup.',
  },
  {
    id: 'cancel-terms',
    question: 'Are there long-term contracts or cancellation fees?',
    answer:
      'No. All plans operate on a simple month-to-month or discounted annual basis. You can switch plans or cancel at any time directly from account settings.',
  },
  {
    id: 'security-data',
    question: 'Is my client data private and secure?',
    answer:
      'Yes. Every AlphaClone workspace utilizes isolated data boundaries, role-based access control, end-to-end encryption in transit and at rest, and strict data deletion policies.',
  },
] as const;

/** Approved named testimonials — keep empty until real quotes are cleared for publication. */
export const APPROVED_TESTIMONIALS: Array<{
  quote: string;
  name: string;
  role: string;
  company: string;
}> = [];

export function MidPageCTA() {
  return (
    <div className="mkt-mid-cta">
      <div>
        <h2 className="font-marketing-heading text-xl sm:text-2xl text-white">
          Stop managing disconnected SaaS tools. Experience the connected engine.
        </h2>
        <p className="mt-3 text-[var(--text-secondary)]">
          Start your 14-day free trial today. Run real client workflows—from lead capture to signed contract and paid invoice—in one living system. No credit card required.
        </p>
      </div>
      <div className="mkt-mid-cta-actions">
        <PrimaryCTA className="mkt-btn-large" />
        <SecondaryCTA className="mkt-btn-large" />
      </div>
    </div>
  );
}

export function ExploreFeaturesLink() {
  return (
    <Link href="/ecosystem" className="mkt-btn mkt-btn-secondary mt-6">
      Explore all features
    </Link>
  );
}

