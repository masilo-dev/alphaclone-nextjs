/**
 * Integration circuit breaker — prevents retry storms against failing external APIs.
 */

import { logRateLimited } from '@/lib/runtime/logRateLimit';

type CircuitState = {
  consecutiveFailures: number;
  pausedUntil: number;
  lastError?: string;
};

const circuits = new Map<string, CircuitState>();
const MAX_ENTRIES = 2_000;

const DEFAULT_FAILURE_THRESHOLD = Number(process.env.CIRCUIT_BREAKER_THRESHOLD || 5);
const DEFAULT_COOLDOWN_MS = Number(process.env.CIRCUIT_BREAKER_COOLDOWN_MS || 5 * 60_000);

export class IntegrationCircuitOpenError extends Error {
  readonly integration: string;
  readonly retryAfterMs: number;

  constructor(integration: string, retryAfterMs: number) {
    super(`${integration} is temporarily unavailable (circuit open). Retry after cooldown.`);
    this.name = 'IntegrationCircuitOpenError';
    this.integration = integration;
    this.retryAfterMs = retryAfterMs;
  }
}

function circuitKey(integration: string, scope?: string): string {
  return scope ? `${integration}:${scope}` : integration;
}

function trimMap(): void {
  if (circuits.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, state] of circuits) {
    if (state.pausedUntil < now && state.consecutiveFailures === 0) {
      circuits.delete(key);
    }
  }
}

export function assertIntegrationCircuitClosed(
  integration: string,
  scope?: string
): void {
  const key = circuitKey(integration, scope);
  const state = circuits.get(key);
  if (!state) return;
  const now = Date.now();
  if (now < state.pausedUntil) {
    throw new IntegrationCircuitOpenError(integration, state.pausedUntil - now);
  }
  if (state.pausedUntil > 0 && now >= state.pausedUntil) {
    circuits.delete(key);
  }
}

export function recordIntegrationFailure(
  integration: string,
  err: unknown,
  scope?: string
): { open: boolean; consecutiveFailures: number } {
  trimMap();
  const key = circuitKey(integration, scope);
  const message = err instanceof Error ? err.message : String(err);
  const existing = circuits.get(key) || { consecutiveFailures: 0, pausedUntil: 0 };
  const consecutiveFailures = existing.consecutiveFailures + 1;
  const open = consecutiveFailures >= DEFAULT_FAILURE_THRESHOLD;

  circuits.set(key, {
    consecutiveFailures,
    pausedUntil: open ? Date.now() + DEFAULT_COOLDOWN_MS : 0,
    lastError: message.slice(0, 200),
  });

  if (open) {
    logRateLimited(
      `circuit:open:${key}`,
      'warn',
      `[circuit-breaker] ${integration} circuit opened`,
      { consecutiveFailures, scope }
    );
  }

  return { open, consecutiveFailures };
}

export function recordIntegrationSuccess(integration: string, scope?: string): void {
  circuits.delete(circuitKey(integration, scope));
}

export function getIntegrationCircuitState(integration: string, scope?: string) {
  return circuits.get(circuitKey(integration, scope)) ?? null;
}

export function resetIntegrationCircuit(integration: string, scope?: string): void {
  circuits.delete(circuitKey(integration, scope));
}
