'use client';

import React from 'react';
import { useBookingModal } from '@/contexts/BookingModalContext';
import { MeetingType } from '@/lib/marketing/booking';

interface BookingTriggerProps {
  meetingType?: MeetingType | string;
  title?: string;
  subtitle?: string;
  customUrl?: string;
  children?: React.ReactNode;
  className?: string;
  variant?: 'button' | 'link';
}

export function BookingTrigger({
  meetingType = 'demo',
  title,
  subtitle,
  customUrl,
  children = 'Book a demo',
  className = '',
  variant = 'button',
}: BookingTriggerProps) {
  const { openBookingModal } = useBookingModal();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    openBookingModal(meetingType, { title, subtitle, customUrl });
  };

  if (variant === 'link') {
    return (
      <a
        href="/book-demo"
        onClick={handleClick}
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
    >
      {children}
    </button>
  );
}
