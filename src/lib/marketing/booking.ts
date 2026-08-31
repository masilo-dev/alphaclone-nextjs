import { PLATFORM_BOOKING_URL } from '@/constants';

export type MeetingType = 'demo' | 'sales' | 'consultation' | 'partnership' | 'general';

export interface BookingConfig {
  type: MeetingType;
  title: string;
  subtitle: string;
  /** Public Cal.com booking page URL for platform marketing. */
  bookingUrl: string;
}

export const DEFAULT_BOOKING_URL =
  process.env.NEXT_PUBLIC_DEMO_BOOKING_URL?.trim() ||
  process.env.NEXT_PUBLIC_BOOKING_URL?.trim() ||
  PLATFORM_BOOKING_URL;

export const BOOKING_CONFIGS: Record<MeetingType, BookingConfig> = {
  demo: {
    type: 'demo',
    title: 'Book a Demo',
    subtitle: 'Choose a time that works for you. We will show you how AlphaClone replaces your entire stack.',
    bookingUrl: DEFAULT_BOOKING_URL,
  },
  sales: {
    type: 'sales',
    title: 'Speak With Sales',
    subtitle: 'Discuss your team size, custom workflow requirements, and enterprise options.',
    bookingUrl: DEFAULT_BOOKING_URL,
  },
  consultation: {
    type: 'consultation',
    title: 'Book a Consultation',
    subtitle: 'Get expert guidance on structuring your AI business operating system.',
    bookingUrl: DEFAULT_BOOKING_URL,
  },
  partnership: {
    type: 'partnership',
    title: 'Partnership Inquiry',
    subtitle: 'Explore integration, reseller, or strategic partnership opportunities.',
    bookingUrl: DEFAULT_BOOKING_URL,
  },
  general: {
    type: 'general',
    title: 'Schedule a Meeting',
    subtitle: 'Pick a 30-minute window for a live call with the AlphaClone Systems team.',
    bookingUrl: DEFAULT_BOOKING_URL,
  },
};

/**
 * Validate that a booking URL is non-empty and well-formed.
 */
export function isValidBookingUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Cal.com pages embed with ?embed=true and mobile-friendly layout. */
export function getBookingEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'cal.com' || host.endsWith('.cal.com')) {
      parsed.searchParams.set('embed', 'true');
      parsed.searchParams.set('layout', 'month_view');
      parsed.searchParams.set('theme', 'dark');
      return parsed.toString();
    }
  } catch {
    // fall through
  }
  return url;
}

/** Path segment for @calcom/embed-react (e.g. alphaclonesystems). */
export function getCalComLink(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\/+|\/+$/g, '');
  } catch {
    return 'alphaclonesystems';
  }
}

/** AlphaClone-native Cal.com inline embed UI (dark-first; light vars required by Cal types). */
const CAL_EMBED_THEME_VARS = {
  'cal-brand': '#14b8a6',
  'cal-brand-emphasis': '#2dd4bf',
  'cal-brand-text': '#020617',
  'cal-brand-subtle': '#0d9488',
  'cal-text': '#cbd5e1',
  'cal-text-emphasis': '#f8fafc',
  'cal-text-subtle': '#94a3b8',
  'cal-text-muted': '#64748b',
  'cal-bg': '#0f172a',
  'cal-bg-emphasis': '#1e293b',
  'cal-bg-subtle': '#172033',
  'cal-bg-muted': '#0b1220',
  'cal-border': '#334155',
  'cal-border-subtle': '#1e293b',
  'cal-border-muted': '#1e293b',
  'cal-border-booker': 'transparent',
  'cal-border-booker-width': '0px',
  radius: '0.75rem',
} as const;

export const CAL_EMBED_UI = {
  theme: 'dark' as const,
  hideEventTypeDetails: false,
  styles: {
    branding: {
      brandColor: '#14b8a6',
    },
  },
  cssVarsPerTheme: {
    light: { ...CAL_EMBED_THEME_VARS },
    dark: { ...CAL_EMBED_THEME_VARS },
  },
};

export function isCalComBookingUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'cal.com' || host.endsWith('.cal.com');
  } catch {
    return false;
  }
}

/**
 * Retrieve booking configuration for a specified meeting type with fallback.
 */
export function getBookingConfig(meetingType?: string): BookingConfig {
  const normalized = (meetingType || 'demo').toLowerCase().trim() as MeetingType;
  if (normalized in BOOKING_CONFIGS) {
    return BOOKING_CONFIGS[normalized];
  }
  return BOOKING_CONFIGS.demo;
}

/** Resolve a validated platform marketing booking URL. */
export function resolvePlatformBookingUrl(url?: string | null): string {
  if (isValidBookingUrl(url)) {
    return url!.trim();
  }
  return DEFAULT_BOOKING_URL;
}
