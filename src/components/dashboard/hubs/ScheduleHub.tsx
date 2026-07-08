'use client';

import React from 'react';
import { Calendar, Clock, Video, Users } from 'lucide-react';
import HubShell from './HubShell';

const SCHEDULE_TABS = [
  { label: 'Calendar', href: '/dashboard/business/calendar', icon: Calendar },
  { label: 'Booking', href: '/dashboard/business/booking', icon: Clock },
  { label: 'Meetings', href: '/dashboard/business/meetings', icon: Video },
  { label: 'Teams', href: '/dashboard/business/teams', icon: Users },
];

interface ScheduleHubProps {
  children: React.ReactNode;
}

export default function ScheduleHub({ children }: ScheduleHubProps) {
  return (
    <HubShell
      title="Schedule & meet"
      description="Calendar, booking links, video meetings, and Teams"
      tabs={SCHEDULE_TABS}
    >
      {children}
    </HubShell>
  );
}
