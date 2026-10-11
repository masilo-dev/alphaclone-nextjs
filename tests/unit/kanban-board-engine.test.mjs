import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateKanbanFlowMetrics,
  computePercentile,
} from '../../src/lib/kanban/flowMetricsEngine';
import { BoardPolicyService } from '../../src/lib/kanban/boardPolicyService';
import {
  CRM_DEALS_BOARD_DEFINITION,
  WORKSPACE_TASKS_BOARD_DEFINITION,
  CRM_LEADS_BOARD_DEFINITION,
} from '../../src/lib/kanban/boardDefinitions';

test('Kanban Board Engine - Comprehensive Test Suite', async (t) => {
  const tenantA = '11111111-1111-4111-8111-111111111111';
  const tenantB = '22222222-2222-4222-8222-222222222222';

  // ── TEST 1: Strict Tenant Isolation ─────────────────────────────────────────
  await t.test('Tenant Isolation: Cross-tenant transition is rejected with TENANT_MISMATCH', () => {
    const card = {
      id: 'deal-100',
      tenant_id: tenantA,
      title: 'Enterprise Contract',
      stage: 'lead',
      owner_id: 'user-1',
      entered_column_at: new Date().toISOString(),
      is_blocked: false,
      class_of_service: 'standard',
      archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const crossTenantRequest = {
      tenantId: tenantB, // Attacker attempting cross-tenant transition
      boardType: 'crm_deals',
      cardId: 'deal-100',
      targetState: 'qualified',
      actorId: 'attacker-user',
    };

    const result = BoardPolicyService.validateTransition(
      CRM_DEALS_BOARD_DEFINITION,
      card,
      crossTenantRequest,
      0
    );

    assert.equal(result.valid, false);
    assert.equal(result.errorCode, 'TENANT_MISMATCH');
    assert.match(result.message || '', /Security error/);
  });

  // ── TEST 2: State Machine Validation & Arbitrary Skips Blocked ──────────────
  await t.test('State Machine: Arbitrary stage leap from lead directly to negotiation is blocked', () => {
    const card = {
      id: 'deal-101',
      tenant_id: tenantA,
      title: 'Acme Corp Deal',
      stage: 'lead',
      owner_id: 'user-1',
      entered_column_at: new Date().toISOString(),
      is_blocked: false,
      class_of_service: 'standard',
      archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const invalidLeapRequest = {
      tenantId: tenantA,
      boardType: 'crm_deals',
      cardId: 'deal-101',
      targetState: 'negotiation', // Skipping qualified and proposal
      actorId: 'user-1',
    };

    const result = BoardPolicyService.validateTransition(
      CRM_DEALS_BOARD_DEFINITION,
      card,
      invalidLeapRequest,
      0
    );

    assert.equal(result.valid, false);
    assert.equal(result.errorCode, 'INVALID_TRANSITION');
    assert.match(result.message || '', /Illegal transition/);
  });

  // ── TEST 3: Terminal States are Locked ───────────────────────────────────────
  await t.test('Terminal States: Cannot transition closed_won or closed_lost deals back to active stages', () => {
    const closedWonCard = {
      id: 'deal-won',
      tenant_id: tenantA,
      title: 'Won Deal',
      stage: 'closed_won',
      owner_id: 'user-1',
      entered_column_at: new Date().toISOString(),
      is_blocked: false,
      class_of_service: 'standard',
      archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = BoardPolicyService.validateTransition(
      CRM_DEALS_BOARD_DEFINITION,
      closedWonCard,
      {
        tenantId: tenantA,
        boardType: 'crm_deals',
        cardId: 'deal-won',
        targetState: 'proposal',
      },
      0
    );

    assert.equal(result.valid, false);
    assert.equal(result.errorCode, 'TERMINAL_STATE_LOCKED');
    assert.match(result.message || '', /Terminal records cannot be moved/);
  });

  // ── TEST 4: Backend WIP Limit Enforcement & Logged Overrides ────────────────
  await t.test('WIP Limits: Moving into saturated column is blocked unless authorized override is logged', () => {
    const taskCard = {
      id: 'task-1',
      tenant_id: tenantA,
      title: 'Implement Auth',
      stage: 'todo',
      owner_id: 'user-1',
      entered_column_at: new Date().toISOString(),
      is_blocked: false,
      class_of_service: 'standard',
      archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 'in_progress' has a WIP limit of 8
    const saturatedCount = 8;

    // Normal member attempt without override
    const memberAttempt = BoardPolicyService.validateTransition(
      WORKSPACE_TASKS_BOARD_DEFINITION,
      taskCard,
      {
        tenantId: tenantA,
        boardType: 'workspace_tasks',
        cardId: 'task-1',
        targetState: 'in_progress',
        userRole: 'member',
      },
      saturatedCount
    );

    assert.equal(memberAttempt.valid, false);
    assert.equal(memberAttempt.errorCode, 'WIP_LIMIT_EXCEEDED');
    assert.equal(memberAttempt.isOverrideAllowed, false);

    // Admin attempt with missing override reason
    const adminNoReason = BoardPolicyService.validateTransition(
      WORKSPACE_TASKS_BOARD_DEFINITION,
      taskCard,
      {
        tenantId: tenantA,
        boardType: 'workspace_tasks',
        cardId: 'task-1',
        targetState: 'in_progress',
        userRole: 'admin',
        overrideWip: true,
        overrideReason: '', // Empty reason
      },
      saturatedCount
    );

    assert.equal(adminNoReason.valid, false);
    assert.equal(adminNoReason.errorCode, 'WIP_LIMIT_EXCEEDED');
    assert.match(adminNoReason.message || '', /logged override reason is mandatory/);

    // Admin attempt with valid override reason succeeds
    const adminValidOverride = BoardPolicyService.validateTransition(
      WORKSPACE_TASKS_BOARD_DEFINITION,
      taskCard,
      {
        tenantId: tenantA,
        boardType: 'workspace_tasks',
        cardId: 'task-1',
        targetState: 'in_progress',
        userRole: 'admin',
        overrideWip: true,
        overrideReason: 'Urgent production outage fix required immediately',
      },
      saturatedCount
    );

    assert.equal(adminValidOverride.valid, true);
  });

  // ── TEST 5: CRM Next Action & Next Action Date Mandate ──────────────────────
  await t.test('CRM Guards: Open deal advancement requires scheduled next action and date', () => {
    const dealWithoutNextAction = {
      id: 'deal-200',
      tenant_id: tenantA,
      title: 'Prospect A',
      stage: 'lead',
      owner_id: 'user-1',
      next_action: null,
      next_action_date: null,
      entered_column_at: new Date().toISOString(),
      is_blocked: false,
      class_of_service: 'standard',
      archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Advance to qualified without next action
    const invalidAdvance = BoardPolicyService.validateTransition(
      CRM_DEALS_BOARD_DEFINITION,
      dealWithoutNextAction,
      {
        tenantId: tenantA,
        boardType: 'crm_deals',
        cardId: 'deal-200',
        targetState: 'qualified',
      },
      0
    );

    assert.equal(invalidAdvance.valid, false);
    assert.equal(invalidAdvance.errorCode, 'MISSING_REQUIRED_FIELD');
    assert.match(invalidAdvance.message || '', /scheduled next action/);

    // Advance to qualified with next action and date
    const validAdvance = BoardPolicyService.validateTransition(
      CRM_DEALS_BOARD_DEFINITION,
      dealWithoutNextAction,
      {
        tenantId: tenantA,
        boardType: 'crm_deals',
        cardId: 'deal-200',
        targetState: 'qualified',
        cardUpdates: {
          nextAction: 'Discovery call with VP Engineering',
          nextActionDate: '2026-10-15T10:00:00Z',
        },
      },
      0
    );

    assert.equal(validAdvance.valid, true);
  });

  // ── TEST 6: Terminal Reason Required for Lost Deals & Cancelled Tasks ───────
  await t.test('Terminal Reasons: Moving to closed_lost requires a mandatory loss reason', () => {
    const activeDeal = {
      id: 'deal-300',
      tenant_id: tenantA,
      title: 'Company Beta',
      stage: 'qualified',
      owner_id: 'user-1',
      entered_column_at: new Date().toISOString(),
      is_blocked: false,
      class_of_service: 'standard',
      archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Missing reason
    const noReason = BoardPolicyService.validateTransition(
      CRM_DEALS_BOARD_DEFINITION,
      activeDeal,
      {
        tenantId: tenantA,
        boardType: 'crm_deals',
        cardId: 'deal-300',
        targetState: 'closed_lost',
        reason: '',
      },
      0
    );

    assert.equal(noReason.valid, false);
    assert.equal(noReason.errorCode, 'MISSING_REQUIRED_FIELD');
    assert.match(noReason.message || '', /mandatory reason/);

    // Provided reason
    const withReason = BoardPolicyService.validateTransition(
      CRM_DEALS_BOARD_DEFINITION,
      activeDeal,
      {
        tenantId: tenantA,
        boardType: 'crm_deals',
        cardId: 'deal-300',
        targetState: 'closed_lost',
        reason: 'Client chose incumbent vendor due to budget constraints',
      },
      0
    );

    assert.equal(withReason.valid, true);
  });

  // ── TEST 7: Flow Metrics Accuracy Against Labeled Fixture Dataset ────────────
  await t.test('Flow Metrics: Exact mathematical calculation on verified transition event fixtures', () => {
    const fixedNow = new Date('2026-10-15T12:00:00Z');
    const dayMs = 24 * 60 * 60 * 1000;

    // Fixture transition events:
    // Card 1: Created Day 0 (Oct 1). Moved to qualified Oct 2. Won Oct 6 (Lead time: 5 days, Cycle time: 4 days)
    // Card 2: Created Day 1 (Oct 2). Moved to qualified Oct 2. Won Oct 6 (Lead time: 4 days, Cycle time: 4 days)
    // Card 3: Created Day 2 (Oct 3). Moved to qualified Oct 4. Won Oct 11 (Lead time: 8 days, Cycle time: 7 days)
    // Card 4: Created Day 3 (Oct 4). Moved to qualified Oct 5. Won Oct 15 (Lead time: 11 days, Cycle time: 10 days)
    // Card 5: In-flight. Created Oct 10. Entered qualified Oct 12. Dwell = 3 days.
    // Card 6: In-flight. Created Oct 11. In lead.

    const fixtureTransitions = [
      // Card 1
      { id: 't1', tenant_id: tenantA, board_type: 'crm_deals', card_id: 'c1', from_state: null, to_state: 'lead', actor_id: 'u1', reason: null, duration_in_previous_state_ms: 0, is_override: false, override_reason: null, metadata: {}, created_at: new Date('2026-10-01T12:00:00Z').toISOString() },
      { id: 't2', tenant_id: tenantA, board_type: 'crm_deals', card_id: 'c1', from_state: 'lead', to_state: 'qualified', actor_id: 'u1', reason: null, duration_in_previous_state_ms: 1 * dayMs, is_override: false, override_reason: null, metadata: {}, created_at: new Date('2026-10-02T12:00:00Z').toISOString() },
      { id: 't3', tenant_id: tenantA, board_type: 'crm_deals', card_id: 'c1', from_state: 'qualified', to_state: 'closed_won', actor_id: 'u1', reason: null, duration_in_previous_state_ms: 4 * dayMs, is_override: false, override_reason: null, metadata: {}, created_at: new Date('2026-10-06T12:00:00Z').toISOString() },

      // Card 2
      { id: 't4', tenant_id: tenantA, board_type: 'crm_deals', card_id: 'c2', from_state: null, to_state: 'lead', actor_id: 'u1', reason: null, duration_in_previous_state_ms: 0, is_override: false, override_reason: null, metadata: {}, created_at: new Date('2026-10-02T12:00:00Z').toISOString() },
      { id: 't5', tenant_id: tenantA, board_type: 'crm_deals', card_id: 'c2', from_state: 'lead', to_state: 'qualified', actor_id: 'u1', reason: null, duration_in_previous_state_ms: 0, is_override: false, override_reason: null, metadata: {}, created_at: new Date('2026-10-02T12:00:00Z').toISOString() },
      { id: 't6', tenant_id: tenantA, board_type: 'crm_deals', card_id: 'c2', from_state: 'qualified', to_state: 'closed_won', actor_id: 'u1', reason: null, duration_in_previous_state_ms: 4 * dayMs, is_override: false, override_reason: null, metadata: {}, created_at: new Date('2026-10-06T12:00:00Z').toISOString() },

      // Card 3
      { id: 't7', tenant_id: tenantA, board_type: 'crm_deals', card_id: 'c3', from_state: null, to_state: 'lead', actor_id: 'u1', reason: null, duration_in_previous_state_ms: 0, is_override: false, override_reason: null, metadata: {}, created_at: new Date('2026-10-03T12:00:00Z').toISOString() },
      { id: 't8', tenant_id: tenantA, board_type: 'crm_deals', card_id: 'c3', from_state: 'lead', to_state: 'qualified', actor_id: 'u1', reason: null, duration_in_previous_state_ms: 1 * dayMs, is_override: false, override_reason: null, metadata: {}, created_at: new Date('2026-10-04T12:00:00Z').toISOString() },
      { id: 't9', tenant_id: tenantA, board_type: 'crm_deals', card_id: 'c3', from_state: 'qualified', to_state: 'closed_won', actor_id: 'u1', reason: null, duration_in_previous_state_ms: 7 * dayMs, is_override: false, override_reason: null, metadata: {}, created_at: new Date('2026-10-11T12:00:00Z').toISOString() },

      // Card 4
      { id: 't10', tenant_id: tenantA, board_type: 'crm_deals', card_id: 'c4', from_state: null, to_state: 'lead', actor_id: 'u1', reason: null, duration_in_previous_state_ms: 0, is_override: false, override_reason: null, metadata: {}, created_at: new Date('2026-10-04T12:00:00Z').toISOString() },
      { id: 't11', tenant_id: tenantA, board_type: 'crm_deals', card_id: 'c4', from_state: 'lead', to_state: 'qualified', actor_id: 'u1', reason: null, duration_in_previous_state_ms: 1 * dayMs, is_override: false, override_reason: null, metadata: {}, created_at: new Date('2026-10-05T12:00:00Z').toISOString() },
      { id: 't12', tenant_id: tenantA, board_type: 'crm_deals', card_id: 'c4', from_state: 'qualified', to_state: 'closed_won', actor_id: 'u1', reason: null, duration_in_previous_state_ms: 10 * dayMs, is_override: false, override_reason: null, metadata: {}, created_at: new Date('2026-10-15T12:00:00Z').toISOString() },
    ];

    const fixtureActiveCards = [
      { id: 'c1', tenant_id: tenantA, title: 'Card 1', stage: 'closed_won', entered_column_at: '2026-10-06T12:00:00Z', is_blocked: false, class_of_service: 'standard', archived: false, created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-06T12:00:00Z' },
      { id: 'c2', tenant_id: tenantA, title: 'Card 2', stage: 'closed_won', entered_column_at: '2026-10-06T12:00:00Z', is_blocked: false, class_of_service: 'standard', archived: false, created_at: '2026-10-02T12:00:00Z', updated_at: '2026-10-06T12:00:00Z' },
      { id: 'c3', tenant_id: tenantA, title: 'Card 3', stage: 'closed_won', entered_column_at: '2026-10-11T12:00:00Z', is_blocked: false, class_of_service: 'standard', archived: false, created_at: '2026-10-03T12:00:00Z', updated_at: '2026-10-11T12:00:00Z' },
      { id: 'c4', tenant_id: tenantA, title: 'Card 4', stage: 'closed_won', entered_column_at: '2026-10-15T12:00:00Z', is_blocked: false, class_of_service: 'standard', archived: false, created_at: '2026-10-04T12:00:00Z', updated_at: '2026-10-15T12:00:00Z' },
      { id: 'c5', tenant_id: tenantA, title: 'In-Flight Card 5', stage: 'qualified', entered_column_at: '2026-10-12T12:00:00Z', is_blocked: false, class_of_service: 'standard', archived: false, created_at: '2026-10-10T12:00:00Z', updated_at: '2026-10-12T12:00:00Z' },
      { id: 'c6', tenant_id: tenantA, title: 'In-Flight Card 6', stage: 'lead', entered_column_at: '2026-10-11T12:00:00Z', is_blocked: true, blocked_since: '2026-10-13T12:00:00Z', blocked_reason: 'Waiting for client NDA', class_of_service: 'standard', archived: false, created_at: '2026-10-11T12:00:00Z', updated_at: '2026-10-11T12:00:00Z' },
    ];

    const metrics = calculateKanbanFlowMetrics({
      tenantId: tenantA,
      boardDef: CRM_DEALS_BOARD_DEFINITION,
      transitions: fixtureTransitions,
      activeCards: fixtureActiveCards,
      windowDays: 30,
      now: fixedNow,
    });

    // Known values:
    // Completed cycle times: [4, 4, 7, 10]
    // Average cycle time = (4 + 4 + 7 + 10) / 4 = 6.25 days
    assert.equal(metrics.summary.throughputCount, 4);
    assert.equal(metrics.summary.avgCycleTimeDays, 6.25);

    // Median (p50): computePercentile([4, 4, 7, 10], 50) -> rank = 1.5 -> (4 + 7) / 2 = 5.5
    assert.equal(metrics.summary.p50CycleTimeDays, 5.5);

    // 85th percentile: computePercentile([4, 4, 7, 10], 85) -> rank = 2.55 -> 7 + 0.55*3 = 8.65
    assert.equal(metrics.summary.p85CycleTimeDays, 8.65);

    // WIP count: in-flight cards c5, c6 = 2
    assert.equal(metrics.summary.wipCount, 2);

    // Work item age for in-flight cards:
    // c5: Oct 12 to Oct 15 = 3 days. c6: Oct 11 to Oct 15 = 4 days. Average = 3.5 days
    assert.equal(metrics.summary.avgWorkItemAgeDays, 3.5);

    // Blocked time for c6: Oct 13 12:00 to Oct 15 12:00 = 48 hours
    assert.equal(metrics.summary.totalBlockedTimeHours, 48);

    // Cumulative Flow Diagram: verified day-by-day counts
    assert.ok(metrics.cumulativeFlowDiagram.length > 0);
    const latestCfd = metrics.cumulativeFlowDiagram[metrics.cumulativeFlowDiagram.length - 1];
    assert.equal(latestCfd.countsByColumn['closed_won'], 4);

    // Scatterplot entries match completed cards
    assert.equal(metrics.cycleTimeScatterplot.length, 4);
    assert.equal(metrics.cycleTimeScatterplot[0].cycleTimeDays, 4);
    assert.equal(metrics.cycleTimeScatterplot[3].cycleTimeDays, 10);
  });
});
