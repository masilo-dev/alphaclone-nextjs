/** Hard cap for AlphaClone-hosted (Daily/LiveKit) meetings. */
export const MAX_MEETING_DURATION_MINUTES = 40;

export function meetingEndTimeFromNow(minutes = MAX_MEETING_DURATION_MINUTES): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
}
