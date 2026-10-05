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
    subtitle: 'Get expert guidance on connecting AI to your authorized business systems and execution workflows.',
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
    subtitle: 'Pick an available time for a live call with the AlphaClone Systems team.',
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
  'cal-brand': 'var(--brand-blue-500)',
  'cal-brand-emphasis': 'var(--brand-blue-400)',
  'cal-brand-text': 'var(--brand-violet-950)',
  'cal-brand-subtle': 'var(--brand-blue-600)',
  'cal-text': 'var(--ws-border)',
  'cal-text-emphasis': 'var(--ws-surface-secondary)',
  'cal-text-subtle': 'var(--ws-text-secondary)',
  'cal-text-muted': 'var(--ws-text-muted)',
  'cal-bg': 'var(--ws-canvas)',
  'cal-bg-emphasis': 'var(--ws-panel)',
  'cal-bg-subtle': '#172033',
  'cal-bg-muted': 'var(--ws-canvas)',
  'cal-border': 'var(--ws-surface-tertiary)',
  'cal-border-subtle': 'var(--ws-panel)',
  'cal-border-muted': 'var(--ws-panel)',
  'cal-border-booker': 'transparent',
  'cal-border-booker-width': '0px',
  radius: '0.75rem',
} as const;

export const CAL_EMBED_UI = {
  theme: 'dark' as const,
  hideEventTypeDetails: false,
  styles: {
    branding: {
      brandColor: 'var(--brand-blue-500)',
    },
  },
  cssVarsPerTheme: {
    light: { ...CAL_EMBED_THEME_VARS,
      'cal-text': 'var(--ws-surface-tertiary)', 'cal-text-emphasis': 'var(--ws-canvas)',
      'cal-text-subtle': 'var(--ws-text-muted)', 'cal-text-muted': 'var(--ws-text-muted)',
      'cal-bg': 'var(--color-white)', 'cal-bg-emphasis': 'var(--ws-surface-secondary)',
      'cal-bg-subtle': 'var(--ws-surface-secondary)', 'cal-bg-muted': 'var(--ws-surface-secondary)',
      'cal-border': 'var(--ws-border)', 'cal-border-subtle': 'var(--ws-border)', 'cal-border-muted': 'var(--ws-border)',
    },
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
    const parsed = new URL(url!.trim());
    if (parsed.hostname === 'cal.com' && parsed.pathname.replace(/\/+$/, '') === '/alphaclonesystems') {
      parsed.pathname = '/alphaclonesystems/demo-for-for-alphaclone-systems';
    }
    return parsed.toString();
  }
  return isValidBookingUrl(DEFAULT_BOOKING_URL)
    ? resolvePlatformBookingUrl(DEFAULT_BOOKING_URL)
    : PLATFORM_BOOKING_URL;
}
