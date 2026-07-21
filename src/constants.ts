

import {
  LayoutDashboard,
  MessageSquare,
  Briefcase,
  Settings,
  Users,
  ShieldCheck,
  Video,
  Calendar,
  FileText,
  DollarSign,
  Receipt,
  Activity,
  Clock,
  Layers,
  Palette,
  CheckSquare,
  TrendingUp,
  Mail,
  Zap,
  BarChart3,
  MapPin,
  FolderOpen,
  Presentation,
  Globe,
  PenSquare,
  Facebook,
  Linkedin,
  Instagram,
  Smartphone,

  Bell,
  Bot,
  Search,
  Star,
  Twitter,
  MessageCircle,
  Database,
  Target,
  Brain,
  BookOpen,
  ShieldAlert,
} from 'lucide-react';
import { NavItem, DashboardStat } from './types';

export const APP_NAME = "AlphaClone Systems";
export const APP_SHORT_NAME = "AlphaClone";
export const APP_TAGLINE = "Your business operating system";

/** Platform Calendly link for sales/demo calls (marketing + dashboard). */
export const PLATFORM_CALENDLY_URL = 'https://calendly.com/bonniealphaclonesystems/30min';

/** Shown in Settings; keep in sync with package.json version. */
export const APP_VERSION = '1.0.0';

export const LOGO_URL = "/logo.png";

// --- CLIENT NAVIGATION ---
export const CLIENT_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Workspace',
    href: '#',
    icon: Briefcase,
    subItems: [
      { label: 'Projects', href: '/dashboard/projects', icon: Briefcase },
      { label: 'Calendar', href: '/dashboard/calendar', icon: Calendar },
    ]
  },
  {
    label: 'Communication',
    href: '#',
    icon: MessageSquare,
    subItems: [
      { label: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
      { label: 'Mail', href: '/dashboard/mail', icon: Mail },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ]
  },
  {
    label: 'Resources',
    href: '#',
    icon: FileText,
    subItems: [
      { label: 'Finance', href: '/dashboard/finance', icon: DollarSign },
      { label: 'Contracts', href: '/dashboard/contracts', icon: FileText },
      { label: 'AI Studio', href: '/dashboard/ai-studio', icon: Palette },
      { label: 'Documents', href: '/dashboard/submit', icon: FileText },
    ]
  },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  { label: 'Platform guide', href: '/dashboard/help', icon: BookOpen },
];

// --- ADMIN NAVIGATION ---
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Command Center', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Tenants', href: '/dashboard/admin/tenants', icon: Users },
  { label: 'Ops & logs', href: '/dashboard/admin/operations', icon: Activity },
  { label: 'Pre-customer review', href: '/dashboard/admin/improvements', icon: Zap },
  { label: 'Platform Users', href: '/dashboard/admin/users', icon: Users },
  { label: 'Security', href: '/dashboard/security', icon: ShieldCheck },
  { label: 'Global Settings', href: '/dashboard/admin/settings', icon: Settings },
  { label: 'Contact intake', href: '/dashboard/contact-submissions', icon: Mail },
  { label: 'Bonnie AI', href: '/dashboard/bonnie', icon: Brain },
  { label: 'Approvals', href: '/dashboard/bonnie/approvals', icon: ShieldAlert },
  {
    label: 'Platform insights',
    href: '#',
    icon: BarChart3,
    subItems: [
      { label: 'Analytics', href: '/dashboard/analytics' },
      { label: 'Performance', href: '/dashboard/performance' },
      { label: 'Reporting', href: '/dashboard/reporting' },
    ],
  },
  {
    label: 'Support desk',
    href: '#',
    icon: MessageSquare,
    subItems: [
      { label: 'Deep-Desk Tickets', href: '/dashboard/tickets' },
      { label: 'Messages', href: '/dashboard/messages' },
      { label: 'Mail', href: '/dashboard/mail' },
    ],
  },
  { label: 'Platform guide', href: '/dashboard/help', icon: BookOpen },
];

// --- TENANT_ADMIN NAVIGATION (aligned with hub names: Sales, Marketing, Money, Insights, Documents) ---
export const TENANT_ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Workspace home', href: '/dashboard', icon: Zap },
  { label: 'Bonnie AI', href: '/dashboard/business/bonnie', icon: Brain },
  { label: 'Approvals', href: '/dashboard/bonnie/approvals', icon: ShieldAlert },

  {
    label: 'Sales Hub',
    href: '#',
    icon: Users,
    subItems: [
      { label: 'CRM overview', href: '/dashboard/crm', icon: Users },
      { label: 'CRM workspace', href: '/dashboard/crm/workspace', icon: Users },
      { label: 'Outreach', href: '/dashboard/outreach', icon: Mail },
      { label: 'Sales console', href: '/dashboard/crm/console', icon: Target },
      { label: 'Leads Board', href: '/dashboard/leads', icon: TrendingUp },
      { label: 'Deals Pipeline', href: '/dashboard/deals', icon: Target },
      { label: 'Contacts', href: '/dashboard/contacts', icon: Users },
      { label: 'Accounts', href: '/dashboard/crm/accounts', icon: Users },
      { label: 'CRM Reports', href: '/dashboard/crm/reports', icon: BarChart3 },
      { label: 'Sales Forecast', href: '/dashboard/forecast', icon: TrendingUp },
      { label: 'Goals & Targets', href: '/dashboard/goals', icon: Target },
      { label: 'Annual Planning', href: '/dashboard/planning', icon: Calendar },
      { label: 'Jobs & Queue', href: '/dashboard/jobs', icon: Clock },
      { label: 'Production Tasks', href: '/dashboard/tasks', icon: CheckSquare },
      { label: 'Lead Finder', href: '/dashboard/leads/campaigns', icon: MessageSquare },
      { label: 'Lead Ingestion', href: '/dashboard/business/ingestion', icon: Database },
      { label: 'Webhooks', href: '/dashboard/webhooks', icon: Zap },
    ],
  },

  {
    label: 'Marketing Hub',
    href: '#',
    icon: Globe,
    subItems: [
      { label: 'Email Campaigns', href: '/dashboard/business/campaigns', icon: Presentation },
      { label: 'Sequences', href: '/dashboard/marketing/sequences', icon: Mail },
      { label: 'Deliverability', href: '/dashboard/marketing/deliverability', icon: MessageSquare },
      { label: 'Branded Forms', href: '/dashboard/business/forms', icon: FileText },
      { label: 'Social overview', href: '/dashboard/business/social', icon: Globe },
      { label: 'Compose', href: '/dashboard/business/social/compose', icon: PenSquare },
      { label: 'Schedule', href: '/dashboard/business/social-command', icon: Calendar },
      { label: 'LinkedIn', href: '/dashboard/business/linkedin', icon: Linkedin },
      { label: 'Facebook', href: '/dashboard/business/facebook', icon: Facebook },
      { label: 'Instagram', href: '/dashboard/business/instagram', icon: Instagram },
      { label: 'X (Twitter)', href: '/dashboard/business/x', icon: Twitter },
      { label: 'SMS Outreach', href: '/dashboard/business/sms', icon: Smartphone },
    ],
  },

  {
    label: 'Money Hub',
    href: '#',
    icon: DollarSign,
    subItems: [
      { label: 'Accounting', href: '/dashboard/accounting', icon: BarChart3 },
      { label: 'Banking', href: '/dashboard/accounting/banking', icon: DollarSign },
      { label: 'Bills Payable', href: '/dashboard/accounting/bills', icon: FileText },
      { label: 'Vendors', href: '/dashboard/vendors', icon: Briefcase },
      { label: 'Period Close', href: '/dashboard/accounting/period-close', icon: FileText },
      { label: 'Billing overview', href: '/dashboard/business/billing', icon: DollarSign },
      { label: 'Invoices', href: '/dashboard/business/billing/manage', icon: DollarSign },
      { label: 'Finance & expenses', href: '/dashboard/finance/manage', icon: Receipt },
      { label: 'Quotes & Proposals', href: '/dashboard/business/quotes', icon: FileText },
      { label: 'Cash Flow Forecast', href: '/dashboard/business/cash-flow', icon: TrendingUp },
      { label: 'Tax Estimator', href: '/dashboard/business/tax-estimator', icon: FileText },
    ],
  },

  {
    label: 'Insights Hub',
    href: '#',
    icon: Activity,
    subItems: [
      { label: 'Executive Dashboard', href: '/dashboard/executive', icon: BarChart3 },
      { label: 'Analytics', href: '/dashboard/analytics', icon: Activity },
      { label: 'Performance', href: '/dashboard/performance', icon: Zap },
      { label: 'Revenue Reports', href: '/dashboard/reporting', icon: TrendingUp },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ],
  },

  {
    label: 'Documents Hub',
    href: '#',
    icon: FolderOpen,
    subItems: [
      { label: 'Document Hub', href: '/dashboard/business/documents', icon: FileText },
      { label: 'Document Vault', href: '/dashboard/business/vault', icon: ShieldCheck },
      { label: 'Contracts', href: '/dashboard/business/contracts', icon: ShieldCheck },
      { label: 'Contract Manager', href: '/dashboard/business/contracts/manage', icon: ShieldCheck },
      { label: 'Active Projects', href: '/dashboard/business/projects', icon: Layers },
      { label: 'Project Manager', href: '/dashboard/business/projects/manage', icon: Layers },
      { label: 'Client Onboarding', href: '/dashboard/business/onboarding', icon: Users },
    ],
  },

  {
    label: 'Channels',
    href: '#',
    icon: MessageSquare,
    subItems: [
      { label: 'Deep-Desk Tickets', href: '/dashboard/business/tickets', icon: CheckSquare },
      { label: 'Team Messages', href: '/dashboard/business/messages', icon: MessageSquare },
      { label: 'Mail', href: '/dashboard/mail', icon: Mail },
      { label: 'WhatsApp', href: '/dashboard/business/whatsapp', icon: MessageCircle },
    ],
  },

  {
    label: 'Schedule & meet',
    href: '#',
    icon: Clock,
    subItems: [
      { label: 'Calendar', href: '/dashboard/business/calendar', icon: Calendar },
      { label: 'Booking Links', href: '/dashboard/business/booking', icon: Clock },
      { label: 'MS Teams', href: '/dashboard/business/teams', icon: Video },
    ],
  },

  {
    label: 'Workspace',
    href: '#',
    icon: Settings,
    subItems: [
      { label: 'Integration Marketplace', href: '/dashboard/marketplace', icon: Globe },
      { label: 'Workflow Builder', href: '/dashboard/business/workflows', icon: Zap },
      { label: 'Platform guide', href: '/dashboard/help', icon: BookOpen },
      { label: 'System Settings', href: '/dashboard/business/settings', icon: Settings },
    ],
  },
];
