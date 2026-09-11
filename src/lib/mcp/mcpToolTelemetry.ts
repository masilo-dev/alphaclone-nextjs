import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const UNKNOWN_TOOL = '_unknown_tool';

export function normalizeToolName(toolName: string | null | undefined): string {
  const trimmed = String(toolName || '').trim();
  return trimmed || UNKNOWN_TOOL;
}

export async function logMcpToolExecution(params: {
  tenantId: string;
  userId?: string | null;
  toolName: string;
  durationMs: number;
  success: boolean;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const toolName = normalizeToolName(params.toolName);
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const expiresAt = new Date(Date.now() + 1000 * 60).toISOString();
    await supabaseAdmin.from('mcp_sessions').insert({
      tenant_id: params.tenantId,
      user_id: params.userId || null,
      expires_at: expiresAt,
      tool_name: toolName,
      duration_ms: params.durationMs,
      tool_latency_ms: params.durationMs,
      success: params.success,
      tool_success: params.success,
      error_message: params.errorMessage || null,
      metadata: params.metadata || {},
    });
  } catch (logErr) {
    console.error(`[mcpToolTelemetry] Failed to log ${toolName}:`, logErr);
  }
}
