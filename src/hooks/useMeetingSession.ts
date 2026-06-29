import { useCallback, useEffect, useMemo, useState } from 'react';

function minimizedStorageKey(scopeKey: string): string {
    return `ac_meeting_minimized:${scopeKey}`;
}

function activeCallStorageKey(scopeKey: string): string {
    return `ac_active_meeting_call_id:${scopeKey}`;
}

function readMinimizedPreference(scopeKey: string): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    return window.localStorage.getItem(minimizedStorageKey(scopeKey)) === '1';
}

function writeMinimizedPreference(scopeKey: string, value: boolean): void {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(minimizedStorageKey(scopeKey), value ? '1' : '0');
}

function readActiveMeetingCallId(scopeKey: string): string | null {
    if (typeof window === 'undefined') {
        return null;
    }
    const callId = window.localStorage.getItem(activeCallStorageKey(scopeKey));
    return callId && callId.trim().length > 0 ? callId : null;
}

function writeActiveMeetingCallId(scopeKey: string, callId: string | null): void {
    if (typeof window === 'undefined') {
        return;
    }
    if (callId) {
        window.localStorage.setItem(activeCallStorageKey(scopeKey), callId);
        return;
    }
    window.localStorage.removeItem(activeCallStorageKey(scopeKey));
}

function clearStoredMeetingSession(scopeKey: string): void {
    writeActiveMeetingCallId(scopeKey, null);
    writeMinimizedPreference(scopeKey, false);
}

const JOINABLE_MEETING_STATUSES = new Set(['scheduled', 'active']);

export function useMeetingSession(scopeKey = 'global') {
    const [activeMeetingCallId, setActiveMeetingCallIdState] = useState<string | null>(() => readActiveMeetingCallId(scopeKey));
    const [isMeetingMinimized, setIsMeetingMinimizedState] = useState<boolean>(() => readMinimizedPreference(scopeKey));

    const setActiveMeetingCallId = useCallback((callId: string | null) => {
        setActiveMeetingCallIdState(callId);
        writeActiveMeetingCallId(scopeKey, callId);
    }, [scopeKey]);

    const setIsMeetingMinimized = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
        setIsMeetingMinimizedState((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            writeMinimizedPreference(scopeKey, next);
            return next;
        });
    }, [scopeKey]);

    useEffect(() => {
        setActiveMeetingCallIdState(readActiveMeetingCallId(scopeKey));
        setIsMeetingMinimizedState(readMinimizedPreference(scopeKey));
    }, [scopeKey]);

    useEffect(() => {
        const callId = readActiveMeetingCallId(scopeKey);
        if (!callId) {
            return;
        }

        let cancelled = false;

        void (async () => {
            try {
                const res = await fetch(
                    `/api/meetings/by-id/${encodeURIComponent(callId)}/status`,
                    { credentials: 'include' }
                );

                if (cancelled) {
                    return;
                }

                if (!res.ok) {
                    clearStoredMeetingSession(scopeKey);
                    setActiveMeetingCallIdState(null);
                    setIsMeetingMinimizedState(false);
                    return;
                }

                const data = await res.json() as {
                    status?: string;
                    timeExceeded?: boolean;
                };

                const isJoinable =
                    Boolean(data.status) &&
                    JOINABLE_MEETING_STATUSES.has(data.status!) &&
                    !data.timeExceeded;

                if (!isJoinable) {
                    clearStoredMeetingSession(scopeKey);
                    setActiveMeetingCallIdState(null);
                    setIsMeetingMinimizedState(false);
                }
            } catch {
                // Keep the stored session on transient network errors.
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [scopeKey]);

    const startMeeting = useCallback((callId: string) => {
        setActiveMeetingCallId(callId);
        setIsMeetingMinimized(false);
    }, [setActiveMeetingCallId, setIsMeetingMinimized]);

    const endMeeting = useCallback(() => {
        clearStoredMeetingSession(scopeKey);
        setActiveMeetingCallIdState(null);
        setIsMeetingMinimizedState(false);
    }, [scopeKey]);

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
