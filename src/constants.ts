

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
  FolderOpen
} from 'lucide-react';
import { NavItem, DashboardStat } from './types';

export const APP_NAME = "AlphaClone Systems";

export const LOGO_URL = "/logo.png";

// --- CLIENT NAVIGATION ---
export const CLIENT_NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Projects', href: '/dashboard/projects', icon: Briefcase },
  { label: 'Project Calendar', href: '/dashboard/calendar', icon: Calendar },
  { label: 'Conferencing', href: '/dashboard/conference', icon: Video },
  { label: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
  { label: 'Gmail', href: '/dashboard/gmail', icon: Mail },
  { label: 'Invoices & Payments', href: '/dashboard/finance', icon: DollarSign },
  { label: 'Contracts', href: '/dashboard/contracts', icon: FileText },
  { label: 'AI Studio', href: '/dashboard/ai-studio', icon: Palette, comingSoon: true },
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
      { label: 'Calendar', href: '/dashboard/calendar' },
      { label: 'Meetings', href: '/dashboard/meetings' },
      { label: 'Gmail', href: '/dashboard/gmail' },
      { label: 'Inbox', href: '/dashboard/messages' },
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
      { label: 'Sales Forecast', href: '/dashboard/forecast' },
    ]
  },
  { label: 'Contracts', href: '/dashboard/contracts', icon: FileText },
  { label: 'Financials', href: '/dashboard/finance', icon: DollarSign },
  { label: 'Security (SIEM)', href: '/dashboard/security', icon: ShieldCheck },
];

// --- TENANT ADMIN NAVIGATION (Business Dashboard) ---
export const TENANT_ADMIN_NAV_ITEMS: NavItem[] = [
  // 1. Overview
  { label: 'Business Home', href: '/dashboard', icon: LayoutDashboard },

  // 2. Acquisition & Sales Pipeline
  { label: 'Growth Agent', href: '/dashboard/sales-agent', icon: Zap },
  { label: 'Leads & Deals', href: '/dashboard/leads', icon: TrendingUp },
  { label: 'CRM Directory', href: '/dashboard/crm', icon: Users },

  // 3. Communication & Scheduling
  { label: 'Gmail', href: '/dashboard/gmail', icon: Mail },
  { label: 'Calendar', href: '/dashboard/business/calendar', icon: Calendar },
  { label: 'Booking', href: '/dashboard/business/booking', icon: Clock },
  { label: 'Active Meetings', href: '/dashboard/business/meetings', icon: Video },

  // 4. Closing & Agreements
  { label: 'Quotes', href: '/dashboard/business/quotes', icon: FileText },
  { label: 'Contracts', href: '/dashboard/business/contracts', icon: FileText },

  // 5. Execution & Fulfillment 
  { label: 'Projects', href: '/dashboard/business/projects', icon: Briefcase },
  { label: 'Task Center', href: '/dashboard/tasks', icon: CheckSquare },

  // 6. Finances & Records
  { label: 'Financials', href: '/dashboard/business/billing', icon: DollarSign },
  { label: 'Accounting', href: '/dashboard/accounting', icon: BarChart3 },
  { label: 'Document Hub', href: '/dashboard/business/documents', icon: FolderOpen },

  // 7. Administration
  { label: 'Settings', href: '/dashboard/business/settings', icon: Settings },
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