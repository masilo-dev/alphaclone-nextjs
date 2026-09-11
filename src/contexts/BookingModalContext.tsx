'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { BookingConfig, getBookingConfig, MeetingType } from '@/lib/marketing/booking';

interface OpenModalOptions {
  title?: string;
  subtitle?: string;
  customUrl?: string;
}

interface BookingModalContextType {
  isOpen: boolean;
  activeConfig: BookingConfig;
  customTitle?: string;
  customSubtitle?: string;
  customUrl?: string;
  openBookingModal: (meetingType?: MeetingType | string, options?: OpenModalOptions) => void;
  closeBookingModal: () => void;
}

const BookingModalContext = createContext<BookingModalContextType | undefined>(undefined);

export function BookingModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeConfig, setActiveConfig] = useState<BookingConfig>(getBookingConfig('demo'));
  const [customTitle, setCustomTitle] = useState<string | undefined>(undefined);
  const [customSubtitle, setCustomSubtitle] = useState<string | undefined>(undefined);
  const [customUrl, setCustomUrl] = useState<string | undefined>(undefined);

  const openBookingModal = useCallback((meetingType?: MeetingType | string, options?: OpenModalOptions) => {
    const config = getBookingConfig(meetingType);
    setActiveConfig(config);
    setCustomTitle(options?.title);
    setCustomSubtitle(options?.subtitle);
    setCustomUrl(options?.customUrl);
    setIsOpen(true);
  }, []);

  const closeBookingModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <BookingModalContext.Provider
      value={{
        isOpen,
        activeConfig,
        customTitle,
        customSubtitle,
        customUrl,
        openBookingModal,
        closeBookingModal,
      }}
    >
      {children}
    </BookingModalContext.Provider>
  );
}

export function useBookingModal() {
  const context = useContext(BookingModalContext);
  if (!context) {
    throw new Error('useBookingModal must be used within a BookingModalProvider');
  }
  return context;
}
