import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import SolutionPageTemplate, {
  type SolutionPageContent,
} from '@/components/marketing/system/SolutionPageTemplate';
import { absoluteUrl } from '@/lib/siteUrl';

const content: SolutionPageContent = {
  eyebrow: 'Solution for solo founders',
  title: 'Run client work without building a software stack around yourself',
  description:
    'AlphaClone gives solo founders one place to capture leads, manage follow-up, deliver work, and prepare billing context.',
  problem:
    'Solo founders often become the integration layer between inboxes, spreadsheets, calendars, invoices, and delivery notes. The business can move, but every handoff depends on memory and manual updates.',
  workflowChange:
    'AlphaClone keeps the client journey on one record: the lead becomes a deal, the deal informs delivery, and the work stays visible when it is time to follow up or bill.',
  modules: [
    {
      label: 'Lead management',
      href: '/lead-management',
      description: 'Capture new interest and keep next steps visible before a lead goes cold.',
    },
    {
      label: 'CRM',
      href: '/crm',
      description: 'Track relationships, deal stages, notes, and follow-up from one client record.',
    },
    {
      label: 'Projects',
      href: '/project-management',
      description: 'Turn won work into delivery tasks without recreating the client context.',
    },
  ],
  outcomes: [
    'Less copying between sales notes, task lists, and invoice context.',
    'A clearer view of what each client needs next.',
    'A more credible operating system before hiring operations help.',
  ],
  setup: [
    'Import or enter active leads and current clients.',
    'Create a simple pipeline that matches how you sell today.',
    'Attach delivery tasks to the clients and deals they came from.',
    'Use the trial to run one real lead-to-delivery workflow end to end.',
  ],
  ctaTitle: 'Build your founder operating workspace',
  ctaDescription:
    'Start with one real client workflow and decide if AlphaClone replaces your current patchwork.',
};

export const metadata: Metadata = {
  title: 'AlphaClone for Solo Founders | Client Operations in One Workspace',
  description:
    'A practical AlphaClone workflow for solo founders managing leads, CRM, delivery, and billing context without a scattered software stack.',
  alternates: { canonical: absoluteUrl('/solutions/solo-founders') },
  openGraph: {
    title: 'AlphaClone for Solo Founders',
    description: content.description,
    url: absoluteUrl('/solutions/solo-founders'),
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
};

export default function SoloFoundersSolutionPage() {
  return (
    <MarketingLandingShell>
      <SolutionPageTemplate content={content} />
    </MarketingLandingShell>
  );
}
