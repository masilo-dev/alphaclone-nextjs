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
  calcom: { Icon: SiCaldotcom, color: 'var(--ws-canvas)' },
  linkedin: { Icon: FaLinkedin, color: 'var(--logo-linkedin)' },
  facebook: { Icon: SiFacebook, color: 'var(--logo-facebook)' },
  stripe: { Icon: SiStripe, color: 'var(--logo-stripe)' },
  microsoft365: { Icon: FaMicrosoft, color: 'var(--logo-microsoft)' },
  gmail: { Icon: SiGmail, color: 'var(--logo-google-red)' },
  zoho: { Icon: SiZoho, color: 'var(--logo-google-red)' },
  hubspot: { Icon: SiHubspot, color: 'var(--logo-hubspot, var(--interactive-primary))' },
  calendly: { Icon: SiCalendly, color: 'var(--info-600)' },
  google_calendar: { Icon: SiGooglecalendar, color: 'var(--logo-google-blue)' },
  slack: { Icon: SiSlack, color: 'var(--logo-slack)' },
  whatsapp: { Icon: SiWhatsapp, color: 'var(--logo-whatsapp)' },
  instagram: { Icon: SiInstagram, color: 'var(--logo-instagram, var(--error-500))' },
  deepseek: { Icon: Sparkles, color: 'var(--logo-discord, var(--info-500))' },
  claude: { Icon: SiAnthropic, color: 'var(--logo-hubspot, var(--interactive-primary))' },
  openai: { Icon: SiOpenai, color: 'var(--logo-openai)' },
  openrouter: { Icon: Network, color: 'var(--brand-violet-500)' },
  supabase: { Icon: SiSupabase, color: 'var(--success-500)' },
};

export default function IntegrationBrandIcon({ id, className = 'h-5 w-5' }: { id: string; className?: string }) {
  const brand = BRANDS[id] ?? { Icon: Network, color: 'var(--marketing-muted)' };
  const Icon = brand.Icon;
  return <Icon className={className} style={{ color: brand.color }} aria-hidden="true" />;
}
