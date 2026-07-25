import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Briefcase,
  Building2,
  Calendar,
  CheckSquare,
  FileText,
  HelpCircle,
  Layers,
  Mail,
  Megaphone,
  Newspaper,
  Receipt,
  Sparkles,
  Target,
  Users,
  Video,
  BookOpen,
  Shield,
  Workflow,
} from 'lucide-react';
import {
  BUSINESS_SIGNUP_HREF,
  CTA_LABELS,
  DEMO_HREF,
  LOGIN_HREF,
  TRIAL_HREF,
} from './cta';

export type MarketingNavLink = {
  label: string;
  path: string;
  description?: string;
  icon?: LucideIcon;
};

export type MarketingNavGroup = {
  label: string;
  items: MarketingNavLink[];
};

export {
  BUSINESS_SIGNUP_HREF,
  CTA_LABELS,
  DEMO_HREF,
  LOGIN_HREF,
  TRIAL_HREF,
};

/** Top-level desktop links (non-dropdown). */
export const MARKETING_PRIMARY_LINKS: MarketingNavLink[] = [
  { label: 'Pricing', path: '/pricing' },
];

/** Product — grouped by business job */
export const PRODUCT_NAV_GROUPS: MarketingNavGroup[] = [
  {
    label: 'Manage customers',
    items: [
      {
        label: 'CRM & pipeline',
        path: '/crm',
        description: 'Contacts, deals, and follow-up in one record',
        icon: Users,
      },
      {
        label: 'Lead management',
        path: '/lead-management',
        description: 'Capture and qualify inbound demand',
        icon: Target,
      },
    ],
  },
  {
    label: 'Deliver work',
    items: [
      {
        label: 'Projects & tasks',
        path: '/project-management',
        description: 'Milestones, owners, and client visibility',
        icon: CheckSquare,
      },
      {
        label: 'Documents & contracts',
        path: '/docs#contracts',
        description: 'Templates, versions, and e-sign',
        icon: FileText,
      },
      {
        label: 'Video meetings',
        path: '/video-meetings',
        description: 'Meetings tied to the client record',
        icon: Video,
      },
    ],
  },
  {
    label: 'Get paid',
    items: [
      {
        label: 'Invoicing & billing',
        path: '/docs#financials',
        description: 'Quotes, invoices, and payment status',
        icon: Receipt,
      },
    ],
  },
  {
    label: 'Grow the business',
    items: [
      {
        label: 'Email marketing',
        path: '/marketing/email',
        description: 'Campaigns connected to CRM',
        icon: Mail,
      },
      {
        label: 'Automation',
        path: '/marketing/automation',
        description: 'Repeatable client workflows',
        icon: Workflow,
      },
      {
        label: 'Forms',
        path: '/marketing/forms',
        description: 'Capture leads into the pipeline',
        icon: Megaphone,
      },
      {
        label: 'Sequences',
        path: '/marketing/sequences',
        description: 'Follow-up without spreadsheet tracking',
        icon: Calendar,
      },
    ],
  },
  {
    label: 'Work intelligently',
    items: [
      {
        label: 'Bonnie AI',
        path: '/ai-agents',
        description: 'Assistive workflows with audit trails',
        icon: Bot,
      },
      {
        label: 'Integrations',
        path: '/ecosystem',
        description: 'Connect tools you already use',
        icon: Sparkles,
      },
      {
        label: 'Platform overview',
        path: '/services',
        description: 'How the operating system fits together',
        icon: Layers,
      },
    ],
  },
];

/** Flat list for footer / search indexing */
export const PRODUCT_NAV_GROUP: MarketingNavGroup = {
  label: 'Product',
  items: PRODUCT_NAV_GROUPS.flatMap((g) => g.items),
};

export const SOLUTIONS_NAV_GROUP: MarketingNavGroup = {
  label: 'Solutions',
  items: [
    {
      label: 'Who we serve',
      path: '/who-we-serve',
      description: 'Agencies, consultants, and service teams',
      icon: Briefcase,
    },
    {
      label: 'Solo founders',
      path: '/solutions/solo-founders',
      description: 'Run intake to invoice without five apps',
      icon: Building2,
    },
    {
      label: 'Agencies',
      path: '/solutions/agencies',
      description: 'Keep sales, delivery, and billing aligned',
      icon: Megaphone,
    },
    {
      label: 'Consultants',
      path: '/solutions/consultants',
      description: 'Client work with a clear paper trail',
      icon: Briefcase,
    },
  ],
};

export const RESOURCES_NAV_GROUP: MarketingNavGroup = {
  label: 'Resources',
  items: [
    {
      label: 'Documentation',
      path: '/docs',
      description: 'Full product reference',
      icon: BookOpen,
    },
    {
      label: 'Onboarding guide',
      path: '/guide',
      description: 'First setup walkthrough',
      icon: Sparkles,
    },
    {
      label: 'FAQ',
      path: '/faq',
      description: 'Common purchase questions',
      icon: HelpCircle,
    },
    {
      label: 'Blog',
      path: '/blog',
      description: 'Updates and playbooks',
      icon: Newspaper,
    },
    {
      label: 'Results & workflows',
      path: '/results',
      description: 'How teams structure their work',
      icon: Workflow,
    },
    {
      label: 'Contact',
      path: '/contact',
      description: 'Talk to the team',
      icon: Mail,
    },
  ],
};

export const COMPANY_NAV_GROUP: MarketingNavGroup = {
  label: 'Company',
  items: [
    {
      label: 'About',
      path: '/about',
      description: 'Why AlphaClone exists',
      icon: Building2,
    },
    {
      label: 'Security',
      path: '/security-policy',
      description: 'How we protect workspace data',
      icon: Shield,
    },
    {
      label: 'Compliance',
      path: '/compliance',
      description: 'Policies and operating controls',
      icon: FileText,
    },
    {
      label: 'Platform status',
      path: '/platform-status',
      description: 'Availability and notices',
      icon: Layers,
    },
  ],
};

export const PRODUCT_PATHS = new Set(
  PRODUCT_NAV_GROUP.items.map((item) => item.path.split('#')[0] ?? item.path)
);
export const SOLUTIONS_PATHS = new Set(
  SOLUTIONS_NAV_GROUP.items.map((item) => item.path.split('#')[0] ?? item.path)
);
export const RESOURCES_PATHS = new Set(
  RESOURCES_NAV_GROUP.items.map((item) => item.path.split('#')[0] ?? item.path)
);
export const COMPANY_PATHS = new Set(
  COMPANY_NAV_GROUP.items.map((item) => item.path.split('#')[0] ?? item.path)
);

export const LANDING_SECTIONS = [
  { id: 'platform', label: 'Platform' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
] as const;

export const FOOTER_LEGAL_LINKS: MarketingNavLink[] = [
  { label: 'Legal Hub', path: '/legal' },
  { label: 'Privacy Policy', path: '/privacy-policy' },
  { label: 'Terms of Service', path: '/terms-of-service' },
  { label: 'Cookie Policy', path: '/cookie-policy' },
  { label: 'Data Processing (DPA)', path: '/dpa' },
  { label: 'Service SLA', path: '/sla' },
  { label: 'Refund Policy', path: '/legal/refund' },
  { label: 'Acceptable Use', path: '/legal/acceptable-use' },
  { label: 'Data Requests', path: '/legal/data-request' },
  { label: 'AI Disclaimer', path: '/legal/ai-disclaimer' },
  { label: 'Privacy Choices', path: '/privacy-choices' },
  { label: 'Data Deletion', path: '/data-deletion' },
];
