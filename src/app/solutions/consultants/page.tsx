import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import SolutionPageTemplate, {
  type SolutionPageContent,
} from '@/components/marketing/system/SolutionPageTemplate';
import { absoluteUrl } from '@/lib/siteUrl';

const content: SolutionPageContent = {
  eyebrow: 'Solution for consultants',
  title: 'Keep advisory relationships, meetings, and engagements organised',
  description:
    'AlphaClone gives consultants a connected workspace for relationship context, meeting follow-up, and engagement delivery.',
  problem:
    'Consultants need polished client operations, but enterprise CRM and project systems can add more setup than value. Notes, meetings, proposals, and delivery tasks can drift across separate tools.',
  workflowChange:
    'AlphaClone links contacts, meetings, follow-ups, and engagement tasks so consultants can move from conversation to delivery with less administrative reconstruction.',
  modules: [
    {
      label: 'CRM',
      href: '/crm',
      description: 'Track relationship history, follow-up, and deal context for each client.',
    },
    {
      label: 'Video meetings',
      href: '/video-meetings',
      description: 'Keep client calls attached to the relationship and the work that follows.',
    },
    {
      label: 'Bonnie AI',
      href: '/ai-agents',
      description: 'Draft and review repeatable admin steps without hiding the audit trail.',
    },
  ],
  outcomes: [
    'Meeting follow-up is easier to find after the call.',
    'Engagement context stays connected to the relationship history.',
    'Admin tasks can be reviewed before they affect clients or billing.',
  ],
  setup: [
    'Add current prospects, clients, and active engagements.',
    'Create relationship stages that match your advisory process.',
    'Attach meeting notes and tasks to the relevant client records.',
    'Use Bonnie AI for draft support on repeatable follow-up steps.',
  ],
  ctaTitle: 'Create a consultant workspace that keeps context close',
  ctaDescription:
    'Start a trial or book a walkthrough to see how AlphaClone supports client advisory workflows.',
};

export const metadata: Metadata = {
  title: 'AlphaClone for Consultants | CRM, Meetings, and Engagement Delivery',
  description:
    'A practical AlphaClone workflow for consultants managing client relationships, meetings, engagement tasks, and reviewable admin support.',
  alternates: { canonical: absoluteUrl('/solutions/consultants') },
  openGraph: {
    title: 'AlphaClone for Consultants',
    description: content.description,
    url: absoluteUrl('/solutions/consultants'),
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
};

export default function ConsultantsSolutionPage() {
  return (
    <MarketingLandingShell>
      <SolutionPageTemplate content={content} />
    </MarketingLandingShell>
  );
}
