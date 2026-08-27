'use client';

import React, { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckSquare, Sparkles, Link2, Loader2 } from 'lucide-react';
import { NativeScreen, NativeScreenHeader, NativeSection, NativeListTile } from '@/components/pwa/native/NativeUi';
import { useAuth } from '@/contexts/AuthContext';

function ShareIntakeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const shared = useMemo(() => {
    const title = searchParams.get('title')?.trim() || '';
    const text = searchParams.get('text')?.trim() || '';
    const url = searchParams.get('url')?.trim() || '';
    const combined = [title, text, url].filter(Boolean).join('\n');
    return { title, text, url, combined };
  }, [searchParams]);

  if (loading) {
    return (
      <NativeScreen className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </NativeScreen>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
    return null;
  }

  const taskTitle = shared.title || shared.text?.slice(0, 120) || shared.url || 'Shared item';
  const bonniePrompt = shared.combined || taskTitle;

  return (
    <NativeScreen>
      <NativeScreenHeader title="Shared to AlphaClone" onBack={() => router.push('/dashboard')} />
      <div className="px-4 py-4 space-y-4">
        {shared.combined ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300 whitespace-pre-wrap break-words">
            {shared.combined}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nothing was shared. Try sharing a link or note from another app.</p>
        )}
      </div>

      <NativeSection title="What should we do with this?">
        <NativeListTile
          icon={<CheckSquare className="w-5 h-5 text-rose-400" />}
          title="Create task"
          subtitle="Add to your task list with this title"
          onClick={() => {
            const params = new URLSearchParams({ create: 'true', title: taskTitle });
            router.push(`/dashboard/tasks?${params.toString()}`);
          }}
        />
        <NativeListTile
          icon={<Sparkles className="w-5 h-5 text-teal-400" />}
          title="Ask Bonnie"
          subtitle="Open Bonnie with this context"
          onClick={() => {
            const params = new URLSearchParams({ prompt: bonniePrompt.slice(0, 2000) });
            router.push(`/dashboard/bonnie?${params.toString()}`);
          }}
        />
        {shared.url ? (
          <NativeListTile
            icon={<Link2 className="w-5 h-5 text-blue-400" />}
            title="Open link"
            subtitle={shared.url}
            onClick={() => {
              window.open(shared.url, '_blank', 'noopener,noreferrer');
            }}
          />
        ) : null}
      </NativeSection>
    </NativeScreen>
  );
}

export default function ShareIntakePage() {
  return (
    <Suspense
      fallback={
        <NativeScreen className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </NativeScreen>
      }
    >
      <ShareIntakeContent />
    </Suspense>
  );
}
