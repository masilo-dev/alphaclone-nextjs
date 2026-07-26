import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import SolutionPageTemplate, {
  type SolutionPageContent,
} from '@/components/marketing/system/SolutionPageTemplate';
import { absoluteUrl } from '@/lib/siteUrl';

const content: SolutionPageContent = {
  eyebrow: 'Solution for agencies',
  title: 'Connect agency pipeline, campaign work, and delivery handoffs',
  description:
    'AlphaClone helps agencies keep sales context, project work, and marketing follow-up in one operating workspace.',
  problem:
    'Agency teams often sell in one system, deliver in another, and manage client communication somewhere else. That separation makes promises, ownership, and billing context harder to trace.',
  workflowChange:
    'AlphaClone keeps prospects, clients, tasks, meetings, and campaign activity connected so account leads and delivery teams can work from the same source of context.',
  modules: [
    {
      label: 'CRM',
      href: '/crm',
      description: 'Keep client relationships, pipeline, and handoff notes available to the team.',
    },
    {
      label: 'Projects',
      href: '/project-management',
      description: 'Organise client delivery work around the deal and client record that created it.',
    },
    {
      label: 'Email marketing',
      href: '/marketing/email',
      description: 'Run campaigns and follow-up tied to CRM segments and deal stages.',
    },
  ],
  outcomes: [
    'Sales promises are easier for delivery teams to inspect.',
    'Client work and account context stay closer together.',
    'Follow-up can happen from the same records used to manage active work.',
  ],
  setup: [
    'Map your current pipeline and active client projects.',
    'Connect campaign or form sources to the lead and CRM workflow.',
    'Create delivery milestones for the services your team repeats most often.',
    'Review one client handoff from pitch through active delivery.',
  ],
  ctaTitle: 'Give your agency one client operations layer',
  ctaDescription:
    'Use the trial to test how pipeline, delivery, and follow-up work together for one active client.',
};

export const metadata: Metadata = {
  title: 'AlphaClone for Agencies | Pipeline, Projects, and Follow-Up',
  description:
    'A practical AlphaClone workflow for agencies that need CRM, project delivery, client meetings, and marketing follow-up in one workspace.',
  alternates: { canonical: absoluteUrl('/solutions/agencies') },
  openGraph: {
    title: 'AlphaClone for Agencies',
    description: content.description,
    url: absoluteUrl('/solutions/agencies'),
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
};

export default function AgenciesSolutionPage() {
  return (
    <MarketingLandingShell>
      <SolutionPageTemplate content={content} />
    </MarketingLandingShell>
  );
}
