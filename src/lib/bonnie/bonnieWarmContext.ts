import { getBonnieWorkspaceSnapshot } from '@/lib/bonnie/bonnieWorkspaceSnapshot';
import { executeSingleBonnieTool } from '@/lib/bonnie/executeSingleBonnieTool';
import { BONNIE_MODULE_DATA_TOOLS } from '@/lib/bonnie/bonnieTenantDataRules';
import type { BonnieModuleId } from '@/lib/bonnie/bonnieToolCatalog';
import type { BonnieToolResult } from '@/lib/bonnie/bonnieToolTypes';

/**
 * Pre-load workspace context so Bonnie answers with facts, not "let me check" hedging.
 */
export async function warmBonnieWorkspaceContext(
  tenantId: string,
  userId: string,
  moduleId: BonnieModuleId
): Promise<{
  snapshot: Awaited<ReturnType<typeof getBonnieWorkspaceSnapshot>>;
  warmResults: BonnieToolResult[];
}> {
  const snapshot = await getBonnieWorkspaceSnapshot(tenantId);

  const summaryPromise = executeSingleBonnieTool({
    tenantId,
    userId,
    tool: 'summarize_workspace',
  });

  const moduleTool = (BONNIE_MODULE_DATA_TOOLS[moduleId] || BONNIE_MODULE_DATA_TOOLS.general)[0];
  const modulePromise =
    moduleTool && moduleTool !== 'summarize_workspace'
      ? executeSingleBonnieTool({
          tenantId,
          userId,
          tool: moduleTool,
          args: { tenant_id: tenantId, user_id: userId, limit: 10 },
        }).catch(() => null)
      : Promise.resolve(null);

  const [summary, modResult] = await Promise.all([summaryPromise, modulePromise]);
  const warmResults: BonnieToolResult[] = [summary];
  if (modResult) warmResults.push(modResult);

  return { snapshot, warmResults };
}

export function formatWarmContextBlock(
  snapshot: Awaited<ReturnType<typeof getBonnieWorkspaceSnapshot>>,
  warmResults: BonnieToolResult[]
): string {
  const lines = [
    `Tenant ${snapshot.tenant_id} — live workspace: ${snapshot.module_summary}`,
    `Counts: ${JSON.stringify(snapshot.counts)}`,
  ];
  for (const r of warmResults) {
    if (r.success) {
      lines.push(`${r.tool}: ${r.summary}${r.details ? ` — ${String(r.details).slice(0, 400)}` : ''}`);
    }
  }
  return lines.join('\n');
}
