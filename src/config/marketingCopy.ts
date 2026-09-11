export type ComparisonRow = { feature: string; alphaclone: string; competitor: string };

export const HUBSPOT_COMPARISON: ComparisonRow[] = [
  { feature: 'CRM pipeline', alphaclone: 'Included', competitor: 'Sales Hub required' },
  { feature: 'Email campaigns', alphaclone: 'Included', competitor: 'Marketing Hub add-on' },
  { feature: 'Forms', alphaclone: 'Included', competitor: 'Included' },
  { feature: 'Starting price', alphaclone: '$15/mo', competitor: '$20+/mo per seat' },
  { feature: 'Invoicing', alphaclone: 'Native', competitor: 'Third-party only' },
  { feature: 'Video meetings', alphaclone: 'Built-in', competitor: 'Not included' },
];

export const QUICKBOOKS_COMPARISON: ComparisonRow[] = [
  { feature: 'Invoicing', alphaclone: 'Included', competitor: 'Included' },
  { feature: 'CRM', alphaclone: 'Native', competitor: 'Not included' },
  { feature: 'Bank reconciliation', alphaclone: 'Included', competitor: 'Included' },
  { feature: 'Email marketing', alphaclone: 'Included', competitor: 'Not included' },
  { feature: 'Starting price', alphaclone: '$15/mo', competitor: '$30+/mo' },
];

export const SALESFORCE_COMPARISON: ComparisonRow[] = [
  { feature: 'Lead & deal pipeline', alphaclone: 'Included', competitor: 'Sales Cloud' },
  { feature: 'Forecasting', alphaclone: 'Included', competitor: 'Add-on tiers' },
  { feature: 'Per-seat pricing', alphaclone: 'Flat workspace', competitor: '$25+/user/mo' },
  { feature: 'Accounting', alphaclone: 'Native', competitor: 'Not included' },
  { feature: 'Setup complexity', alphaclone: 'Minutes', competitor: 'Weeks' },
];

export const MARKETING_FEATURES = {
  email: {
    title: 'Turn leads into booked calls — without a separate marketing stack',
    description:
      'Run campaigns and nurture sequences from the same CRM where deals live. No Marketing Hub add-on, no context lost when someone replies.',
    bullets: [
      'Send campaigns tied to CRM segments and deal stages',
      'Track opens and clicks next to the contact record',
      'Automate follow-ups when a lead goes quiet',
      'Stay compliant with unsubscribe and suppression controls',
    ],
  },
  automation: {
    title: 'Stop manual handoffs between sales, delivery, and billing',
    description:
      'When a form is submitted or a deal moves stage, the next task, email, or invoice step happens automatically — not in someone\'s head.',
    bullets: [
      'Trigger workflows from form submits and pipeline changes',
      'Launch campaigns and tasks from one visual builder',
      'Reduce duplicate data entry across modules',
      'Keep AI-assisted steps reviewable before they run',
    ],
  },
  forms: {
    title: 'Capture leads that land straight in your pipeline',
    description:
      'Branded forms feed your CRM inbox so new inquiries become follow-up tasks — not spreadsheet rows you forget to import.',
    bullets: [
      'Share public URLs on site, email, and social',
      'Route submissions into CRM with source tracking',
      'Review and qualify from a single inbox',
      'Connect forms to automation and sequences',
    ],
  },
  sequences: {
    title: 'Nurture prospects until they are ready to buy',
    description:
      'Multi-step email sequences with delays that enroll from CRM or automation — so warm leads get consistent follow-up without manual scheduling.',
    bullets: [
      'Build visual timelines with day-based delays',
      'Enroll contacts from pipeline or workflows',
      'See per-step engagement on each record',
      'Hand off replies to sales with full context',
    ],
  },
};
