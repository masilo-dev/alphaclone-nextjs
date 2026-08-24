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
  SiHubspot,
  SiInstagram,
  SiLinkedin,
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
  { id: 'facebook', name: 'Facebook Pages', brandColor: '#1877F2', chipBg: '#0a1a2d', Icon: SiFacebook },
  { id: 'instagram', name: 'Instagram', brandColor: '#E4405F', chipBg: '#2d0a14', Icon: SiInstagram },
  { id: 'whatsapp', name: 'WhatsApp — Coming soon', brandColor: '#25D366', chipBg: '#0a2d1a', Icon: FaWhatsapp },
  { id: 'linkedin', name: 'LinkedIn Profile', brandColor: '#0A66C2', chipBg: '#0a1a2d', Icon: SiLinkedin },
  { id: 'linkedin-organization', name: 'LinkedIn Organization', brandColor: '#0A66C2', chipBg: '#0a1a2d', Icon: SiLinkedin },
  { id: 'stripe', name: 'Stripe', brandColor: '#635BFF', chipBg: '#14102d', Icon: SiStripe },
  { id: 'gmail', name: 'Gmail', brandColor: '#EA4335', chipBg: '#2d0a0a', Icon: SiGmail },
  { id: 'google', name: 'Google Workspace', brandColor: '#4285F4', chipBg: '#0a142d', Icon: FaGoogle },
  { id: 'microsoft', name: 'Microsoft 365', brandColor: '#00A4EF', chipBg: '#0a1a2d', Icon: FaMicrosoft },
  { id: 'outlook', name: 'Outlook 365', brandColor: '#0078D4', chipBg: '#0a142d', Icon: FaMicrosoft },
  { id: 'slack', name: 'Slack', brandColor: '#E01E5A', chipBg: '#2d0a18', Icon: SiSlack },
  { id: 'hubspot', name: 'HubSpot', brandColor: '#FF7A59', chipBg: '#2d140a', Icon: SiHubspot },
  { id: 'zoom', name: 'Zoom', brandColor: '#2D8CFF', chipBg: '#0a1a2d', Icon: SiZoom },
  { id: 'calendly', name: 'Calendly', brandColor: '#006BFF', chipBg: '#0a142d', Icon: SiCalendly },
  { id: 'cal.com', name: 'Cal.com', brandColor: '#292524', chipBg: '#1c1917', Icon: SiCaldotcom },
  { id: 'zoho', name: 'Zoho Workplace, CRM & Campaigns', brandColor: '#F4B400', chipBg: '#211b08', Icon: SiZoho },
  { id: 'brevo', name: 'Brevo', brandColor: '#0B996E', chipBg: '#08241c', Icon: SiBrevo },
  { id: 'resend', name: 'Resend', brandColor: '#FFFFFF', chipBg: '#18181b', Icon: SiResend },
  { id: 'supabase', name: 'Supabase', brandColor: '#3ECF8E', chipBg: '#08241c', Icon: SiSupabase },
  { id: 'cloudflare', name: 'Cloudflare', brandColor: '#F38020', chipBg: '#2d1408', Icon: SiCloudflare },
  { id: 'github', name: 'GitHub', brandColor: '#FFFFFF', chipBg: '#18181b', Icon: FaGithub },
];

