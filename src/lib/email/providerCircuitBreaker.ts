const MAX_CONSECUTIVE_FAILURES = 5;
const MAX_AUTOMATIC_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;

type CircuitState = {
  consecutiveFailures: number;
  pausedUntil: number;
  lastFingerprint?: string;
  attemptsForCurrent: number;
};

const circuits = new Map<string, CircuitState>();

function circuitKey(tenantId: string, provider: string, operation: string): string {
  return `${tenantId}:${provider}:${operation}`;
}

export class ProviderCircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderCircuitOpenError';
  }
}

export function assertProviderCircuitClosed(
  tenantId: string,
  provider: string,
  operation: string,
): void {
  const state = circuits.get(circuitKey(tenantId, provider, operation));
  if (!state) return;
  if (Date.now() < state.pausedUntil) {
    throw new ProviderCircuitOpenError(
      `${provider} ${operation} is temporarily paused after repeated failures. Reconnect the integration or retry later.`,
    );
  }
}

export function getRetryDelayMs(attemptNumber: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attemptNumber - 1), 30000);
}

export function shouldRetryProviderOperation(attemptNumber: number): boolean {
  return attemptNumber < MAX_AUTOMATIC_RETRIES;
}

export function recordProviderFailure(params: {
  tenantId: string;
  provider: string;
  operation: string;
  fingerprint: string;
}): { paused: boolean; consecutiveFailures: number; attempts: number } {
  const key = circuitKey(params.tenantId, params.provider, params.operation);
  const existing = circuits.get(key) || {
    consecutiveFailures: 0,
    pausedUntil: 0,
    attemptsForCurrent: 0,
  };

  const sameFingerprint = existing.lastFingerprint === params.fingerprint;
  const attempts = sameFingerprint ? existing.attemptsForCurrent + 1 : 1;
  const consecutiveFailures = sameFingerprint ? existing.consecutiveFailures + 1 : 1;
  const paused = consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;

  circuits.set(key, {
    consecutiveFailures,
    pausedUntil: paused ? Date.now() + 15 * 60 * 1000 : 0,
    lastFingerprint: params.fingerprint,
    attemptsForCurrent: attempts,
  });

  return { paused, consecutiveFailures, attempts };
}

export function recordProviderSuccess(tenantId: string, provider: string, operation: string): void {
  circuits.delete(circuitKey(tenantId, provider, operation));
}

export function resetProviderCircuit(tenantId: string, provider: string, operation: string): void {
  circuits.delete(circuitKey(tenantId, provider, operation));
}

export function getProviderCircuitSnapshot(tenantId: string, provider: string, operation: string) {
  return circuits.get(circuitKey(tenantId, provider, operation)) || null;
}
