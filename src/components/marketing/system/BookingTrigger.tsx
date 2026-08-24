'use client';

import React from 'react';
import {
  PUBLIC_DEMO_BOOKING_URL,
  isExternalHref,
  withPreservedQuery,
} from '@/lib/marketing/cta';
import { DEFAULT_CALENDLY_URL, getBookingConfig, isValidBookingUrl, MeetingType } from '@/lib/marketing/booking';
import { useEffect, useState } from 'react';

interface BookingTriggerProps {
  meetingType?: MeetingType | string;
  title?: string;
  subtitle?: string;
  customUrl?: string;
  children?: React.ReactNode;
  className?: string;
  variant?: 'button' | 'link';
  /** Accessible label; defaults to the children (or "Book a demo") */
  'aria-label'?: string;
}

/**
 * BookingTrigger — PUBLIC (AlphaClone marketing-site) demo / call bookings.
 *
 * Per the landing-page engineering rules, this ALWAYS navigates the visitor
 * to the EXTERNAL calendar booking page. It never opens an internal modal,
 * never routes to the tenant app, never uses href="#".
 *
 * TENANT BOOKING IS NOT AFFECTED: this component lives in components/marketing
 * and is imported only by marketing sections. Tenant/customer booking flows
 * continue using their own configured destination URLs inside the app.
 */
export function BookingTrigger({
  meetingType = 'demo',
  title,
  subtitle,
  customUrl,
  children = 'Book a demo',
  className = '',
  variant = 'button',
  'aria-label': ariaLabel,
}: BookingTriggerProps) {
  const cfg = getBookingConfig(meetingType);
  const baseUrl = isValidBookingUrl(customUrl) ? customUrl! : (isValidBookingUrl(cfg.calendlyUrl) ? cfg.calendlyUrl : PUBLIC_DEMO_BOOKING_URL || DEFAULT_CALENDLY_URL);
  const [destination, setDestination] = useState(baseUrl);

  useEffect(() => {
    setDestination(withPreservedQuery(baseUrl, window.location.search));
  }, [baseUrl]);

  const external = isExternalHref(destination);
  const label = ariaLabel || (typeof children === 'string' ? (children as string) : cfg.title || 'Book a demo');

  // Render always as an accessible anchor for navigation, even when styled as a button.
  // target="_blank" + rel="noopener noreferrer" ensures safe external-tab behaviour
  // with identical semantics on desktop, tablet, and mobile.
  return (
    <a
      href={destination}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      role={variant === 'button' ? 'button' : undefined}
      aria-label={label}
      // Ensure keyboard users can activate it even when styled as a button.
      tabIndex={0}
      className={className}
    >
      {children}
    </a>
  );
}

