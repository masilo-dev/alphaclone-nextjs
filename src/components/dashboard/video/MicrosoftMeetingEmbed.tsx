'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ENV } from '@/config/env';

interface MicrosoftMeetingEmbedProps {
  meetingLink: string;
  displayName: string;
}

interface TeamsTokenPayload {
  available: boolean;
  token?: string;
  error?: string;
}

export default function MicrosoftMeetingEmbed({
  meetingLink,
  displayName,
}: MicrosoftMeetingEmbedProps) {
  const [teamsToken, setTeamsToken] = useState<TeamsTokenPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const supabaseUrl = ENV?.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = ENV?.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !anonKey) {
          setTeamsToken({
            available: false,
            error: 'Supabase URL or anon key not configured',
          });
          return;
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/get-teams-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
          },
          body: JSON.stringify({ displayName }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          setTeamsToken({
            available: false,
            error: `Failed to get Teams token: ${response.status} ${errorText}`,
          });
          return;
        }

        const payload = await response.json();
        setTeamsToken(payload);
      } catch (error) {
        setTeamsToken({
          available: false,
          error: error instanceof Error ? error.message : 'Unable to load Teams token.',
        });
      } finally {
        setLoading(false);
      }
    };

    void loadToken();
  }, [displayName]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center text-white bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  // Build the Teams meeting embed URL with optional token
  const embedUrl = teamsToken?.available && teamsToken?.token
    ? `${meetingLink}?token=${encodeURIComponent(teamsToken.token)}`
    : meetingLink;

  return (
    <div className="h-full w-full bg-slate-950">
      {!teamsToken?.available && (
        <div className="absolute top-4 left-4 z-10 rounded-lg bg-slate-900/80 border border-white/5 px-3 py-2 text-xs text-slate-300">
          {teamsToken?.error || 'Teams token unavailable, using direct meeting link.'}
        </div>
      )}
      <iframe
        src={embedUrl}
        title="Microsoft Teams Meeting"
        className="h-full w-full border-0"
        allow="camera; microphone; fullscreen; display-capture"
      />
    </div>
  );
}
