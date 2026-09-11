export type FaqItem = {
  question: string;
  answer: string;
};

/** Buyer-focused: outcomes, fit, trust, and workflow change */
export const FAQ_BUYER_ITEMS: FaqItem[] = [
  {
    question: 'What business problem does Alphaclone solve?',
    answer:
      'Most service teams lose time and revenue in the gaps between CRM, email, projects, contracts, and billing. Alphaclone connects those workflows on one client record so follow-ups, delivery, and invoices stay aligned.',
  },
  {
    question: 'Who is Alphaclone built for?',
    answer:
      'Consultants, agencies, and solo founders who sell and deliver client work — and who are tired of copying the same details across five different apps.',
  },
  {
    question: 'Is Alphaclone a good fit for a one-person business?',
    answer:
      'Yes. Solo operators get pipeline, contracts, invoicing, scheduling, and follow-up in one login — without paying for separate CRM, billing, and meeting tools.',
  },
  {
    question: 'What changes after I switch from a scattered tool stack?',
    answer:
      'You stop re-entering client data, losing context between sales and delivery, and chasing invoices in a separate app. Leads, tasks, contracts, and payments tie to the same record.',
  },
  {
    question: 'Do I need to be technical or know AI to use it?',
    answer:
      'No. If you can use email and a dashboard, you can run Alphaclone. AI assists with drafts and repetitive steps — you review and approve before anything client-facing goes out.',
  },
  {
    question: 'Can I try it before paying?',
    answer:
      'Yes. Every plan includes a 14-day free trial with no credit card required. Run a real lead-to-invoice workflow, then decide.',
  },
  {
    question: 'How quickly can I get set up?',
    answer:
      'Most teams connect basics and import contacts in under an hour. There is no multi-week implementation project — you work in a live workspace from day one.',
  },
  {
    question: 'Will my data be secure?',
    answer:
      'Alphaclone uses tenant isolation between workspaces, encryption in transit and at rest, role-based access, and audit logging. Public privacy and security policies explain data handling and deletion.',
  },
  {
    question: 'What happens to my data if I cancel?',
    answer:
      'You can export records during your account lifecycle. After cancellation, data is retained for 90 days so you can export or reactivate, then removed per policy.',
  },
  {
    question: 'Can agencies run separate client workspaces?',
    answer:
      'Yes. Each business workspace is isolated with its own CRM, billing, and marketing data — suitable for agencies managing distinct client operations.',
  },
  {
    question: 'Where can I read workflow stories by team type?',
    answer:
      'Visit /results for representative before-and-after stories — consultants, agencies, and founders replacing fragmented SaaS stacks.',
  },
];

/** Product-focused: features, integrations, and competitor comparisons (SEO + evaluators) */
export const FAQ_PRODUCT_ITEMS: FaqItem[] = [
  {
    question: 'What tools does Alphaclone replace?',
    answer:
      'Common stacks include CRM (HubSpot/Salesforce), invoicing (QuickBooks/FreshBooks), contracts (DocuSign), scheduling (Calendly), and email marketing tools — consolidated into one workspace from $15/month.',
  },
  {
    question: 'How is Alphaclone different from HubSpot or QuickBooks?',
    answer:
      'HubSpot and QuickBooks each cover one job. Alphaclone connects CRM, finance, contracts, meetings, and outreach so those jobs share the same client data.',
  },
  {
    question: 'How does Alphaclone compare with HubSpot for small businesses?',
    answer:
      'Alphaclone includes CRM, pipeline, campaigns, forms, and workflows without Marketing Hub add-ons — alongside invoicing, contracts, and meetings in the same product.',
  },
  {
    question: 'Does Alphaclone replace QuickBooks?',
    answer:
      'Alphaclone includes invoicing, expenses, chart of accounts, journal entries, P&L, balance sheet, bank reconciliation UI, and bills payable. Confirm tax and accounting requirements with your advisor before replacing dedicated accounting software.',
  },
  {
    question: 'How does pricing compare to Salesforce?',
    answer:
      'Salesforce often costs $25+ per user per month. Alphaclone starts at $15/month for the full workspace — flat pricing, not per-seat enterprise tiers.',
  },
  {
    question: 'Can I sync HubSpot contacts into Alphaclone?',
    answer:
      'Yes. Connect HubSpot via OAuth to sync contacts and deals. Native campaigns, forms, and workflows can replace Marketing Hub for many teams.',
  },
  {
    question: 'Does Alphaclone include email marketing?',
    answer:
      'Yes. Build campaigns, segments, and sequences with open/click tracking. Advanced automation limits vary by plan — see pricing for Pro and Enterprise.',
  },
  {
    question: 'What email providers are supported?',
    answer: 'Resend, Brevo, SendGrid, Gmail, Zoho Mail, and Outlook. Connect your own sender for tenant-branded email.',
  },
  {
    question: 'Can I manage deals and leads in a pipeline view?',
    answer:
      'Yes. Kanban boards for leads and deals, forecast views, tasks, quotes, and a unified sales console are built in.',
  },
  {
    question: 'Does Alphaclone support double-entry accounting?',
    answer:
      'Yes. Chart of accounts, journal entries, trial balance, P&L, balance sheet, and cash flow statement views are included.',
  },
  {
    question: 'How does GDPR and unsubscribe compliance work?',
    answer:
      'Campaigns include unsubscribe links and suppression lists. The deliverability panel tracks bounces and opt-outs per workspace.',
  },
  {
    question: 'What social platforms can I schedule posts to?',
    answer: 'LinkedIn, Facebook, Instagram, and X (Twitter) from a unified social command center.',
  },
  {
    question: 'Does Alphaclone have video meetings?',
    answer: 'Yes. Built-in video meetings, booking links, calendar, and Microsoft Teams integration are included.',
  },
  {
    question: 'What is the AI sales agent?',
    answer:
      'An assistant for prospect research, outreach drafts, and follow-up tracking — designed to reduce admin, not replace your judgment on client relationships.',
  },
  {
    question: 'Can I create branded client forms?',
    answer: 'Yes. Build forms in the dashboard and share public URLs. Submissions flow into your CRM inbox.',
  },
  {
    question: 'How do email sequences work?',
    answer:
      'Create multi-step sequences with day delays. Enroll contacts manually or from automation workflows.',
  },
  {
    question: 'Is bank reconciliation supported?',
    answer:
      'Yes. Banking center supports account views, reconciliation sessions, and statement period tracking.',
  },
  {
    question: 'What reports are available?',
    answer:
      'Revenue analytics, CRM pipeline reports, campaign performance, P&L, balance sheet, trial balance, and executive KPI dashboards.',
  },
  {
    question: 'Can I export financial reports?',
    answer: 'P&L and balance sheet PDF export from the accounting hub. Revenue reports export to PDF and CSV.',
  },
  {
    question: 'Does Alphaclone work on mobile?',
    answer: 'Yes. The dashboard is PWA-ready with mobile navigation and responsive layouts.',
  },
  {
    question: 'What integrations are available?',
    answer:
      'HubSpot, Zoho CRM and Mail, Stripe, Microsoft 365, Google, Facebook, LinkedIn, Twilio, Calendly, and MCP for AI agents.',
  },
];

/** All items — used for FAQPage JSON-LD */
export const FAQ_ITEMS: FaqItem[] = [...FAQ_BUYER_ITEMS, ...FAQ_PRODUCT_ITEMS];
