export const PROJECT_STATUSES = [
  "Active",
  "Pending",
  "Completed",
  "Declined",
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
  "cancelled",
] as const;

export const PROJECT_STAGES = [
  "Discovery",
  "Design",
  "Development",
  "Testing",
  "Deployment",
  "Maintenance",
  "Initiation",
  "Planning",
  "Execution",
  "Review",
  "Closure",
  "Proposal",
] as const;

const STATUS_ALIASES: Record<string, (typeof PROJECT_STATUSES)[number]> = {
  active: "Active",
  pending: "Pending",
  completed: "Completed",
  complete: "Completed",
  declined: "Declined",
  archived: "cancelled",
  canceled: "cancelled",
  cancelled: "cancelled",
  backlog: "backlog",
  todo: "todo",
  "to do": "todo",
  in_progress: "in_progress",
  "in progress": "in_progress",
  review: "review",
  done: "done",
};

export const CANONICAL_PROJECT_STAGES = [
  "Initiation",
  "Planning",
  "Execution",
  "Review",
  "Closure",
] as const;

export type CanonicalProjectStage = (typeof CANONICAL_PROJECT_STAGES)[number];

export const STAGE_LIFECYCLE_STEP: Record<
  CanonicalProjectStage,
  { step: number; total: 5; label: string; order: number }
> = {
  Initiation: { step: 1, total: 5, label: "Step 1/5", order: 1 },
  Planning: { step: 2, total: 5, label: "Step 2/5", order: 2 },
  Execution: { step: 3, total: 5, label: "Step 3/5", order: 3 },
  Review: { step: 4, total: 5, label: "Step 4/5", order: 4 },
  Closure: { step: 5, total: 5, label: "Step 5/5", order: 5 },
};

const STAGE_ALIASES: Record<string, (typeof PROJECT_STAGES)[number]> = {
  discovery: "Discovery",
  design: "Design",
  development: "Development",
  testing: "Testing",
  deployment: "Deployment",
  maintenance: "Maintenance",
  initiation: "Initiation",
  kickoff: "Initiation",
  "kick off": "Initiation",
  planning: "Planning",
  execution: "Execution",
  review: "Review",
  closure: "Closure",
  proposal: "Proposal",
};

/**
 * Maps any legacy or template stage to its canonical 5-step lifecycle stage.
 * Explicitly separates project status ('Active', 'Pending', etc.) from lifecycle stage.
 */
export function toCanonicalProjectStage(
  stage?: string | null,
): CanonicalProjectStage {
  if (!stage) return "Initiation";
  const trimmed = stage.trim().toLowerCase();
  const canonicalMap: Record<string, CanonicalProjectStage> = {
    initiation: "Initiation",
    discovery: "Initiation",
    proposal: "Initiation",
    kickoff: "Initiation",
    "kick off": "Initiation",
    planning: "Planning",
    design: "Planning",
    execution: "Execution",
    development: "Execution",
    review: "Review",
    testing: "Review",
    closure: "Closure",
    deployment: "Closure",
    completed: "Closure",
    maintenance: "Closure",
  };
  return canonicalMap[trimmed] || "Initiation";
}

export function normalizeProjectStatus(value: string): string | null {
  const trimmed = value.trim();
  if ((PROJECT_STATUSES as readonly string[]).includes(trimmed)) return trimmed;
  return STATUS_ALIASES[trimmed.toLowerCase()] || null;
}

export function normalizeProjectStage(value: string): string | null {
  const trimmed = value.trim();
  if ((PROJECT_STAGES as readonly string[]).includes(trimmed)) return trimmed;
  return STAGE_ALIASES[trimmed.toLowerCase()] || null;
}

const FINISHED_STATUSES = new Set(["Completed", "done"]);
const FINISHED_STAGES = new Set(["Closure", "Completed"]);

export function isFinishedProjectStatus(status?: string | null): boolean {
  if (!status) return false;
  const normalized = normalizeProjectStatus(status) ?? status.trim();
  return FINISHED_STATUSES.has(normalized);
}

export function isFinishedProjectStage(stage?: string | null): boolean {
  if (!stage) return false;
  const normalized = normalizeProjectStage(stage) ?? stage.trim();
  return FINISHED_STAGES.has(normalized);
}

export function isFinishedProject(input: {
  status?: string | null;
  currentStage?: string | null;
  current_stage?: string | null;
}): boolean {
  return (
    isFinishedProjectStatus(input.status) ||
    isFinishedProjectStage(input.currentStage ?? input.current_stage)
  );
}

/** Fields written when the owner marks a project finished (Closure / Completed). */
export function finishedProjectWriteFields(
  now: Date = new Date(),
): { status: "Completed"; current_stage: "Closure"; progress: 100; estimated_completion_date: string } {
  return {
    status: "Completed",
    current_stage: "Closure",
    progress: 100,
    estimated_completion_date: now.toISOString().slice(0, 10),
  };
}

function itemIsComplete(status?: string | null): boolean {
  const value = String(status || "").trim().toLowerCase();
  return value === "completed" || value === "done" || value === "cancelled";
}

/**
 * Progress for a live project. Tasks win when any exist so leftover template
 * milestones cannot keep a finished job at 0%. A project already marked
 * finished stays at 100 so recalc cannot reopen it.
 */
export function computeProjectProgressPercent(input: {
  status?: string | null;
  currentStage?: string | null;
  current_stage?: string | null;
  milestones?: Array<{ status?: string | null }> | null;
  tasks?: Array<{ status?: string | null }> | null;
}): number {
  if (isFinishedProject(input)) return 100;
  const tasks = input.tasks ?? [];
  const milestones = input.milestones ?? [];
  const source = tasks.length > 0 ? tasks : milestones;
  if (!source.length) return 0;
  const done = source.filter((item) => itemIsComplete(item.status)).length;
  return Math.round((done / source.length) * 100);
}
