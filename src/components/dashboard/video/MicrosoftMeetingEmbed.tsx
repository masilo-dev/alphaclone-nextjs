'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CallComposite,
  fromFlatCommunicationIdentifier,
  useAzureCommunicationCallAdapter,
} from '@azure/communication-react';
import {
  AzureCommunicationTokenCredential,
  CommunicationUserIdentifier,
} from '@azure/communication-common';
import { Loader2 } from 'lucide-react';
import { ENV } from '@/config/env';

interface MicrosoftMeetingEmbedProps {
  meetingLink: string;
  displayName: string;
}

interface AcsPayload {
  available: boolean;
  userId?: string;
  token?: string;
  displayName?: string;
  error?: string;
}

export default function MicrosoftMeetingEmbed({
  meetingLink,
  displayName,
}: MicrosoftMeetingEmbedProps) {
  const [acs, setAcs] = useState<AcsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const response = await fetch(`${ENV.VITE_SUPABASE_URL}/functions/v1/get-acs-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: ENV.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ displayName }),
        });
        const payload = await response.json();
        setAcs(payload);
      } catch (error) {
        setAcs({
          available: false,
          error: error instanceof Error ? error.message : 'Unable to load ACS token.',
        });
      } finally {
        setLoading(false);
      }
    };

    void loadToken();
  }, [displayName]);

  const credential = useMemo(
    () => (acs?.token ? new AzureCommunicationTokenCredential(acs.token) : undefined),
    [acs?.token]
  );

  const adapterArgs = useMemo(() => {
    if (!acs?.available || !acs.userId || !credential || !meetingLink) {
      return undefined;
    }

    return {
      userId: fromFlatCommunicationIdentifier(acs.userId) as CommunicationUserIdentifier,
      displayName: acs.displayName || displayName,
      credential,
      locator: { meetingLink },
    };
  }, [acs, credential, displayName, meetingLink]);

  const adapter = useAzureCommunicationCallAdapter(adapterArgs ?? {});

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center text-white bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (acs?.available && adapter) {
    return (
      <div className="h-full w-full">
        <CallComposite adapter={adapter} />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-950">
      <div className="absolute top-4 left-4 z-10 rounded-lg bg-slate-900/80 border border-white/5 px-3 py-2 text-xs text-slate-300">
        {acs?.error || 'ACS token unavailable, using Teams web meeting.'}
      </div>
      <iframe
        src={meetingLink}
        title="Microsoft Teams Meeting"
        className="h-full w-full border-0"
        allow="camera; microphone; fullscreen; display-capture"
      />
    </div>
  );
}
