/**
 * Marketing product feature registry — shared by product pages and homepage.
 */

export type MarketingProductFeature = {
  slug: string;
  href: string;
  name: string;
  outcome: string;
  icon: 'users' | 'target' | 'check' | 'file' | 'video' | 'receipt' | 'bot' | 'mail' | 'workflow' | 'megaphone';
  screenshot?: {
    src: string;
    alt: string;
  };
  hero: string;
  summary: string;
  workflows: { title: string; body: string }[];
  connections: { label: string; href: string }[];
  audience: string;
};

export const MARKETING_PRODUCT_FEATURES: MarketingProductFeature[] = [
  {
    slug: 'crm',
    href: '/crm',
    name: 'CRM',
    outcome: 'Keep every lead, deal, and follow-up on one client record.',
    icon: 'users',
    screenshot: {
      src: '/screenshots/deals-dashboard.png',
      alt: 'AlphaClone CRM deals dashboard with pipeline stages and deal values (demonstration data)',
    },
    hero: 'CRM that stays connected to delivery and billing',
    summary:
      'AlphaClone CRM links contacts, pipeline stages, tasks, and revenue context so sales handoffs do not start from a blank spreadsheet.',
    workflows: [
      { title: 'Capture a lead', body: 'Log inbound interest with source and next step attached to the person.' },
      { title: 'Record communication', body: 'Keep notes and follow-ups on the same record your team already uses.' },
      { title: 'Convert to a customer', body: 'Move the deal forward without re-entering details into another tool.' },
      { title: 'Link to delivery', body: 'Open a project from the won deal so delivery inherits context.' },
      { title: 'Produce an invoice', body: 'Raise billing from the same client record when work is ready to charge.' },
      { title: 'Review history', body: 'See relationship activity without hunting across inboxes and boards.' },
    ],
    connections: [
      { label: 'Lead management', href: '/lead-management' },
      { label: 'Projects', href: '/project-management' },
      { label: 'Bonnie AI', href: '/ai-agents' },
    ],
    audience: 'Founders and service teams who need pipeline clarity without a separate CRM subscription.',
  },
  {
    slug: 'lead-management',
    href: '/lead-management',
    name: 'Lead management',
    outcome: 'Capture demand and route it into a pipeline your team can act on.',
    icon: 'target',
    screenshot: {
      src: '/screenshots/lead-detail.png',
      alt: 'AlphaClone lead detail view with contact information and status (demonstration data)',
    },
    hero: 'Turn inbound interest into organised follow-up',
    summary:
      'Lead management in AlphaClone is built to feed CRM — not to become another isolated lead database.',
    workflows: [
      { title: 'Capture', body: 'Collect leads from forms, outreach, and manual entry into one queue.' },
      { title: 'Qualify', body: 'Add status, notes, and next actions before the trail goes cold.' },
      { title: 'Hand off', body: 'Promote qualified leads into CRM deals without copy-paste.' },
      { title: 'Follow up', body: 'Keep reminders and ownership visible to the people responsible.' },
    ],
    connections: [
      { label: 'CRM', href: '/crm' },
      { label: 'Forms', href: '/marketing/forms' },
      { label: 'Sequences', href: '/marketing/sequences' },
    ],
    audience: 'Teams who lose leads between inboxes, spreadsheets, and CRM tools.',
  },
  {
    slug: 'project-management',
    href: '/project-management',
    name: 'Projects',
    outcome: 'Deliver client work with owners, milestones, and shared context.',
    icon: 'check',
    screenshot: {
      src: '/screenshots/mobile-crm.png',
      alt: 'AlphaClone mobile project and CRM view (demonstration data)',
    },
    hero: 'Projects tied to the deal that sold them',
    summary:
      'Projects inherit client context from CRM so delivery teams start with what was promised — not a blank board.',
    workflows: [
      { title: 'Open from a deal', body: 'Create delivery work linked to the customer who bought it.' },
      { title: 'Assign ownership', body: 'Set milestones, tasks, and due dates in one place.' },
      { title: 'Share progress', body: 'Give clients a clear view without exporting status reports by hand.' },
      { title: 'Close into billing', body: 'Move completed work toward invoicing without retyping scope.' },
    ],
    connections: [
      { label: 'CRM', href: '/crm' },
      { label: 'Invoicing', href: '/docs#financials' },
      { label: 'Meetings', href: '/video-meetings' },
    ],
    audience: 'Agencies and consultants who juggle delivery across disconnected boards.',
  },
  {
    slug: 'ai-agents',
    href: '/ai-agents',
    name: 'Bonnie AI',
    outcome: 'Automate repeatable admin work with human-visible audit trails.',
    icon: 'bot',
    hero: 'AI assistance that stays inside your operating workflows',
    summary:
      'Bonnie helps draft outreach, summarise activity, and trigger structured tasks — without becoming an opaque black box.',
    workflows: [
      { title: 'Instruct', body: 'Describe the outcome you need in business language.' },
      { title: 'Review', body: 'Inspect proposed actions before they affect clients or billing.' },
      { title: 'Execute', body: 'Apply approved changes to CRM, tasks, or follow-ups.' },
      { title: 'Audit', body: 'Keep a trail of what the assistant changed and why.' },
    ],
    connections: [
      { label: 'CRM', href: '/crm' },
      { label: 'Automation', href: '/marketing/automation' },
      { label: 'Platform overview', href: '/services' },
    ],
    audience: 'Operators who want leverage on admin work without losing control.',
  },
  {
    slug: 'video-meetings',
    href: '/video-meetings',
    name: 'Video meetings',
    outcome: 'Meet clients without losing notes and next steps.',
    icon: 'video',
    hero: 'Meetings attached to the client record',
    summary:
      'Start conversations from the relationship context you already manage — then keep follow-ups in the same workspace.',
    workflows: [
      { title: 'Schedule', body: 'Book meetings against the customer or deal that needs attention.' },
      { title: 'Meet', body: 'Join from the workspace without inventing another tool habit.' },
      { title: 'Capture', body: 'Leave notes and tasks where your team will find them later.' },
    ],
    connections: [
      { label: 'CRM', href: '/crm' },
      { label: 'Projects', href: '/project-management' },
      { label: 'Calendar docs', href: '/docs' },
    ],
    audience: 'Service teams who meet clients often and lose context after the call.',
  },
];

export const HOMEPAGE_PLATFORM_FEATURES = [
  {
    name: 'CRM',
    href: '/crm',
    outcome: 'Pipeline, contacts, and follow-up on one record',
    icon: 'users' as const,
  },
  {
    name: 'Invoicing',
    href: '/docs#financials',
    outcome: 'Quotes and invoices linked to the client who owes them',
    icon: 'receipt' as const,
  },
  {
    name: 'Projects',
    href: '/project-management',
    outcome: 'Delivery work tied to the deal that sold it',
    icon: 'check' as const,
  },
  {
    name: 'Documents',
    href: '/docs#contracts',
    outcome: 'Contracts and files with a clear signing path',
    icon: 'file' as const,
  },
  {
    name: 'Marketing',
    href: '/marketing/email',
    outcome: 'Campaigns and forms that feed the same CRM',
    icon: 'mail' as const,
  },
  {
    name: 'Bonnie AI',
    href: '/ai-agents',
    outcome: 'Assistive automation with reviewable actions',
    icon: 'bot' as const,
  },
];

export const HOMEPAGE_FAQ = [
  {
    question: 'Is there a free trial?',
    answer:
      'Yes. New business workspaces can start a 14-day free trial so you can run a real client workflow before paying.',
  },
  {
    question: 'Is a credit card required?',
    answer: 'No. You can start the trial without entering a card.',
  },
  {
    question: 'Can I cancel?',
    answer: 'Yes. You can cancel from account billing controls. You keep access through the current paid period according to your plan terms.',
  },
  {
    question: 'Can I change plans?',
    answer: 'Yes. Upgrade or change plans from billing when your workspace needs grow. Pricing details are listed on the pricing page.',
  },
  {
    question: 'Is onboarding available?',
    answer: 'Self-serve setup is available for all plans. Enterprise includes dedicated onboarding. You can also book a demo for a live walkthrough.',
  },
  {
    question: 'How is my data protected?',
    answer:
      'Workspaces use account controls, role-based access, and published privacy, security, and data-deletion policies. See the security policy for current practices.',
  },
];
