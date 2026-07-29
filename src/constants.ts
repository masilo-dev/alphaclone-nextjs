

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

<<<<<<< HEAD
  Bell,
=======
>>>>>>> origin/main
  Bot,
  Search,
  Star,
  Twitter,
<<<<<<< HEAD
  MessageCircle,
  Database,
  Target,
  Brain,
  BookOpen,
  ShieldAlert,
=======
  MessageCircle
>>>>>>> origin/main
} from 'lucide-react';
import { NavItem, DashboardStat } from './types';

export const APP_NAME = "Alphaclone Systems";
export const APP_SHORT_NAME = "Alphaclone";
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
<<<<<<< HEAD
=======
  {
    label: 'Communication',
    href: '#',
    icon: MessageSquare,
    subItems: [
      { label: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
      { label: 'Mail', href: '/dashboard/mail', icon: Mail },
    ]
  },
  {
    label: 'Resources',
    href: '#',
    icon: FileText,
    subItems: [
      { label: 'Finance', href: '/dashboard/finance', icon: DollarSign },
      { label: 'Contracts', href: '/dashboard/contracts', icon: FileText },
      { label: 'Creative Intel Lab', href: '/dashboard/ai-studio', icon: Palette },
      { label: 'Documents', href: '/dashboard/submit', icon: FileText },
    ]
  },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

// --- ADMIN NAVIGATION ---
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Tenants', href: '/dashboard/admin/tenants', icon: Users },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Business OS', href: '/dashboard/performance', icon: Zap },
  { label: 'Live Stats', href: '/dashboard/analytics', icon: Activity },
>>>>>>> origin/main
  {
    label: 'Communication',
    href: '#',
    icon: MessageSquare,
    subItems: [
<<<<<<< HEAD
      { label: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
      { label: 'Mail', href: '/dashboard/mail', icon: Mail },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
=======
      { label: 'Calendar', href: '/dashboard/calendar' },
      { label: 'Mail', href: '/dashboard/mail' },
      { label: 'Messages', href: '/dashboard/messages' },
>>>>>>> origin/main
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

// --- TENANT_ADMIN NAVIGATION (purpose groups: Customers → Settings + Bonnie) ---
export const TENANT_ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: Zap },

  {
<<<<<<< HEAD
    label: 'Relationships',
    href: '#',
    icon: Users,
    subItems: [
      { label: 'Customer workspace', href: '/dashboard/crm/workspace', icon: Users },
      { label: 'Contacts', href: '/dashboard/contacts', icon: Users },
      { label: 'Accounts', href: '/dashboard/crm/accounts', icon: Users },
      { label: 'Tickets', href: '/dashboard/business/tickets', icon: CheckSquare },
    ],
=======
    label: 'Lead Operations', href: '#', icon: Search,
    subItems: [
      { label: 'Step 1: Find leads', href: '/dashboard/sales-agent?tab=finder', icon: Search },
      { label: 'Step 2: Capture contacts', href: '/dashboard/contacts', icon: Users },
      { label: 'Step 3: Qualify leads', href: '/dashboard/leads?source=mcp', icon: TrendingUp },
      { label: 'Step 4: Move to deals', href: '/dashboard/deals', icon: TrendingUp },
      { label: 'Growth Agent Chat', href: '/dashboard/sales-agent?tab=chat', icon: Bot },
    ]
  },

  {
    label: 'Social & Outreach', href: '#', icon: Globe,
    subItems: [
      { label: 'Gmail / SMTP Mail', href: '/dashboard/mail', icon: Mail },
      { label: 'WhatsApp Accounts', href: '/dashboard/business/whatsapp', icon: MessageCircle },
      { label: 'Facebook Inbox', href: '/dashboard/business/facebook', icon: Facebook },
      { label: 'Social Media Manager', href: '/dashboard/business/social', icon: Globe },
      { label: 'Zoho Mail', href: '/dashboard/zoho/mail', icon: Mail },
      { label: 'SMS Outreach', href: '/dashboard/business/sms', icon: Smartphone },
      { label: 'LinkedIn Manager', href: '/dashboard/business/linkedin', icon: Linkedin },
      { label: 'X (Twitter) Manager', href: '/dashboard/business/x', icon: Twitter, comingSoon: true },
      { label: 'Instagram', href: '/dashboard/business/instagram', icon: Instagram, comingSoon: true },
      { label: 'Social Command Center', href: '/dashboard/business/social-command', icon: Star },
    ]
>>>>>>> origin/main
  },

  {
    label: 'Sales',
    href: '#',
    icon: Target,
    subItems: [
      { label: 'Lead Finder', href: '/dashboard/leads/campaigns', icon: Search },
      { label: 'Leads', href: '/dashboard/leads', icon: TrendingUp },
      { label: 'Deals', href: '/dashboard/deals', icon: Target },
      { label: 'Outreach', href: '/dashboard/outreach', icon: Mail },
      { label: 'Quotes', href: '/dashboard/business/quotes', icon: FileText },
      { label: 'Sales overview', href: '/dashboard/crm', icon: BarChart3 },
    ],
  },

  {
    label: 'Growth',
    href: '#',
    icon: Globe,
    subItems: [
      { label: 'Email campaigns', href: '/dashboard/business/campaigns', icon: Presentation },
      { label: 'Social', href: '/dashboard/business/social', icon: Globe },
      { label: 'Compose post', href: '/dashboard/business/social/compose', icon: PenSquare },
      { label: 'Forms', href: '/dashboard/business/forms', icon: FileText },
      { label: 'SMS', href: '/dashboard/business/sms', icon: Smartphone },
      { label: 'Social command', href: '/dashboard/business/social-command', icon: Calendar },
    ],
  },

  {
    label: 'Money',
    href: '#',
    icon: DollarSign,
    subItems: [
      { label: 'Invoices', href: '/dashboard/business/billing/manage', icon: DollarSign },
      { label: 'Billing overview', href: '/dashboard/business/billing', icon: DollarSign },
      { label: 'Accounting', href: '/dashboard/accounting', icon: BarChart3 },
      { label: 'Expenses', href: '/dashboard/business/expenses', icon: Receipt },
      { label: 'Cash flow', href: '/dashboard/business/cash-flow', icon: TrendingUp },
      { label: 'Banking', href: '/dashboard/accounting/banking', icon: DollarSign },
    ],
  },

  {
    label: 'Work',
    href: '#',
    icon: Briefcase,
    subItems: [
      { label: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
      { label: 'Projects', href: '/dashboard/business/projects', icon: Layers },
      { label: 'Calendar', href: '/dashboard/business/calendar', icon: Calendar },
<<<<<<< HEAD
      { label: 'Meetings', href: '/dashboard/business/meetings', icon: Video },
      { label: 'Booking links', href: '/dashboard/business/booking', icon: Clock },
    ],
=======
      { label: 'Booking Links', href: '/dashboard/business/booking', icon: Clock },
    ]
>>>>>>> origin/main
  },

  {
    label: 'Communication',
    href: '#',
    icon: MessageSquare,
    subItems: [
<<<<<<< HEAD
      { label: 'Unified Inbox', href: '/dashboard/comms', icon: Mail },
      { label: 'WhatsApp', href: '/dashboard/business/whatsapp', icon: MessageCircle },
      { label: 'Team messages', href: '/dashboard/business/messages', icon: MessageSquare },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ],
=======
      { label: 'Proposals and quotes', href: '/dashboard/business/quotes', icon: FileText },
      { label: 'Active Contracts', href: '/dashboard/business/contracts', icon: ShieldCheck },
      { label: 'Billing Center', href: '/dashboard/business/billing', icon: DollarSign },
      { label: 'Accounting Hub', href: '/dashboard/accounting', icon: BarChart3 },
      { label: 'Business OS', href: '/dashboard/performance', icon: Zap },
      { label: 'Revenue Analytics', href: '/dashboard/business/reports', icon: TrendingUp },
    ]
>>>>>>> origin/main
  },

  {
    label: 'Knowledge',
    href: '#',
    icon: FolderOpen,
    subItems: [
      { label: 'Documents', href: '/dashboard/business/documents', icon: FileText },
      { label: 'Contracts', href: '/dashboard/business/contracts', icon: ShieldCheck },
      { label: 'Vault', href: '/dashboard/business/vault', icon: ShieldCheck },
    ],
  },

  {
    label: 'Intelligence',
    href: '#',
    icon: Brain,
    subItems: [
      { label: 'Bonnie AI', href: '/dashboard/business/bonnie', icon: Brain },
      { label: 'Approvals', href: '/dashboard/bonnie/approvals', icon: ShieldAlert },
      { label: 'Automations', href: '/dashboard/business/workflows', icon: Zap },
      { label: 'Analytics', href: '/dashboard/analytics', icon: Activity },
      { label: 'Executive view', href: '/dashboard/executive', icon: BarChart3 },
    ],
  },

  {
    label: 'Administration',
    href: '#',
    icon: Settings,
    subItems: [
      { label: 'System settings', href: '/dashboard/business/settings', icon: Settings },
      { label: 'Integrations', href: '/dashboard/marketplace', icon: Globe },
      { label: 'Platform guide', href: '/dashboard/help', icon: BookOpen },
    ],
  },
];
