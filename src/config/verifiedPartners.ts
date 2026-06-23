import type { IconType } from 'react-icons';
import {
  FaFacebook,
  FaGoogle,
  FaInstagram,
  FaLinkedin,
  FaMicrosoft,
  FaWhatsapp,
} from 'react-icons/fa6';
import { SiCalendly, SiHubspot, SiSlack, SiStripe, SiZoom } from 'react-icons/si';

export type VerifiedPartner = {
  id: string;
  name: string;
  brandColor: string;
  chipBg: string;
  Icon: IconType;
};

/** OAuth / API integrations verified and connectable inside AlphaClone. */
export const VERIFIED_PARTNERS: VerifiedPartner[] = [
  { id: 'facebook', name: 'Facebook', brandColor: '#1877F2', chipBg: '#0a1a2d', Icon: FaFacebook },
  { id: 'instagram', name: 'Instagram', brandColor: '#E4405F', chipBg: '#2d0a14', Icon: FaInstagram },
  { id: 'whatsapp', name: 'WhatsApp', brandColor: '#25D366', chipBg: '#0a2d1a', Icon: FaWhatsapp },
  { id: 'linkedin', name: 'LinkedIn', brandColor: '#0A66C2', chipBg: '#0a1a2d', Icon: FaLinkedin },
  { id: 'stripe', name: 'Stripe', brandColor: '#635BFF', chipBg: '#14102d', Icon: SiStripe },
  { id: 'google', name: 'Google', brandColor: '#4285F4', chipBg: '#0a142d', Icon: FaGoogle },
  { id: 'microsoft', name: 'Microsoft 365', brandColor: '#00A4EF', chipBg: '#0a1a2d', Icon: FaMicrosoft },
  { id: 'slack', name: 'Slack', brandColor: '#E01E5A', chipBg: '#2d0a18', Icon: SiSlack },
  { id: 'hubspot', name: 'HubSpot', brandColor: '#FF7A59', chipBg: '#2d140a', Icon: SiHubspot },
  { id: 'zoom', name: 'Zoom', brandColor: '#2D8CFF', chipBg: '#0a1a2d', Icon: SiZoom },
  { id: 'calendly', name: 'Calendly', brandColor: '#006BFF', chipBg: '#0a142d', Icon: SiCalendly },
];
