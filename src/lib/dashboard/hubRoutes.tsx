import type React from 'react';
import SalesHub from '@/components/dashboard/hubs/SalesHub';
import MoneyHub from '@/components/dashboard/hubs/MoneyHub';
import MarketingHub from '@/components/dashboard/hubs/MarketingHub';
import InsightsHub from '@/components/dashboard/hubs/InsightsHub';
import DocumentsHub from '@/components/dashboard/hubs/DocumentsHub';
import ChannelsHub from '@/components/dashboard/hubs/ChannelsHub';
import ScheduleHub from '@/components/dashboard/hubs/ScheduleHub';
import WorkspaceHub from '@/components/dashboard/hubs/WorkspaceHub';

export const SALES_HUB_ROUTES = new Set([
  '/dashboard/crm',
  '/dashboard/crm/workspace',
  '/dashboard/outreach',
  '/dashboard/outreach/inbox',
  '/dashboard/crm/console',
  '/dashboard/crm/accounts',
  '/dashboard/crm/reports',
  '/dashboard/crm/follow-ups',
  '/dashboard/crm/activities',
  '/dashboard/crm/activity',
  '/dashboard/crm/unified-contacts',
  '/dashboard/leads',
  '/dashboard/leads/campaigns',
  '/dashboard/leads/finder',
  '/dashboard/contacts',
  '/dashboard/business/clients',
  '/dashboard/deals',
  '/dashboard/forecast',
  '/dashboard/tasks',
  '/dashboard/sales-agent',
  '/dashboard/goals',
  '/dashboard/planning',
  '/dashboard/jobs',
  '/dashboard/webhooks',
  '/dashboard/business/ingestion',
  '/dashboard/business/referrals',
]);

export const MONEY_HUB_ROUTES = new Set([
  '/dashboard/accounting',
  '/dashboard/accounting/banking',
  '/dashboard/accounting/bills',
  '/dashboard/accounting/period-close',
  '/dashboard/finance',
  '/dashboard/finance/manage',
  '/dashboard/business/billing',
  '/dashboard/business/billing/manage',
  '/dashboard/business/invoices',
  '/dashboard/business/expenses',
  '/dashboard/business/quotes',
  '/dashboard/business/cash-flow',
  '/dashboard/business/tax-estimator',
  '/dashboard/vendors',
]);

export const MARKETING_HUB_ROUTES = new Set([
  '/dashboard/business/campaigns',
  '/dashboard/business/campaigns/zoho',
  '/dashboard/marketing/campaigns',
  '/dashboard/email-campaigns',
  '/dashboard/marketing/sequences',
  '/dashboard/marketing/deliverability',
  '/dashboard/business/forms',
  '/dashboard/business/social',
  '/dashboard/social',
  '/dashboard/business/social/compose',
  '/dashboard/social/compose',
  '/dashboard/business/social-command',
  '/dashboard/business/sms',
  '/dashboard/business/unified-inbox',
  '/dashboard/zoho/mail',
  '/dashboard/business/facebook',
  '/dashboard/business/linkedin',
  '/dashboard/business/instagram',
  '/dashboard/business/x',
]);

export const INSIGHTS_HUB_ROUTES = new Set([
  '/dashboard/executive',
  '/dashboard/analytics',
  '/dashboard/performance',
  '/dashboard/business/reports',
  '/dashboard/reporting',
  '/dashboard/notifications',
]);

export const DOCUMENTS_HUB_ROUTES = new Set([
  '/dashboard/business/documents',
  '/dashboard/business/vault',
  '/dashboard/contracts',
  '/dashboard/business/contracts',
  '/dashboard/contracts/manage',
  '/dashboard/business/contracts/manage',
  '/dashboard/business/projects',
  '/dashboard/projects',
  '/dashboard/business/projects/manage',
  '/dashboard/projects/manage',
  '/dashboard/business/onboarding',
  '/dashboard/business/pages',
  '/dashboard/business/contact-submissions',
]);

export const CHANNELS_HUB_ROUTES = new Set([
  '/dashboard/business/tickets',
  '/dashboard/messages',
  '/dashboard/business/messages',
  '/dashboard/business/whatsapp',
]);

export const SCHEDULE_HUB_ROUTES = new Set([
  '/dashboard/calendar',
  '/dashboard/business/calendar',
  '/dashboard/business/booking',
  '/dashboard/business/teams',
  '/dashboard/business/meetings',
  '/dashboard/conference',
  '/dashboard/meetings',
]);

export const WORKSPACE_HUB_ROUTES = new Set([
  '/dashboard/marketplace',
  '/dashboard/automations',
  '/dashboard/business/workflows',
  '/dashboard/help',
  '/dashboard/settings',
  '/dashboard/business/settings',
  '/dashboard/business/quotas',
  '/dashboard/business/tasks',
  '/dashboard/zoho/crm',
]);

export const ALL_HUB_ROUTES = new Set([
  ...SALES_HUB_ROUTES,
  ...MONEY_HUB_ROUTES,
  ...MARKETING_HUB_ROUTES,
  ...INSIGHTS_HUB_ROUTES,
  ...DOCUMENTS_HUB_ROUTES,
  ...CHANNELS_HUB_ROUTES,
  ...SCHEDULE_HUB_ROUTES,
  ...WORKSPACE_HUB_ROUTES,
]);

export function isHubRoute(tab: string): boolean {
  return ALL_HUB_ROUTES.has(tab);
}

export function wrapRouteInHub(tab: string, content: React.ReactNode): React.ReactNode {
  if (SALES_HUB_ROUTES.has(tab)) return <SalesHub>{content}</SalesHub>;
  if (MONEY_HUB_ROUTES.has(tab)) return <MoneyHub>{content}</MoneyHub>;
  if (MARKETING_HUB_ROUTES.has(tab)) return <MarketingHub>{content}</MarketingHub>;
  if (INSIGHTS_HUB_ROUTES.has(tab)) return <InsightsHub>{content}</InsightsHub>;
  if (DOCUMENTS_HUB_ROUTES.has(tab)) return <DocumentsHub>{content}</DocumentsHub>;
  if (CHANNELS_HUB_ROUTES.has(tab)) return <ChannelsHub>{content}</ChannelsHub>;
  if (SCHEDULE_HUB_ROUTES.has(tab)) return <ScheduleHub>{content}</ScheduleHub>;
  if (WORKSPACE_HUB_ROUTES.has(tab)) return <WorkspaceHub>{content}</WorkspaceHub>;
  return content;
}
