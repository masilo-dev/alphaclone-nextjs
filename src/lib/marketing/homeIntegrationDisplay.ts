import type { IconType } from 'react-icons';
import { FaFacebook, FaLinkedin, FaMicrosoft, FaSlack } from 'react-icons/fa6';
import {
  SiAnthropic,
  SiCaldotcom,
  SiGmail,
  SiHubspot,
  SiOpenai,
  SiStripe,
  SiZoho,
} from 'react-icons/si';
import { Mail } from 'lucide-react';
import {
  PUBLIC_INTEGRATIONS,
  type PublicIntegration,
  type IntegrationStatus,
} from '@/config/integrations';

export type HomeIntegrationItem = {
  name: string;
  detail: string;
  badge: string;
  icon: IconType | typeof Mail;
  color: string;
  status: IntegrationStatus;
  href: string;
};

const ICONS: Record<string, { icon: IconType | typeof Mail; color: string }> = {
  microsoft365: { icon: FaMicrosoft, color: 'var(--logo-microsoft)' },
  gmail: { icon: SiGmail, color: 'var(--logo-google-red)' },
  zoho: { icon: SiZoho, color: 'var(--warning-500)' },
  linkedin: { icon: FaLinkedin, color: 'var(--logo-linkedin)' },
  hubspot: { icon: SiHubspot, color: 'var(--logo-hubspot, var(--interactive-primary))' },
  calcom: { icon: SiCaldotcom, color: 'var(--ws-panel)' },
  calendly: { icon: SiCaldotcom, color: 'var(--info-600)' },
  stripe: { icon: SiStripe, color: 'var(--logo-stripe)' },
  facebook: { icon: FaFacebook, color: 'var(--logo-facebook)' },
  slack: { icon: FaSlack, color: 'var(--logo-tiktok, var(--error-500))' },
  openai: { icon: SiOpenai, color: 'var(--logo-openai)' },
  claude: { icon: SiAnthropic, color: 'var(--warning-600)' },
  google_calendar: { icon: SiGmail, color: 'var(--logo-google-blue)' },
};

const GROUP_LABELS: Record<PublicIntegration['category'], string> = {
  communication: 'Communication & Email',
  crm: 'CRM & Sales',
  payments: 'Financials & Payments',
  scheduling: 'Scheduling & Booking',
  social: 'Social',
  ai: 'AI Providers',
  productivity: 'Productivity',
  platform: 'Platform',
};

function toHomeItem(integration: PublicIntegration): HomeIntegrationItem {
  const visual = ICONS[integration.id] ?? { icon: Mail, color: 'var(--brand-blue-500)' };
  return {
    name: integration.name,
    detail: integration.description,
    badge: integration.statusLabel,
    icon: visual.icon,
    color: visual.color,
    status: integration.status,
    href: '/ecosystem',
  };
}

/** Homepage integration grid — sourced from public catalog only. */
export function getHomeIntegrationGroups(): Array<{ title: string; items: HomeIntegrationItem[] }> {
  const skipPlatform = PUBLIC_INTEGRATIONS.filter((i) => i.category !== 'platform');
  const byCategory = new Map<PublicIntegration['category'], HomeIntegrationItem[]>();

  for (const integration of skipPlatform) {
    const list = byCategory.get(integration.category) ?? [];
    list.push(toHomeItem(integration));
    byCategory.set(integration.category, list);
  }

  const order: PublicIntegration['category'][] = [
    'communication',
    'crm',
    'scheduling',
    'payments',
    'social',
    'productivity',
    'ai',
  ];

  return order
    .filter((cat) => byCategory.has(cat))
    .map((cat) => ({
      title: GROUP_LABELS[cat],
      items: byCategory.get(cat)!,
    }));
}
