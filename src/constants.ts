

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
  Facebook,
  Linkedin,
  Instagram,
  Smartphone,

  Bot,
  Search,
  Star
} from 'lucide-react';
import { NavItem, DashboardStat } from './types';

export const APP_NAME = "AlphaClone Systems";

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
      { label: 'Meetings', href: '/dashboard/conference', icon: Video },
    ]
  },
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
  { label: 'Live Stats', href: '/dashboard/analytics', icon: Activity },
  {
    label: 'Communication',
    href: '#',
    icon: MessageSquare,
    subItems: [
      { label: 'Calendar', href: '/dashboard/calendar' },
      { label: 'Meetings', href: '/dashboard/meetings' },
      { label: 'Mail', href: '/dashboard/mail' },
      { label: 'Messages', href: '/dashboard/messages' },
    ]
  },
  {
    label: 'Creative Intel',
    href: '#',
    icon: Layers,
    subItems: [
      { label: 'SEO', href: '/dashboard/articles' },
      { label: 'Improvements', href: '/dashboard/admin/improvements' },
    ]
  },
  {
    label: 'Enterprise CRM',
    href: '#',
    icon: TrendingUp,
    subItems: [
      { label: 'Tasks', href: '/dashboard/tasks' },
      { label: 'Deals', href: '/dashboard/deals' },
      { label: 'Forecast', href: '/dashboard/forecast' },
    ]
  },
  { label: 'Contracts', href: '/dashboard/contracts', icon: FileText },
  { label: 'Finance', href: '/dashboard/finance', icon: DollarSign },
  { label: 'Global Settings', href: '/dashboard/admin/settings', icon: Settings },
  { label: 'Security', href: '/dashboard/security', icon: ShieldCheck },
];

// --- TENANT_ADMIN NAVIGATION (workspace: fewer top-level groups, same destinations) ---
export const TENANT_ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Workspace home', href: '/dashboard', icon: Zap },

  {
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
      { label: 'Gmail', href: '/dashboard/mail', icon: Mail },
      { label: 'Facebook Inbox', href: '/dashboard/business/facebook', icon: Facebook },
      { label: 'Social Media Manager', href: '/dashboard/business/social', icon: Globe },
      { label: 'Zoho Mail', href: '/dashboard/zoho/mail', icon: Mail },
      { label: 'SMS Outreach', href: '/dashboard/business/sms', icon: Smartphone },
      { label: 'LinkedIn Manager', href: '/dashboard/business/linkedin', icon: Linkedin },
      { label: 'Instagram', href: '/dashboard/business/instagram', icon: Instagram },
      { label: 'Social Command Center', href: '/dashboard/business/social-command', icon: Star },
    ]
  },

  {
    label: 'Schedule and meet', href: '#', icon: Clock,
    subItems: [
      { label: 'Calendar', href: '/dashboard/business/calendar', icon: Calendar },
      { label: 'Booking Links', href: '/dashboard/business/booking', icon: Clock },
      { label: 'Conference Space', href: '/dashboard/business/meetings', icon: Video },
    ]
  },

  {
    label: 'Revenue and legal', href: '#', icon: DollarSign,
    subItems: [
      { label: 'Proposals and quotes', href: '/dashboard/business/quotes', icon: FileText },
      { label: 'Active Contracts', href: '/dashboard/business/contracts', icon: ShieldCheck },
      { label: 'Billing Center', href: '/dashboard/business/billing', icon: DollarSign },
      { label: 'Accounting Hub', href: '/dashboard/accounting', icon: BarChart3 },
      { label: 'Revenue Analytics', href: '/dashboard/business/reports', icon: TrendingUp },
    ]
  },

  {
    label: 'Deliver and automate', href: '#', icon: CheckSquare,
    subItems: [
      { label: 'Active Projects', href: '/dashboard/business/projects', icon: Layers },
      { label: 'Production Tasks', href: '/dashboard/tasks', icon: CheckSquare },
      { label: 'Shared Documents', href: '/dashboard/business/documents', icon: FolderOpen },
      { label: 'Integration Marketplace', href: '/dashboard/marketplace', icon: Globe },
      { label: 'Marketing Campaigns', href: '/dashboard/business/campaigns', icon: Presentation },
      { label: 'System Settings', href: '/dashboard/business/settings', icon: Settings },
    ]
  },
];



export const ADMIN_STATS: DashboardStat[] = [
  { label: 'Total Clients', value: '24', icon: Users, color: 'bg-indigo-600' },
  { label: 'Active Projects', value: '18', icon: Briefcase, color: 'bg-teal-600' },
  { label: 'Revenue (MTD)', value: '$124k', icon: DollarSign, color: 'bg-green-600' },
  { label: 'System Health', value: '99.9%', icon: Activity, color: 'bg-rose-600' },
];

export const CLIENT_STATS: DashboardStat[] = [
  { label: 'Active Projects', value: '1', icon: Briefcase, color: 'bg-teal-600' },
  { label: 'Pending Invoices', value: '1', icon: DollarSign, color: 'bg-yellow-600' },
  { label: 'Unread Messages', value: '3', icon: MessageSquare, color: 'bg-blue-600' },
  { label: 'Upcoming Meetings', value: '2', icon: Video, color: 'bg-purple-600' },
];

export const DOCUMENTATION_VIDEOS = {
  DASHBOARD_TOUR: "3a7000c925c145b7882089688b0ceb5d",
  AI_INFRASTRUCTURE: "023023e9a7e84120894768393d9ce454",
  CLIENT_ONBOARDING: "7e5e33d0e2e54e4e84b8e8a8b8b8b8b8", // Placeholder
};