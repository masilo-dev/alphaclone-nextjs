import { initializeRegistry, executeTool } from '@/lib/mcp/tool-registry';

export type PlatformAdvantageSnapshot = {
  generatedAt: string;
  autopilot: unknown;
  revenueRecovery: unknown;
  clientPulse: unknown;
  timeSavings: unknown;
  readiness: unknown;
  errors: string[];
};

function parseToolJson(result: { content?: Array<{ text?: string }>; isError?: boolean }): unknown {
  const chunk = result.content?.[0]?.text;
  if (!chunk) return null;
  try {
    return JSON.parse(chunk);
  } catch {
    return { message: chunk.slice(0, 4000) };
  }
}

async function runReadTool(
  tenantId: string,
  userId: string,
  tool: string,
  args: Record<string, unknown>
): Promise<{ tool: string; data: unknown; error?: string }> {
  initializeRegistry();
  try {
    const result = await executeTool(tenantId, userId, tool, args);
    if (result.isError) {
      return { tool, data: null, error: parseToolJson(result)?.toString() || 'Tool error' };
    }
    return { tool, data: parseToolJson(result) };
  } catch (err: unknown) {
    return { tool, data: null, error: err instanceof Error ? err.message : 'Tool failed' };
  }
}

export async function fetchPlatformAdvantageSnapshot(
  tenantId: string,
  userId: string
): Promise<PlatformAdvantageSnapshot> {
  const baseArgs = { tenant_id: tenantId };
  const errors: string[] = [];

  const [autopilot, revenueRecovery, clientPulse, timeSavings, readiness] = await Promise.all([
    runReadTool(tenantId, userId, 'owner_autopilot_queue', { ...baseArgs, lookback_days: 30 }),
    runReadTool(tenantId, userId, 'revenue_recovery_agent', { ...baseArgs, lookback_days: 90 }),
    runReadTool(tenantId, userId, 'client_pulse', { ...baseArgs, lookback_days: 30 }),
    runReadTool(tenantId, userId, 'solo_owner_time_savings_meter', { ...baseArgs, lookback_days: 30 }),
    runReadTool(tenantId, userId, 'ai_business_readiness_score', baseArgs),
  ]);

  for (const row of [autopilot, revenueRecovery, clientPulse, timeSavings, readiness]) {
    if (row.error) errors.push(`${row.tool}: ${row.error}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    autopilot: autopilot.data,
    revenueRecovery: revenueRecovery.data,
    clientPulse: clientPulse.data,
    timeSavings: timeSavings.data,
    readiness: readiness.data,
    errors,
  };
}
