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
