import Link from 'next/link';
import type { AlphaIconName } from '@/components/marketing/icons';
import { PrimaryCTA, SecondaryCTA } from './CtaButtons';

export const HOME_TRUST_NOTES = [
  { label: 'No credit card required', icon: 'trust-card' as AlphaIconName },
  { label: 'Set up in under 10 minutes', icon: 'trust-clock' as AlphaIconName },
  { label: 'Cancel anytime', icon: 'trust-cancel' as AlphaIconName },
  { label: 'Secure by design', icon: 'trust-secure' as AlphaIconName },
] as const;

export const HOME_PLATFORM_FEATURES = [
  {
    name: 'CRM',
    body:
      'Keep every lead, client, and conversation on one living record so your team always knows who to follow up with next — without jumping between spreadsheets and inboxes.',
    href: '/crm',
    icon: 'crm' as AlphaIconName,
  },
  {
    name: 'Invoicing',
    body:
      'Create branded invoices from the same workspace that holds the project and contract, then track send status and payment progress without a separate billing tool.',
    href: '/docs#financials',
    icon: 'invoicing' as AlphaIconName,
  },
  {
    name: 'Projects',
    body:
      'Plan delivery with tasks, owners, and milestones tied to the client record, so progress stays visible and handoffs stop disappearing into chat threads.',
    href: '/project-management',
    icon: 'projects' as AlphaIconName,
  },
  {
    name: 'Documents',
    body:
      'Store proposals, contracts, and approvals beside the related work so everyone reviews the right version and nothing critical lives only in email attachments.',
    href: '/docs',
    icon: 'documents' as AlphaIconName,
  },
  {
    name: 'Bonnie AI',
    body:
      'Ask for drafts, summaries, and next actions that already know your clients and projects — practical assistance grounded in your workspace, not a detached chatbot.',
    href: '/ai-agents',
    icon: 'bonnie' as AlphaIconName,
  },
  {
    name: 'Connected operations',
    body:
      'Bring calendar, reporting, marketing workflows, and integrations into the same operating layer so daily work stays coordinated instead of scattered across apps.',
    href: '/ecosystem',
    icon: 'connected' as AlphaIconName,
  },
] as const;

export const HOME_HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Set up your workspace',
    body:
      'Create your account, choose how your service business runs, and configure the modules you need first — usually CRM, projects, and invoicing.',
    icon: 'setup' as AlphaIconName,
  },
  {
    step: '2',
    title: 'Bring your work together',
    body:
      'Add clients, active projects, invoices, and documents into one shared workspace so every follow-up starts from the same source of truth.',
    icon: 'organisation' as AlphaIconName,
  },
  {
    step: '3',
    title: 'Run and grow',
    body:
      'Use connected views and Bonnie AI to spot what needs attention, close loops faster, and grow delivery without adding another tool for every task.',
    icon: 'growth' as AlphaIconName,
  },
] as const;

export const HOME_OUTCOMES = [
  {
    title: 'One connected workspace',
    detail:
      'Clients, projects, invoices, and documents stay linked on a single operating record instead of living in separate apps.',
    icon: 'connected' as AlphaIconName,
  },
  {
    title: 'Faster daily operations',
    detail:
      'Fewer handoffs and less re-entry between tools means your team spends more time delivering work and less time chasing context.',
    icon: 'workflow' as AlphaIconName,
  },
  {
    title: 'Fewer disconnected tools',
    detail:
      'Replace a patchwork of CRM, billing, and file tools with one backbone built for service businesses.',
    icon: 'integrations' as AlphaIconName,
  },
  {
    title: 'Clearer business visibility',
    detail:
      'See pipeline, delivery, and billing status without tab-switching, so decisions are based on what is actually in progress.',
    icon: 'reports' as AlphaIconName,
  },
] as const;

export const HOME_FAQ = [
  {
    id: 'trial',
    question: 'Is there a free trial?',
    answer:
      'Yes. New business workspaces can start a 14-day free trial so you can run a real client workflow — CRM, projects, invoicing, and documents — before paying.',
  },
  {
    id: 'card',
    question: 'Is a credit card required?',
    answer:
      'No. You can start the trial without entering a card, explore the workspace with your own workflow, and only add billing when you decide to continue.',
  },
  {
    id: 'cancel',
    question: 'Can I cancel at any time?',
    answer:
      'Yes. You can cancel from account billing controls whenever you need to. You keep access through the current paid period according to your plan terms.',
  },
  {
    id: 'change-plans',
    question: 'Can I change plans later?',
    answer:
      'Yes. Upgrade or change plans from billing when your workspace needs grow — seat counts, modules, and limits are listed on the pricing page so you can switch without restarting setup.',
  },
  {
    id: 'data',
    question: 'How is my data protected?',
    answer:
      'Workspaces use account controls, role-based access, and published privacy, security, and data-deletion policies. See the security policy for current practices and how workspace data is handled.',
  },
  {
    id: 'onboarding',
    question: 'Is onboarding support included?',
    answer:
      'Self-serve setup is available for all plans, with guided prompts for the first modules you enable. Enterprise includes dedicated onboarding, and you can also book a demo for a live walkthrough.',
  },
  {
    id: 'import',
    question: 'Can I import existing business data?',
    answer:
      'You can bring contacts and related records into the workspace during setup so you are not starting from a blank slate. Book a demo if you need help mapping a larger migration.',
  },
  {
    id: 'integrations',
    question: 'Which integrations are supported?',
    answer:
      'AlphaClone connects with tools such as Stripe, HubSpot, Slack, Google, Microsoft 365, Zoom, and Calendly. See the ecosystem page for the current list and how each connection fits into the workspace.',
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
          Ready to run your business from one workspace?
        </h2>
        <p className="mt-3 text-[var(--text-secondary)]">
          Start your 14-day trial with the modules your service business needs most. No credit card
          required — explore CRM, projects, invoicing, and Bonnie AI in one connected operating layer.
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
