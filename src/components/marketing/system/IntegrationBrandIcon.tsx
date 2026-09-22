import type { IconType } from 'react-icons';
import { FaLinkedin, FaMicrosoft } from 'react-icons/fa6';
import {
  SiAnthropic,
  SiCaldotcom,
  SiCalendly,
  SiFacebook,
  SiGmail,
  SiGooglecalendar,
  SiHubspot,
  SiInstagram,
  SiOpenai,
  SiSlack,
  SiStripe,
  SiSupabase,
  SiWhatsapp,
  SiZoho,
} from 'react-icons/si';
import { Network, Sparkles } from 'lucide-react';

type Brand = { Icon: IconType | typeof Network; color: string };

const BRANDS: Record<string, Brand> = {
  calcom: { Icon: SiCaldotcom, color: '#111827' },
  linkedin: { Icon: FaLinkedin, color: '#0a66c2' },
  facebook: { Icon: SiFacebook, color: '#1877f2' },
  stripe: { Icon: SiStripe, color: '#635bff' },
  microsoft365: { Icon: FaMicrosoft, color: '#0078d4' },
  gmail: { Icon: SiGmail, color: '#ea4335' },
  zoho: { Icon: SiZoho, color: '#e42527' },
  hubspot: { Icon: SiHubspot, color: '#ff7a59' },
  calendly: { Icon: SiCalendly, color: '#006bff' },
  google_calendar: { Icon: SiGooglecalendar, color: '#4285f4' },
  slack: { Icon: SiSlack, color: '#611f69' },
  whatsapp: { Icon: SiWhatsapp, color: '#25d366' },
  instagram: { Icon: SiInstagram, color: '#d62976' },
  deepseek: { Icon: Sparkles, color: '#4d6bfe' },
  claude: { Icon: SiAnthropic, color: '#d97757' },
  openai: { Icon: SiOpenai, color: '#10a37f' },
  openrouter: { Icon: Network, color: '#4f46e5' },
  supabase: { Icon: SiSupabase, color: '#3ecf8e' },
};

export default function IntegrationBrandIcon({ id, className = 'h-5 w-5' }: { id: string; className?: string }) {
  const brand = BRANDS[id] ?? { Icon: Network, color: '#52627b' };
  const Icon = brand.Icon;
  return <Icon className={className} style={{ color: brand.color }} aria-hidden="true" />;
}
