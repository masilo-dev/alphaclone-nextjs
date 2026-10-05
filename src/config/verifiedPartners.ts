import type { IconType } from 'react-icons';
import {
  FaFacebook,
  FaGithub,
  FaGoogle,
  FaInstagram,
  FaLinkedin,
  FaMicrosoft,
  FaWhatsapp,
} from 'react-icons/fa6';
import {
  SiCalendly,
  SiCaldotcom,
  SiCloudflare,
  SiFacebook,
  SiGmail,
  SiInstagram,
  SiResend,
  SiSlack,
  SiStripe,
  SiSupabase,
  SiZoom,
  SiZoho,
  SiBrevo,
} from 'react-icons/si';

export type VerifiedPartner = {
  id: string;
  name: string;
  brandColor: string;
  chipBg: string;
  Icon: IconType;
};

/**
 * OAuth / API integrations verified and connectable inside AlphaClone.
 *
 * Brand icons only: use recognizable real product icons where technically
 * possible (via react-icons/fa6 and react-icons/si). Do NOT represent a real
 * integration with a generic icon such as "mail", "cloud", or a generic AI
 * glyph. If no branded icon exists yet, prefer using the product's official
 * color palette with a simple text wordmark instead.
 */
export const VERIFIED_PARTNERS: VerifiedPartner[] = [
  { id: 'facebook', name: 'Facebook Pages', brandColor: 'var(--logo-facebook)', chipBg: 'var(--brand-violet-950)', Icon: SiFacebook },
  { id: 'instagram', name: 'Instagram', brandColor: 'var(--logo-instagram)', chipBg: 'var(--error-surface)', Icon: SiInstagram },
  { id: 'whatsapp', name: 'WhatsApp — Coming soon', brandColor: 'var(--logo-whatsapp)', chipBg: 'var(--success-700)', Icon: FaWhatsapp },
  { id: 'linkedin', name: 'LinkedIn Profile', brandColor: 'var(--logo-linkedin)', chipBg: 'var(--brand-violet-950)', Icon: FaLinkedin },
  { id: 'linkedin-organization', name: 'LinkedIn Organization', brandColor: 'var(--logo-linkedin)', chipBg: 'var(--brand-violet-950)', Icon: FaLinkedin },
  { id: 'stripe', name: 'Stripe', brandColor: 'var(--logo-stripe)', chipBg: 'var(--brand-violet-950)', Icon: SiStripe },
  { id: 'gmail', name: 'Gmail', brandColor: 'var(--logo-google-red)', chipBg: 'var(--error-surface)', Icon: SiGmail },
  { id: 'google', name: 'Google Workspace', brandColor: 'var(--logo-google-blue)', chipBg: 'var(--brand-violet-950)', Icon: FaGoogle },
  { id: 'microsoft', name: 'Microsoft 365', brandColor: 'var(--logo-microsoft)', chipBg: 'var(--brand-violet-950)', Icon: FaMicrosoft },
  { id: 'outlook', name: 'Outlook 365', brandColor: 'var(--logo-microsoft)', chipBg: 'var(--brand-violet-950)', Icon: FaMicrosoft },
  { id: 'slack', name: 'Slack', brandColor: 'var(--logo-slack-accent)', chipBg: 'var(--error-surface)', Icon: SiSlack },
  { id: 'zoom', name: 'Zoom', brandColor: 'var(--logo-zoom)', chipBg: 'var(--brand-violet-950)', Icon: SiZoom },
  { id: 'calendly', name: 'Calendly', brandColor: 'var(--logo-calendly)', chipBg: 'var(--brand-violet-950)', Icon: SiCalendly },
  { id: 'cal.com', name: 'Cal.com', brandColor: 'var(--ws-panel)', chipBg: 'var(--ws-panel)', Icon: SiCaldotcom },
  { id: 'zoho', name: 'Zoho Workplace, CRM & Campaigns', brandColor: 'var(--logo-zoho)', chipBg: 'var(--warning-surface)', Icon: SiZoho },
  { id: 'brevo', name: 'Brevo', brandColor: 'var(--logo-brevo)', chipBg: 'var(--success-700)', Icon: SiBrevo },
  { id: 'resend', name: 'Resend', brandColor: 'var(--color-white)', chipBg: 'var(--ws-panel)', Icon: SiResend },
  { id: 'supabase', name: 'Supabase', brandColor: 'var(--logo-supabase)', chipBg: 'var(--success-700)', Icon: SiSupabase },
  { id: 'cloudflare', name: 'Cloudflare', brandColor: 'var(--logo-cloudflare)', chipBg: 'var(--warning-surface)', Icon: SiCloudflare },
  { id: 'github', name: 'GitHub', brandColor: 'var(--color-white)', chipBg: 'var(--ws-panel)', Icon: FaGithub },
];

