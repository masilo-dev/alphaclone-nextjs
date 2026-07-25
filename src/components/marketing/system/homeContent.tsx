import {
  Bot,
  CalendarDays,
  FileText,
  FolderKanban,
  Layers,
  Receipt,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { PrimaryCTA, SecondaryCTA } from './CtaButtons';

export const HOME_TRUST_NOTES = [
  'No credit card required',
  'Set up in under 10 minutes',
  'Cancel anytime',
  'Secure by design',
] as const;

export const HOME_PLATFORM_FEATURES = [
  {
    name: 'CRM',
    body: 'Manage leads, clients, conversations and relationships.',
    href: '/crm',
    icon: Users,
  },
  {
    name: 'Invoicing',
    body: 'Create, send and track professional invoices.',
    href: '/docs#financials',
    icon: Receipt,
  },
  {
    name: 'Projects',
    body: 'Plan work, assign tasks and keep delivery moving.',
    href: '/project-management',
    icon: FolderKanban,
  },
  {
    name: 'Documents',
    body: 'Store, organise, share and approve important files.',
    href: '/docs',
    icon: FileText,
  },
  {
    name: 'Bonnie AI',
    body: 'Get context-aware assistance across your work.',
    href: '/ai-agents',
    icon: Bot,
  },
  {
    name: 'Connected operations',
    body: 'Bring calendar, reports, marketing and workflows together.',
    href: '/ecosystem',
    icon: Layers,
  },
] as const;

export const HOME_HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Set up your workspace',
    body: 'Create your account and configure the way your business operates.',
    icon: CalendarDays,
  },
  {
    step: '2',
    title: 'Bring your work together',
    body: 'Add clients, projects, invoices, documents and communication.',
    icon: FolderKanban,
  },
  {
    step: '3',
    title: 'Run and grow',
    body: 'Use connected insights and AI assistance to move work forward.',
    icon: Bot,
  },
] as const;

export const HOME_OUTCOMES = [
  { title: 'One connected workspace', detail: 'Clients, projects and invoices on one record' },
  { title: 'Faster daily operations', detail: 'Fewer handoffs between tools and teams' },
  { title: 'Fewer disconnected tools', detail: 'Replace a patchwork CRM + billing stack' },
  { title: 'Clearer business visibility', detail: 'See what needs attention without tab-switching' },
] as const;

export const HOME_FAQ = [
  {
    id: 'trial',
    question: 'Is there a free trial?',
    answer:
      'Yes. New business workspaces can start a 14-day free trial so you can run a real client workflow before paying.',
  },
  {
    id: 'card',
    question: 'Is a credit card required?',
    answer: 'No. You can start the trial without entering a card.',
  },
  {
    id: 'cancel',
    question: 'Can I cancel at any time?',
    answer:
      'Yes. You can cancel from account billing controls. You keep access through the current paid period according to your plan terms.',
  },
  {
    id: 'change-plans',
    question: 'Can I change plans later?',
    answer:
      'Yes. Upgrade or change plans from billing when your workspace needs grow. Pricing details are listed on the pricing page.',
  },
  {
    id: 'data',
    question: 'How is my data protected?',
    answer:
      'Workspaces use account controls, role-based access, and published privacy, security, and data-deletion policies. See the security policy for current practices.',
  },
  {
    id: 'onboarding',
    question: 'Is onboarding support included?',
    answer:
      'Self-serve setup is available for all plans. Enterprise includes dedicated onboarding. You can also book a demo for a live walkthrough.',
  },
  {
    id: 'import',
    question: 'Can I import existing business data?',
    answer:
      'You can bring contacts and related records into the workspace during setup. Book a demo if you need help mapping a larger migration.',
  },
  {
    id: 'integrations',
    question: 'Which integrations are supported?',
    answer:
      'AlphaClone connects with tools such as Stripe, HubSpot, Slack, Google, Microsoft 365, Zoom and Calendly. See the ecosystem page for the current list.',
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
          Start your 14-day trial. No credit card required.
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
