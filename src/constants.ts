

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
  MapPin
} from 'lucide-react';
import { NavItem, DashboardStat } from './types';

export const APP_NAME = "AlphaClone Systems";

export const LOGO_URL = "/logo.png";

// --- CLIENT NAVIGATION ---
export const CLIENT_NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Projects', href: '/dashboard/projects', icon: Briefcase },
  { label: 'Project Calendar', href: '/dashboard/calendar', icon: Calendar },
  { label: 'Invoices & Payments', href: '/dashboard/finance', icon: DollarSign },
  { label: 'Contracts', href: '/dashboard/contracts', icon: FileText },
  { label: 'AI Studio', href: '/dashboard/ai-studio', icon: Palette },
  { label: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
  { label: 'Conferencing', href: '/dashboard/conference', icon: Video },
  { label: 'Submit Request', href: '/dashboard/submit', icon: FileText },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

// --- ADMIN NAVIGATION ---
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Platform Command', href: '/dashboard/admin/tenants', icon: Users },

  { label: 'Command Center', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Live Operations', href: '/dashboard/analytics', icon: Activity },
  {
    label: 'Client Management',
    href: '#',
    icon: Users,
    subItems: [
      { label: 'CRM / All Clients', href: '/dashboard/clients' },
      { label: 'Sales Agent / Leads', href: '/dashboard/sales-agent' },
      { label: 'Active Projects', href: '/dashboard/projects' },
      { label: 'Onboarding Pipelines', href: '/dashboard/onboarding' },
    ]
  },
  {
    label: 'Communication',
    href: '#',
    icon: MessageSquare,
    subItems: [
      { label: 'Inbox', href: '/dashboard/messages' },
      { label: 'Meetings', href: '/dashboard/meetings' },
      { label: 'Calendar', href: '/dashboard/calendar' },
    ]
  },
  {
    label: 'Studio Mgmt',
    href: '#',
    icon: Layers,
    subItems: [
      { label: 'SEO Articles', href: '/dashboard/articles' },
      { label: 'Portfolio Editor', href: '/dashboard/portfolio-manager' },
      { label: 'Resource Allocation', href: '/dashboard/allocation' },
      { label: 'Improvements', href: '/dashboard/admin/improvements' },
    ]
  },
  {
    label: 'Enterprise CRM',
    href: '#',
    icon: TrendingUp,
    subItems: [
      { label: 'Tasks', href: '/dashboard/tasks' },
      { label: 'Deals Pipeline', href: '/dashboard/deals' },
      { label: 'Quotes & Proposals', href: '/dashboard/quotes' },
      { label: 'Sales Forecast', href: '/dashboard/forecast' },
    ]
  },
  { label: 'Contracts', href: '/dashboard/contracts', icon: FileText },
  { label: 'Financials', href: '/dashboard/finance', icon: DollarSign },
  { label: 'Security (SIEM)', href: '/dashboard/security', icon: ShieldCheck },
];

// --- TENANT ADMIN NAVIGATION (Business Dashboard) ---
export const TENANT_ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Business Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'CRM Directory', href: '/dashboard/crm', icon: Users },
  { label: 'Leads & Deals', href: '/dashboard/leads', icon: TrendingUp },
  { label: 'Growth Agent', href: '/dashboard/sales-agent', icon: Zap },
  { label: 'Task Center', href: '/dashboard/tasks', icon: CheckSquare },
  { label: 'Projects', href: '/dashboard/business/projects', icon: Briefcase },
  { label: 'Active Meetings', href: '/dashboard/business/meetings', icon: Video },
  { label: 'Financials', href: '/dashboard/business/billing', icon: DollarSign },
  {
    label: 'Accounting',
    href: '#',
    icon: BarChart3,
    subItems: [
      { label: 'Chart of Accounts', href: '/dashboard/accounting/chart-of-accounts' },
      { label: 'Journal Entries', href: '/dashboard/accounting/journal-entries' },
      { label: 'Financial Reports', href: '/dashboard/accounting/reports' },
    ]
  },
  { label: 'Contracts', href: '/dashboard/business/contracts', icon: FileText },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
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