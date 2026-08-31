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

/** Cal.com pages embed cleanly with ?embed=true. */
export function getBookingEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'cal.com' || host.endsWith('.cal.com')) {
      if (!parsed.searchParams.has('embed')) {
        parsed.searchParams.set('embed', 'true');
      }
      return parsed.toString();
    }
  } catch {
    // fall through
  }
  return url;
}

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
