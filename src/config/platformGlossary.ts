export interface GlossaryEntry {
  term: string;
  plainLanguage: string;
  whereToFind: string;
}

export interface PlatformHelpSection {
  id: string;
  title: string;
  description?: string;
  entries: GlossaryEntry[];
}

export const PLATFORM_HELP_SECTIONS: PlatformHelpSection[] = [
  {
    id: 'navigation',
    title: 'How the platform is organized',
    description:
      'AlphaClone groups your work into hubs. Overview pages show charts and KPIs (read-only). Workspace pages are where you add, edit, and send.',
    entries: [
      {
        term: 'Workspace home',
        plainLanguage: 'Your main dashboard with cross-module performance snapshots.',
        whereToFind: 'Sidebar → Workspace home, or /dashboard',
      },
      {
        term: 'Overview vs workspace',
        plainLanguage:
          'Overview = read-only charts. Workspace = do the work (create deals, send invoices, edit contacts).',
        whereToFind: 'e.g. CRM Overview vs CRM Workspace in Sales Hub',
      },
      {
        term: 'Sales / Marketing / Money / Insights / Documents hubs',
        plainLanguage: 'Topic groupings that bundle related tools under one area.',
        whereToFind: 'Left sidebar hub sections',
      },
      {
        term: 'Channels',
        plainLanguage: 'Inboxes and messaging across email, tickets, WhatsApp, and social networks.',
        whereToFind: 'Sidebar → Channels',
      },
    ],
  },
  {
    id: 'crm',
    title: 'CRM & sales',
    entries: [
      {
        term: 'CRM Workspace',
        plainLanguage: 'Where you manage leads, contacts, and pipeline actions in one place.',
        whereToFind: 'Sales Hub → CRM Workspace',
      },
      {
        term: 'Leads Board',
        plainLanguage: 'Incoming prospects before they become paying clients.',
        whereToFind: 'Sales Hub → Leads Board',
      },
      {
        term: 'Lead Finder',
        plainLanguage: 'Automated prospecting campaigns that discover and enrich new leads.',
        whereToFind: 'Sales Hub → Lead Finder',
      },
      {
        term: 'Deals Pipeline',
        plainLanguage: 'Track opportunities from first contact through closed-won.',
        whereToFind: 'Sales Hub → Deals Pipeline',
      },
      {
        term: 'Outreach',
        plainLanguage: 'Send personalized emails and sequences to prospects.',
        whereToFind: 'Sales Hub → Outreach',
      },
      {
        term: 'Lead Ingestion',
        plainLanguage: 'Import leads from files, forms, or external sources.',
        whereToFind: 'Sales Hub → Lead Ingestion',
      },
    ],
  },
  {
    id: 'money',
    title: 'Billing & finance',
    entries: [
      {
        term: 'Billing',
        plainLanguage: 'Overview of invoicing activity and revenue snapshots.',
        whereToFind: 'Money Hub → Billing',
      },
      {
        term: 'Invoices',
        plainLanguage: 'Create, send, and manage customer invoices.',
        whereToFind: 'Money Hub → Invoices',
      },
      {
        term: 'Accounting',
        plainLanguage: 'Chart of accounts, journal entries, and financial records.',
        whereToFind: 'Money Hub → Accounting',
      },
    ],
  },
  {
    id: 'extensions',
    title: 'Goals, jobs & extensions',
    entries: [
      {
        term: 'Goals & Targets',
        plainLanguage: 'Track revenue and activity targets across your team.',
        whereToFind: 'Sales Hub → Goals & Targets',
      },
      {
        term: 'Annual Planning',
        plainLanguage: 'Quarterly and annual planning rollups.',
        whereToFind: 'Sales Hub → Annual Planning',
      },
      {
        term: 'Jobs & Queue',
        plainLanguage: 'Background automation runs, lead searches, and queued work.',
        whereToFind: 'Sales Hub → Jobs & Queue',
      },
      {
        term: 'Webhooks',
        plainLanguage: 'Outbound HTTP notifications when events occur in your workspace.',
        whereToFind: 'Sales Hub → Webhooks',
      },
      {
        term: 'Notifications',
        plainLanguage: 'In-app alerts for tickets, forms, and team activity.',
        whereToFind: 'Workspace → Notifications',
      },
      {
        term: 'Vendors',
        plainLanguage: 'Supplier and vendor records for bills and procurement.',
        whereToFind: 'Money Hub → Vendors',
      },
      {
        term: 'Platform guide',
        plainLanguage: 'Searchable glossary of hub names and where to find each tool.',
        whereToFind: 'Workspace → Platform guide, or /dashboard/help',
      },
    ],
  },
  {
    id: 'support',
    title: 'Support & communication',
    entries: [
      {
        term: 'Deep-Desk',
        plainLanguage: 'Your help desk for customer support tickets.',
        whereToFind: 'Channels → Deep-Desk Tickets',
      },
      {
        term: 'Mail',
        plainLanguage: 'Connected email inbox for reading and replying to messages.',
        whereToFind: 'Channels or Marketing Hub → Mail',
      },
      {
        term: 'Bonnie AI',
        plainLanguage:
          'Your in-platform assistant — ask in plain language to look up data, draft outreach, or run workflows.',
        whereToFind: 'Sidebar → Bonnie AI, corner widget, or module dock on some pages',
      },
    ],
  },
  {
    id: 'creative',
    title: 'Marketing & content',
    entries: [
      {
        term: 'AI Studio',
        plainLanguage: 'Generate marketing copy, images, and creative assets with AI.',
        whereToFind: 'Resources → AI Studio (client) or admin Creative tools',
      },
      {
        term: 'Email Campaigns',
        plainLanguage: 'Broadcast emails to segments or your full list.',
        whereToFind: 'Marketing Hub → Email Campaigns',
      },
      {
        term: 'Social Command Center',
        plainLanguage: 'Plan and publish posts across social channels.',
        whereToFind: 'Marketing Hub → Social Command Center',
      },
    ],
  },
];

export const PLATFORM_HELP_INTRO =
  'Use this guide to learn what each area does and where to go. Ask Bonnie “explain [feature]” for contextual help on the page you are on.';
