import type { BonnieToolResult } from '@/lib/bonnie/bonnieToolTypes';

export type BonnieToolApiShape = {
  tool: string;
  success: boolean;
  summary: string;
  approvalRequired?: boolean;
  approvalId?: string;
  riskClass?: string;
  preview?: { target?: string; draft?: string };
};

export function mapToolResultsForApi(results: BonnieToolResult[]): BonnieToolApiShape[] {
  return results.map((t) => ({
    tool: t.tool,
    success: t.success,
    summary: t.summary,
    approvalRequired: t.approvalRequired,
    approvalId: t.approvalId,
    riskClass: t.riskClass,
    preview: t.preview,
  }));
}

export function findPendingApproval(results: BonnieToolResult[]) {
  return results.find((r) => r.approvalRequired && r.approvalId);
}
