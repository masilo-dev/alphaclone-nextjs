import { DailyCall } from '@daily-co/daily-js';

/**
 * Send audit data to the current Daily meeting.
 * Uses Daily's sendAppMessage to broadcast to all participants.
 */
export function sendAuditToMeeting(
  callObject: DailyCall | null,
  auditData: {
    source: string; // e.g., 'accounting', 'notification', 'workflow'
    type: string;
    details: Record<string, unknown>;
    timestamp: string;
  }
): void {
  if (!callObject) {
    console.warn('[meetingAudit] No call object available, cannot send audit');
    return;
  }

  try {
    callObject.sendAppMessage(
      {
        type: 'audit-event',
        payload: auditData,
      },
      '*' // send to all participants
    );
    console.log('[meetingAudit] Audit sent to meeting:', auditData.source);
  } catch (err) {
    console.error('[meetingAudit] Failed to send audit:', err);
  }
}
