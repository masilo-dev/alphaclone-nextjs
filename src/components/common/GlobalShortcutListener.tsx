'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface GlobalShortcutListenerProps {
    onOpenQuickTask?: () => void;
    onToggleVoice?: () => void;
    onOpenCommandPalette?: () => void;
}

export const GlobalShortcutListener: React.FC<GlobalShortcutListenerProps> = ({
    onOpenQuickTask,
    onToggleVoice,
    onOpenCommandPalette
}) => {
    const router = useRouter();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Meta (Cmd) or Ctrl + K for Command Palette (Standard)
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                onOpenCommandPalette?.();
            }

            // Alt (Option) + T for Quick Task
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                onOpenQuickTask?.();
            }

            // Alt (Option) + V for Voice Capture
            if (e.altKey && e.key === 'v') {
                e.preventDefault();
                onToggleVoice?.();
            }

            // Alt (Option) + D for Dashboard (Quick Nav)
            if (e.altKey && e.key === 'd') {
                e.preventDefault();
                router.push('/dashboard');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onOpenQuickTask, onToggleVoice, onOpenCommandPalette, router]);

    return null; // This is a headless component
};
