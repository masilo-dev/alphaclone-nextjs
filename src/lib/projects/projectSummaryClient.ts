export interface ProjectV2SummaryResponse {
  project: {
    id: string;
    name: string;
    description?: string | null;
    clientId?: string | null;
    dealId?: string | null;
    contractId?: string | null;
    ownerUserId?: string | null;
    status?: string | null;
    stage?: string | null;
    priority?: string | null;
    startDate?: string | null;
    deadline?: string | null;
    progress: number;
    health: string;
    healthReasons: string[];
  };
  summary: {
    nextMilestone: Record<string, unknown> | null;
    nextAction: Record<string, unknown> | null;
    taskCounts: { total: number; completed: number; overdue: number };
    milestoneCounts: { total: number; overdue: number };
    blockers: Array<Record<string, unknown>>;
    finance: {
      contractValue: number;
      invoiced: number;
      paid: number;
      outstanding: number;
      currency: string;
    };
  };
  relationships: Array<Record<string, unknown>>;
  activity: Array<Record<string, unknown>>;
  generatedAt: string;
}

export async function loadProjectV2Summary(tenantId: string, projectId: string): Promise<ProjectV2SummaryResponse> {
  const response = await fetch(
    `/api/tenant/${encodeURIComponent(tenantId)}/projects/${encodeURIComponent(projectId)}/summary`,
    { method: 'GET', cache: 'no-store' },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Project summary could not be loaded');
  }
  return payload as ProjectV2SummaryResponse;
}
