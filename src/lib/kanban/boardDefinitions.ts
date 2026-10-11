/**
 * Standard Board Definitions & Column Specifications.
 * Adheres strictly to:
 * - Clear single unit of work per board.
 * - States of work (not actions).
 * - Explicit entry/exit rules and terminal outcomes.
 * - Default WIP limits per column to prevent bottle-necking.
 */

import { BoardDefinition, BoardType } from './boardModel';

export const CRM_DEALS_BOARD_DEFINITION: BoardDefinition = {
  boardType: 'crm_deals',
  title: 'Deal Sales Pipeline',
  description: 'Enterprise revenue pipeline for commercial opportunities.',
  cardUnitName: 'Deal',
  defaultClassOfService: 'standard',
  terminalStates: ['closed_won', 'closed_lost'],
  commitmentState: 'qualified',
  columns: [
    {
      id: 'lead',
      title: 'Lead / Inbound',
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      wipLimit: 30,
      isTerminal: false,
      allowedTransitions: ['qualified', 'closed_lost'],
      agingThresholdHours: 72, // 3 days
    },
    {
      id: 'qualified',
      title: 'Qualified',
      color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      wipLimit: 15,
      isTerminal: false,
      requiredFields: ['owner_id', 'next_action', 'next_action_date'],
      allowedTransitions: ['lead', 'proposal', 'closed_lost'],
      agingThresholdHours: 120, // 5 days
    },
    {
      id: 'proposal',
      title: 'Proposal Delivered',
      color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      wipLimit: 10,
      isTerminal: false,
      requiredFields: ['value', 'owner_id', 'next_action', 'next_action_date'],
      allowedTransitions: ['qualified', 'negotiation', 'closed_lost'],
      agingThresholdHours: 168, // 7 days
    },
    {
      id: 'negotiation',
      title: 'Under Negotiation',
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      wipLimit: 6,
      isTerminal: false,
      requiredFields: ['value', 'owner_id', 'next_action', 'next_action_date'],
      allowedTransitions: ['proposal', 'closed_won', 'closed_lost'],
      agingThresholdHours: 240, // 10 days
    },
    {
      id: 'closed_won',
      title: 'Closed Won',
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      wipLimit: null,
      isTerminal: true,
      terminalType: 'won',
      mandatoryReasonOnEntry: false,
      allowedTransitions: [], // Terminal locked
    },
    {
      id: 'closed_lost',
      title: 'Closed Lost',
      color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      wipLimit: null,
      isTerminal: true,
      terminalType: 'lost',
      mandatoryReasonOnEntry: true,
      allowedTransitions: [], // Terminal locked
    },
  ],
};

export const CRM_LEADS_BOARD_DEFINITION: BoardDefinition = {
  boardType: 'crm_leads',
  title: 'Lead Discovery & Prospecting',
  description: 'Qualification funnel for prospective companies and candidates.',
  cardUnitName: 'Lead',
  defaultClassOfService: 'standard',
  terminalStates: ['converted', 'archived'],
  commitmentState: 'qualified',
  columns: [
    {
      id: 'lead',
      title: 'Discovered',
      color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      wipLimit: 50,
      isTerminal: false,
      allowedTransitions: ['qualified', 'archived'],
      agingThresholdHours: 48,
    },
    {
      id: 'qualified',
      title: 'Verified ICP',
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      wipLimit: 25,
      isTerminal: false,
      allowedTransitions: ['lead', 'proposal', 'converted', 'archived'],
      agingThresholdHours: 96,
    },
    {
      id: 'proposal',
      title: 'Outreach Contacted',
      color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      wipLimit: 20,
      isTerminal: false,
      allowedTransitions: ['qualified', 'negotiation', 'converted', 'archived'],
      agingThresholdHours: 120,
    },
    {
      id: 'negotiation',
      title: 'In Dialogue',
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      wipLimit: 10,
      isTerminal: false,
      allowedTransitions: ['proposal', 'converted', 'archived'],
      agingThresholdHours: 168,
    },
    {
      id: 'converted',
      title: 'Converted to Deal',
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      wipLimit: null,
      isTerminal: true,
      terminalType: 'won',
      allowedTransitions: [],
    },
    {
      id: 'archived',
      title: 'Disqualified / Unresponsive',
      color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      wipLimit: null,
      isTerminal: true,
      terminalType: 'lost',
      mandatoryReasonOnEntry: true,
      allowedTransitions: [],
    },
  ],
};

export const WORKSPACE_TASKS_BOARD_DEFINITION: BoardDefinition = {
  boardType: 'workspace_tasks',
  title: 'Workspace Tasks Kanban',
  description: 'Team task workflow with explicit WIP limits and rework loops.',
  cardUnitName: 'Task',
  defaultClassOfService: 'standard',
  terminalStates: ['completed', 'cancelled'],
  commitmentState: 'todo',
  columns: [
    {
      id: 'ideas',
      title: 'Ideas & Backlog',
      color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      wipLimit: 50,
      isTerminal: false,
      allowedTransitions: ['todo', 'cancelled'],
      agingThresholdHours: 336, // 14 days
    },
    {
      id: 'todo',
      title: 'Ready / To Do',
      color: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      wipLimit: 15,
      isTerminal: false,
      allowedTransitions: ['ideas', 'in_progress', 'cancelled'],
      agingThresholdHours: 120,
    },
    {
      id: 'in_progress',
      title: 'Active / In Progress',
      color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      wipLimit: 8,
      isTerminal: false,
      allowedTransitions: ['todo', 'review', 'cancelled'],
      agingThresholdHours: 72,
    },
    {
      id: 'review',
      title: 'Review / Verification',
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      wipLimit: 5,
      isTerminal: false,
      // NOTE: Standard 5 allows moving back to in_progress for rework
      allowedTransitions: ['in_progress', 'completed', 'cancelled'],
      agingThresholdHours: 48,
    },
    {
      id: 'completed',
      title: 'Done / Completed',
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      wipLimit: null,
      isTerminal: true,
      terminalType: 'completed',
      allowedTransitions: [],
    },
    {
      id: 'cancelled',
      title: 'Cancelled',
      color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      wipLimit: null,
      isTerminal: true,
      terminalType: 'cancelled',
      mandatoryReasonOnEntry: true,
      allowedTransitions: [],
    },
  ],
};

export const PROJECT_TASKS_BOARD_DEFINITION: BoardDefinition = {
  boardType: 'project_tasks',
  title: 'Project Deliverables Kanban',
  description: 'Deliverables tracking scoped to customer project milestones.',
  cardUnitName: 'Project Task',
  defaultClassOfService: 'standard',
  terminalStates: ['completed', 'cancelled'],
  commitmentState: 'todo',
  columns: [
    {
      id: 'ideas',
      title: 'Project Backlog',
      color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      wipLimit: 40,
      isTerminal: false,
      allowedTransitions: ['todo', 'cancelled'],
      agingThresholdHours: 240,
    },
    {
      id: 'todo',
      title: 'Sprint To Do',
      color: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      wipLimit: 12,
      isTerminal: false,
      allowedTransitions: ['ideas', 'in_progress', 'cancelled'],
      agingThresholdHours: 96,
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      wipLimit: 6,
      isTerminal: false,
      allowedTransitions: ['todo', 'review', 'cancelled'],
      agingThresholdHours: 48,
    },
    {
      id: 'review',
      title: 'Client Review / QA',
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      wipLimit: 4,
      isTerminal: false,
      allowedTransitions: ['in_progress', 'completed', 'cancelled'],
      agingThresholdHours: 48,
    },
    {
      id: 'completed',
      title: 'Accepted & Done',
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      wipLimit: null,
      isTerminal: true,
      terminalType: 'completed',
      allowedTransitions: [],
    },
    {
      id: 'cancelled',
      title: 'Cancelled / Shelved',
      color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      wipLimit: null,
      isTerminal: true,
      terminalType: 'cancelled',
      mandatoryReasonOnEntry: true,
      allowedTransitions: [],
    },
  ],
};

export const ONBOARDING_BOARD_DEFINITION: BoardDefinition = {
  boardType: 'onboarding',
  title: 'Customer Onboarding Journey',
  description: 'Structured customer onboarding milestones from kickoff to handoff.',
  cardUnitName: 'Account',
  defaultClassOfService: 'standard',
  terminalStates: ['completed', 'abandoned'],
  commitmentState: 'kickoff',
  columns: [
    {
      id: 'kickoff',
      title: 'Kickoff Scheduled',
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      wipLimit: 10,
      isTerminal: false,
      allowedTransitions: ['data_collection', 'abandoned'],
      agingThresholdHours: 72,
    },
    {
      id: 'data_collection',
      title: 'Asset & Data Collection',
      color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      wipLimit: 8,
      isTerminal: false,
      allowedTransitions: ['kickoff', 'technical_setup', 'abandoned'],
      agingThresholdHours: 120,
    },
    {
      id: 'technical_setup',
      title: 'System Provisioning',
      color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      wipLimit: 6,
      isTerminal: false,
      allowedTransitions: ['data_collection', 'training', 'abandoned'],
      agingThresholdHours: 96,
    },
    {
      id: 'training',
      title: 'User Enablement & Training',
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      wipLimit: 5,
      isTerminal: false,
      allowedTransitions: ['technical_setup', 'live_review', 'abandoned'],
      agingThresholdHours: 120,
    },
    {
      id: 'live_review',
      title: 'Initial Live Review',
      color: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      wipLimit: 5,
      isTerminal: false,
      allowedTransitions: ['training', 'completed', 'abandoned'],
      agingThresholdHours: 72,
    },
    {
      id: 'completed',
      title: 'Graduated / Live',
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      wipLimit: null,
      isTerminal: true,
      terminalType: 'completed',
      allowedTransitions: [],
    },
    {
      id: 'abandoned',
      title: 'Stalled / Abandoned',
      color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      wipLimit: null,
      isTerminal: true,
      terminalType: 'abandoned',
      mandatoryReasonOnEntry: true,
      allowedTransitions: [],
    },
  ],
};

export const BOARD_DEFINITIONS: Record<BoardType, BoardDefinition> = {
  crm_deals: CRM_DEALS_BOARD_DEFINITION,
  crm_leads: CRM_LEADS_BOARD_DEFINITION,
  workspace_tasks: WORKSPACE_TASKS_BOARD_DEFINITION,
  project_tasks: PROJECT_TASKS_BOARD_DEFINITION,
  onboarding: ONBOARDING_BOARD_DEFINITION,
};

export function getBoardDefinition(boardType: BoardType): BoardDefinition {
  const def = BOARD_DEFINITIONS[boardType];
  if (!def) {
    throw new Error(`Unknown board type: ${boardType}`);
  }
  return def;
}
