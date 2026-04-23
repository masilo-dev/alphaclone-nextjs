import { useCallback, useMemo, useState } from 'react';

const MINIMIZED_STORAGE_KEY = 'ac_meeting_minimized';

function readMinimizedPreference(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    return window.localStorage.getItem(MINIMIZED_STORAGE_KEY) === '1';
}

function writeMinimizedPreference(value: boolean): void {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(MINIMIZED_STORAGE_KEY, value ? '1' : '0');
}

export function useMeetingSession() {
    const [activeMeetingCallId, setActiveMeetingCallId] = useState<string | null>(null);
    const [isMeetingMinimized, setIsMeetingMinimizedState] = useState<boolean>(() => readMinimizedPreference());

    const setIsMeetingMinimized = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
        setIsMeetingMinimizedState((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            writeMinimizedPreference(next);
            return next;
        });
    }, []);

    const startMeeting = useCallback((callId: string) => {
        setActiveMeetingCallId(callId);
        setIsMeetingMinimized(false);
    }, [setIsMeetingMinimized]);

    const endMeeting = useCallback(() => {
        setActiveMeetingCallId(null);
        setIsMeetingMinimized(false);
    }, [setIsMeetingMinimized]);

    const toggleMeetingMinimized = useCallback(() => {
        setIsMeetingMinimized((prev) => !prev);
    }, [setIsMeetingMinimized]);

    return useMemo(() => ({
        activeMeetingCallId,
        isMeetingMinimized,
        startMeeting,
        endMeeting,
        setIsMeetingMinimized,
        toggleMeetingMinimized,
    }), [
        activeMeetingCallId,
        isMeetingMinimized,
        startMeeting,
        endMeeting,
        setIsMeetingMinimized,
        toggleMeetingMinimized,
    ]);
}
