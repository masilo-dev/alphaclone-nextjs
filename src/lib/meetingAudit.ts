import { DailyCall } from '@daily-co/daily-js';

/**
 * Sends an audit/analytics event to a meeting session.
 * Stub implementation – extend as needed for your audit backend.
 */
export async function sendAuditToMeeting(
  callObject: DailyCall | null,
  event: {
    type: string;
    [key: string]: unknown;
  }
): Promise<void> {
  if (!callObject) return;
  try {
    // Emit a custom app-message so remote participants / recording bots can log it
    callObject.sendAppMessage({ audit: event }, '*');
  } catch {
    // Non-critical – silently ignore if the call is already torn down
  }
}
