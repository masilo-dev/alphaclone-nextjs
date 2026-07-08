import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  CheckSquare,
  FileText,
  HelpCircle,
  Layers,
  Mail,
  Newspaper,
  Receipt,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

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

/** Top-level links always visible on desktop */
export const MARKETING_PRIMARY_LINKS: MarketingNavLink[] = [
  { label: 'Home', path: '/' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Results', path: '/results' },
  { label: 'Book Demo', path: '/book-demo' },
];

/** Product capabilities — CRM, invoicing, AI, delivery */
export const PRODUCT_NAV_GROUP: MarketingNavGroup = {
  label: 'Product',
  items: [
    { label: 'Platform overview', path: '/services', description: 'Everything in one workspace', icon: Layers },
    { label: 'CRM & pipeline', path: '/crm', description: 'Leads, deals, and follow-up', icon: Users },
    { label: 'Lead management', path: '/lead-management', description: 'Capture and qualify', icon: Target },
    { label: 'Invoicing & billing', path: '/docs#financials', description: 'Quotes, invoices, payments', icon: Receipt },
    { label: 'Projects & tasks', path: '/project-management', description: 'Client delivery portal', icon: CheckSquare },
    { label: 'Contracts & e-sign', path: '/docs#contracts', description: 'Templates and signing', icon: FileText },
    { label: 'AI agents', path: '/ai-agents', description: 'Automated growth workflows', icon: Bot },
    { label: 'Ecosystem', path: '/ecosystem', description: 'Integrations and modules', icon: Sparkles },
  ],
};

/** Learn, onboard, and get help */
export const RESOURCES_NAV_GROUP: MarketingNavGroup = {
  label: 'Resources',
  items: [
    { label: 'Documentation', path: '/docs', description: 'Full product reference', icon: BookOpen },
    { label: 'Onboarding guide', path: '/guide', description: 'First 10 minutes setup', icon: Sparkles },
    { label: 'FAQ', path: '/faq', description: 'Common questions', icon: HelpCircle },
    { label: 'Blog', path: '/blog', description: 'Updates and playbooks', icon: Newspaper },
    { label: 'Contact', path: '/contact', description: 'Talk to our team', icon: Mail },
  ],
};

/** Company & audience */
export const COMPANY_NAV_GROUP: MarketingNavGroup = {
  label: 'Company',
  items: [
    { label: 'About', path: '/about', description: 'Who we are', icon: Building2 },
    { label: 'Who we serve', path: '/who-we-serve', description: 'Teams we built for', icon: Briefcase },
    { label: 'Video meetings', path: '/video-meetings', description: 'Built-in conferencing', icon: Target },
  ],
};

export const PRODUCT_PATHS = new Set(
  PRODUCT_NAV_GROUP.items.map((item) => item.path.split('#')[0] ?? item.path)
);

export const RESOURCES_PATHS = new Set(
  RESOURCES_NAV_GROUP.items.map((item) => item.path.split('#')[0] ?? item.path)
);

export const COMPANY_PATHS = new Set(COMPANY_NAV_GROUP.items.map((item) => item.path));

export const BUSINESS_SIGNUP_HREF = '/auth/login?register=true&type=business&plan=starter';
export const LOGIN_HREF = '/auth/login';

/** Landing page section anchors for in-page navigation */
export const LANDING_SECTIONS = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'features', label: 'Features' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'contact', label: 'Contact' },
] as const;
