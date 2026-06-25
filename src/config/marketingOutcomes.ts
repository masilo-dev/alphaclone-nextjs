/** Single source of truth for outcome-led marketing copy. */

export const OUTCOME_PROMISE = {
  badge: 'For service businesses & agencies',
  headline: 'Stop losing clients and revenue',
  headlineAccent: 'between your tools.',
  subhead:
    'AlphaClone connects leads, delivery, contracts, and billing in one workspace — so you follow up faster, deliver with context, and get paid without chasing five apps.',
  icp: 'Built for consultants, agencies, and solo founders who are tired of tab-switching—not learning another platform.',
} as const;

export const OUTCOME_HERO_BULLETS = [
  'Win clients: leads, follow-ups, and pipeline in one place',
  'Get paid: quotes, contracts, and invoices tied to each client',
  'Deliver calm: projects, tasks, and meetings share the same record',
] as const;

export const OUTCOME_TRUST_POINTS = [
  '14-day trial · no card required',
  'GDPR-friendly email & data controls',
  'Live demo with a real workspace',
] as const;

export const OUTCOME_PROOF_STATS = [
  { value: '1', label: 'client record', detail: 'from first lead to paid invoice' },
  { value: '5+', label: 'tools replaced', detail: 'typical CRM + billing + contracts stack' },
  { value: '14', label: 'days to test', detail: 'full workflow before you pay' },
  { value: '$0', label: 'card to start', detail: 'cancel anytime' },
] as const;

export const BEFORE_AFTER_WORKFLOWS = [
  {
    before: 'Lead lives in Gmail. Deal in a spreadsheet. Invoice in another app.',
    after: 'One client record from first email through signed contract to payment.',
  },
  {
    before: 'Five subscriptions, five logins, context lost every handoff.',
    after: 'One workspace your team actually shares — sales, delivery, and finance aligned.',
  },
  {
    before: '"I\'ll follow up tomorrow" — then the thread goes cold.',
    after: 'Tasks and reminders tied to deal stage so nothing slips after the call.',
  },
] as const;

export type OutcomeCaseStudy = {
  id: string;
  persona: string;
  industry: string;
  stackReplaced: string;
  problem: string;
  whatChanged: string;
  outcome: string;
  modulesUsed: string[];
  /** true = illustrative until a named customer approves publication */
  representative: boolean;
};

export const OUTCOME_CASE_STUDIES: OutcomeCaseStudy[] = [
  {
    id: 'solo-consultant',
    persona: 'Solo consultant',
    industry: 'Professional services',
    stackReplaced: 'HubSpot + QuickBooks + Calendly',
    problem:
      'Every new client meant three logins, duplicate contact entry, and invoices disconnected from the deal that created them.',
    whatChanged:
      'Moved intake, booking, pipeline, and invoicing into one workspace. Each client has one record from first call to payment.',
    outcome:
      'One login for leads, invoices, and booking — without three subscriptions or copy-pasting between tabs.',
    modulesUsed: ['CRM', 'Invoicing', 'Scheduling', 'Contracts'],
    representative: true,
  },
  {
    id: 'creative-agency',
    persona: 'Creative agency (8 people)',
    industry: 'Marketing & design',
    stackReplaced: 'Monday + FreshBooks + Mailchimp',
    problem:
      'Campaign work lived in one tool, client billing in another, and sales follow-up in a third. Project managers could not see pipeline or overdue invoices.',
    whatChanged:
      'Pipeline, project tasks, and campaign sends share client context. Finance sees what was sold before work starts.',
    outcome:
      'Pipeline and campaigns in the same place project tasks live — handoffs stop killing margin.',
    modulesUsed: ['CRM', 'Projects', 'Email campaigns', 'Invoicing'],
    representative: true,
  },
  {
    id: 'boutique-consultancy',
    persona: 'Boutique consultancy founder',
    industry: 'B2B advisory',
    stackReplaced: 'Salesforce + Stripe Billing + DocuSign',
    problem:
      'Enterprise CRM setup took weeks. Signed contracts and invoices were not linked to the same deal record.',
    whatChanged:
      'Unified pipeline, contract flow, and billing on one data layer. Setup in days, not a quarter.',
    outcome:
      'Forecast and deal board without enterprise CRM setup — context never lost between sales and delivery.',
    modulesUsed: ['CRM', 'Contracts', 'Invoicing', 'Forecasting'],
    representative: true,
  },
  {
    id: 'field-services',
    persona: 'Field services owner',
    industry: 'On-site services',
    stackReplaced: 'Spreadsheets + separate invoicing app',
    problem:
      'Team on client sites could not see tasks, messages, or billing status without calling the office.',
    whatChanged:
      'Mobile-friendly dashboard for tasks, client messages, and invoice status from one login.',
    outcome:
      'Team stays aligned on site — tasks, messages, and billing visible without a desk back at the office.',
    modulesUsed: ['CRM', 'Tasks', 'Invoicing', 'Mobile dashboard'],
    representative: true,
  },
];

export const PRICING_OUTCOME_HERO = {
  badge: 'Transparent pricing',
  headline: 'Run your whole client business',
  headlineAccent: 'for one monthly price.',
  subhead:
    'No per-seat games. No surprise add-ons. Test your full workflow free for 14 days — then pick the plan that matches your team size.',
} as const;

export const WHO_WE_SERVE_HERO = {
  badge: 'Who it is for',
  headline: 'Built for teams that sell',
  headlineAccent: 'and deliver client work.',
  subhead:
    'If you outgrew spreadsheets and tab-switching between CRM, projects, and billing — Alphaclone is your operating layer, not another point tool.',
} as const;

export type WhoWeServeSegment = {
  id: string;
  title: string;
  icon: 'target' | 'zap' | 'award' | 'trending' | 'shield' | 'video';
  challenge: string;
  outcomes: string[];
  stackReplaced?: string;
  resultsHref?: string;
};

export const WHO_WE_SERVE_SEGMENTS: WhoWeServeSegment[] = [
  {
    id: 'growth-agencies',
    title: 'Growth agencies',
    icon: 'target',
    stackReplaced: 'HubSpot + ClickUp + DocuSign',
    challenge:
      'Client work scattered across CRM, delivery, and billing creates rework — and margin leaks when sales promises do not match what delivery sees.',
    outcomes: [
      'One client record from pitch through signed SOW to invoice',
      'Pipeline value visible next to active project load',
      'Branded client-facing forms and portals tied to CRM',
    ],
    resultsHref: '/results#creative-agency',
  },
  {
    id: 'saas-startups',
    title: 'SaaS & B2B startups',
    icon: 'zap',
    stackReplaced: 'Zoom + PandaDoc + separate CRM',
    challenge:
      'Early teams burn budget on overlapping subscriptions before they have a repeatable sales process.',
    outcomes: [
      'Forecast and deal board without enterprise CRM setup time',
      'Contracts and billing linked to the same deal record',
      'Outreach prep and follow-up tasks without a separate sales stack',
    ],
    resultsHref: '/results#boutique-consultancy',
  },
  {
    id: 'consulting-firms',
    title: 'Consulting firms',
    icon: 'award',
    challenge:
      'Clients expect a polished experience — but enterprise software is overkill and consumer tools look amateur.',
    outcomes: [
      'Professional invoices, contracts, and meetings from one system',
      'Project and task visibility tied to each client engagement',
      'Less admin between calls, deliverables, and payment collection',
    ],
    resultsHref: '/results#boutique-consultancy',
  },
  {
    id: 'emerging-founders',
    title: 'Emerging market founders',
    icon: 'trending',
    challenge:
      'Per-seat enterprise pricing prices out small teams that still need credible client operations.',
    outcomes: [
      'Full client workflow from $15/month — no per-seat escalation on Starter',
      '14-day trial to validate before you commit budget',
      'Same capabilities larger firms pay multiple vendors for',
    ],
  },
  {
    id: 'privacy-first',
    title: 'Privacy-conscious teams',
    icon: 'shield',
    challenge:
      'Sensitive client and financial data needs clear controls — not opaque third-party sprawl.',
    outcomes: [
      'Isolated tenant workspaces with role-based access',
      'Encryption in transit and at rest with audit logging',
      'Public privacy, security, and data-deletion policies',
    ],
  },
  {
    id: 'remote-teams',
    title: 'Remote & field teams',
    icon: 'video',
    challenge:
      'When the team is distributed or on client sites, context lives in chat threads instead of one record.',
    outcomes: [
      'Meetings, tasks, and billing visible from mobile',
      'Start a client call from the CRM record — notes stay attached',
      'Fewer “what is the status?” messages back to the office',
    ],
    resultsHref: '/results#field-services',
  },
];
