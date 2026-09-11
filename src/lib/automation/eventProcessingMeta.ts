/**
 * Poison-pill protection for `business_automation_events`.
 *
 * The events table has no attempts column, so the dispatcher stamps attempt
 * bookkeeping into `payload._processing` *before* doing any heavy work. If the
 * process dies mid-event (OOM, redeploy, timeout) the stamp survives, and after
 * MAX_EVENT_ATTEMPTS the event is abandoned instead of being retried forever.
 *
 * Sep 2026 incident: one `ticket_created` event triggered a Bonnie cognitive run
 * that OOM-crashed the server; because the event was only marked processed on
 * success, it was re-run every 5 minutes for over a week, and the 400+ events
 * queued behind it were never dispatched.
 */

export const PROCESSING_META_KEY = '_processing';
export const MAX_EVENT_ATTEMPTS = 3;

export type EventProcessingMeta = {
  attempts: number;
  last_attempt_at?: string;
  last_error?: string;
  abandoned_at?: string;
  abandon_reason?: string;
};

type PayloadWithMeta = Record<string, unknown> & { [PROCESSING_META_KEY]?: unknown };

export function readProcessingMeta(payload: unknown): EventProcessingMeta {
  const raw = (payload as PayloadWithMeta | null | undefined)?.[PROCESSING_META_KEY];
  if (!raw || typeof raw !== 'object') return { attempts: 0 };
  const meta = raw as Partial<EventProcessingMeta>;
  const attempts = Number(meta.attempts);
  return {
    ...meta,
    attempts: Number.isFinite(attempts) && attempts > 0 ? Math.floor(attempts) : 0,
  };
}

/** Payload as workflows/Bonnie should see it — bookkeeping removed. */
export function stripProcessingMeta(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const { [PROCESSING_META_KEY]: _meta, ...rest } = payload as PayloadWithMeta;
  return rest;
}

/** True when the event has already used up its retry budget. */
export function hasExhaustedAttempts(payload: unknown, max = MAX_EVENT_ATTEMPTS): boolean {
  return readProcessingMeta(payload).attempts >= max;
}

/** New payload recording one more attempt (call BEFORE processing the event). */
export function stampAttempt(payload: unknown, now = new Date()): Record<string, unknown> {
  const meta = readProcessingMeta(payload);
  return {
    ...stripProcessingMeta(payload),
    [PROCESSING_META_KEY]: {
      ...meta,
      attempts: meta.attempts + 1,
      last_attempt_at: now.toISOString(),
    },
  };
}

/** New payload recording a handled failure for the current attempt. */
export function stampFailure(payload: unknown, error: string): Record<string, unknown> {
  const meta = readProcessingMeta(payload);
  return {
    ...stripProcessingMeta(payload),
    [PROCESSING_META_KEY]: { ...meta, last_error: error.slice(0, 500) },
  };
}

/** New payload marking the event as permanently abandoned. */
export function stampAbandoned(payload: unknown, reason: string, now = new Date()): Record<string, unknown> {
  const meta = readProcessingMeta(payload);
  return {
    ...stripProcessingMeta(payload),
    [PROCESSING_META_KEY]: {
      ...meta,
      abandoned_at: now.toISOString(),
      abandon_reason: reason,
    },
  };
}
