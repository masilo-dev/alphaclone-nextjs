'use client';

import React, { useState } from 'react';
import { CalendarPlus, ShieldCheck, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types';
import SimpleVideoMeeting from './SimpleVideoMeeting';
import ScheduleMeetingModal from './ScheduleMeetingModal';

interface ConferenceTabProps { user: User }

const ConferenceTab: React.FC<ConferenceTabProps> = ({ user }) => {
  const router = useRouter();
  const [showScheduler, setShowScheduler] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-300"><ShieldCheck className="h-4 w-4" /> Secure workspace video</div>
          <h1 className="text-2xl font-bold text-white">Meetings</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">Use your permanent room for immediate calls or schedule a tenant-scoped meeting with a calendar record and secure join link.</p>
        </div>
        <button type="button" onClick={() => setShowScheduler(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-500">
          <CalendarPlus className="h-4 w-4" /> Schedule meeting
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-1 sm:p-3">
        <div className="mb-2 flex items-center gap-2 px-3 pt-3 text-sm font-semibold text-white"><Video className="h-4 w-4 text-teal-400" /> Permanent room and meeting history</div>
        <SimpleVideoMeeting key={refreshKey} user={user} onJoinRoom={(callId) => router.push(`/meet/${callId}`)} />
      </div>

      <ScheduleMeetingModal isOpen={showScheduler} onClose={() => setShowScheduler(false)} user={user} onSchedule={() => setRefreshKey((value) => value + 1)} />
    </div>
  );
};

export default ConferenceTab;
