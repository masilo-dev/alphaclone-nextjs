'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlarmClock, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLocaleDate } from '@/i18n/languages';

interface TaskCountdownProps {
    dueDate: string;
    /** Called once when the deadline passes while the component is mounted. */
    onOverdue?: () => void;
    /**
     * Play a short chime + show a toast when the deadline passes *while the
     * page is open*. Items that are already overdue when the page loads never
     * make a sound — the user just sees the "Overdue by …" badge.
     */
    showAlarm?: boolean;
    /** Human name of the task/project, used in the "deadline reached" notice. */
    label?: string;
}

const SOON_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function formatDurationParts(ms: number): string {
    const abs = Math.max(0, Math.abs(ms));
    const days = Math.floor(abs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((abs / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((abs / 1000 / 60) % 60);
    const seconds = Math.floor((abs / 1000) % 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
}

/**
 * Short two-tone chime generated with WebAudio. No external asset, so it can't
 * 404 or be blocked by an ad-blocker. Silently no-ops when autoplay is refused.
 */
function playDeadlineChime(): void {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    try {
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const tones: Array<[number, number]> = [[880, 0], [1174.66, 0.18]];
        for (const [freq, offset] of tones) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.35);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.4);
        }
        window.setTimeout(() => { void ctx.close().catch(() => undefined); }, 1200);
    } catch {
        /* autoplay blocked or no audio device — the toast still explains what happened */
    }
}

export const TaskCountdown: React.FC<TaskCountdownProps> = ({
    dueDate,
    onOverdue,
    showAlarm = true,
    label,
}) => {
    const { t, language } = useLanguage();
    const [remainingMs, setRemainingMs] = useState<number>(() => new Date(dueDate).getTime() - Date.now());
    // Tracks whether we have already fired the alarm for this deadline. Seeded
    // to `true` when the item is already overdue on mount so we never chime for
    // stale deadlines when the page loads.
    const alarmFiredRef = useRef<boolean>(new Date(dueDate).getTime() <= Date.now());

    useEffect(() => {
        const target = new Date(dueDate).getTime();
        if (Number.isNaN(target)) return;

        alarmFiredRef.current = target <= Date.now();
        setRemainingMs(target - Date.now());

        const tick = () => {
            const diff = target - Date.now();
            setRemainingMs(diff);

            if (diff <= 0 && !alarmFiredRef.current) {
                alarmFiredRef.current = true;
                onOverdue?.();
                if (showAlarm) {
                    playDeadlineChime();
                    const name = label?.trim();
                    toast(
                        name
                            ? t('{name} is now overdue').replace('{name}', name)
                            : t('A deadline was just reached'),
                        { icon: '⏰', id: `deadline-${dueDate}-${name ?? ''}`, duration: 8000 },
                    );
                }
            }
        };

        tick();
        const interval = window.setInterval(tick, 1000);
        return () => window.clearInterval(interval);
    }, [dueDate, onOverdue, showAlarm, label, t]);

    if (Number.isNaN(new Date(dueDate).getTime())) {
        return <span className="text-xs text-slate-600 italic">{t('No deadline')}</span>;
    }

    const isOverdue = remainingMs <= 0;
    const isSoon = !isOverdue && remainingMs <= SOON_THRESHOLD_MS;
    const dueLabel = formatLocaleDate(dueDate, language);

    if (isOverdue) {
        return (
            <span
                className="inline-flex items-center gap-1 text-xs font-bold text-red-500"
                title={`${t('Deadline passed on')} ${dueLabel}`}
                aria-label={`${t('Overdue by')} ${formatDurationParts(remainingMs)}`}
            >
                <AlarmClock className="w-3.5 h-3.5" aria-hidden />
                {t('Overdue by')} {formatDurationParts(remainingMs)}
            </span>
        );
    }

    return (
        <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${isSoon ? 'text-amber-500' : 'text-slate-400'}`}
            title={`${t('Due')} ${dueLabel}`}
        >
            <Clock className="w-3.5 h-3.5" aria-hidden />
            {t('Due in')} {formatDurationParts(remainingMs)}
        </span>
    );
};
