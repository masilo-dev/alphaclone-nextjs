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
  microsoft365: { icon: FaMicrosoft, color: '#0078d4' },
  gmail: { icon: SiGmail, color: '#ea4335' },
  zoho: { icon: SiZoho, color: '#f6c344' },
  linkedin: { icon: FaLinkedin, color: '#0a66c2' },
  hubspot: { icon: SiHubspot, color: '#ff7a59' },
  calcom: { icon: SiCaldotcom, color: '#292524' },
  calendly: { icon: SiCaldotcom, color: '#006bff' },
  stripe: { icon: SiStripe, color: '#635bff' },
  facebook: { icon: FaFacebook, color: '#1877f2' },
  slack: { icon: FaSlack, color: '#e01e5a' },
  openai: { icon: SiOpenai, color: '#10a37f' },
  claude: { icon: SiAnthropic, color: '#d97706' },
  google_calendar: { icon: SiGmail, color: '#4285f4' },
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
  const visual = ICONS[integration.id] ?? { icon: Mail, color: '#14b8a6' };
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
