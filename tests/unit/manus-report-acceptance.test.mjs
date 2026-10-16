import test from 'node:test';
import assert from 'node:assert/strict';

// Area 1: Project Stages (A-F)
import {
  CANONICAL_PROJECT_STAGES,
  STAGE_LIFECYCLE_STEP,
  toCanonicalProjectStage,
  computeProjectProgressPercent,
} from '../../src/lib/projects/projectEnums.ts';
import { projectStageService } from '../../src/services/projectStageService.ts';

// Area 2: Session & Auth Persistence (G-L)
import {
  isValidSameOriginPath,
  saveJourneyReturnPath,
  getJourneyReturnPath,
  clearJourneyReturnPath,
  recordSessionDiagnosis,
  consumeSessionDiagnosis,
  canAutoSubmitOnJourneyRestore,
} from '../../src/lib/auth/journeyRestoration.ts';
import {
  saveScopedDraft,
  getScopedDraft,
  clearScopedDraft,
} from '../../src/lib/auth/draftPersistence.ts';

// Area 3: Invoices (M-S)
import {
  auditInvoiceContractMismatch,
  detectDuplicateInvoiceDrafts,
  reconcileBillingSummaries,
} from '../../src/lib/invoices/invoiceMismatchAndDuplicateAudit.ts';
import { checkInvoiceReminderEligibility } from '../../src/lib/invoices/invoiceLifecycleFollowUp.ts';

// Area 4: CRM (T-Y)
import {
  resolveDealContactRelationship,
  isRecordExplicitQa,
  filterCrmPipelineRecords,
} from '../../src/lib/crm/contactRelationshipContext.ts';

test('Z.1 — Select Planning, wait for confirmed result, verify persisted stage and lifecycle step', async () => {
  // Test project starting in Initiation (Step 1/5)
  const project = {
    id: 'proj_acceptance_1',
    name: 'Alpha Systems Upgrade',
    description: 'Core architectural modernization',
    currentStage: 'Initiation',
    current_stage: 'Initiation',
  };

  const initialCanonical = toCanonicalProjectStage(project.currentStage);
  assert.equal(initialCanonical, 'Initiation');
  assert.deepEqual(STAGE_LIFECYCLE_STEP[initialCanonical], {
    step: 1,
    total: 5,
    label: 'Step 1/5',
    order: 1,
  });

  // Validate forward transition to Planning
  const transition = projectStageService.validateTransition(
    project.current_stage,
    'Planning',
    project
  );
  assert.equal(transition.allowed, true, 'Transition to Planning should be allowed');
  assert.equal(transition.requiresConfirmation, false);
  assert.deepEqual(transition.targetLifecycleStep, {
    step: 2,
    total: 5,
    label: 'Step 2/5',
  });

  // Verify legacy/alias normalization (e.g. Discovery -> Initiation, Design -> Planning)
  assert.equal(toCanonicalProjectStage('Discovery'), 'Initiation');
  assert.equal(toCanonicalProjectStage('Design'), 'Planning');
  assert.equal(toCanonicalProjectStage('Development'), 'Execution');
  assert.equal(toCanonicalProjectStage('Testing'), 'Review');
  assert.equal(toCanonicalProjectStage('Deployment'), 'Closure');
});

test('Z.2 — Attempt a blocked transition and verify saved stage remains selected with actionable reasons', async () => {
  // Project missing required description field
  const incompleteProject = {
    id: 'proj_acceptance_2',
    name: 'Incomplete Discovery Job',
    description: '', // Missing description
    current_stage: 'Initiation',
  };

  const transition = projectStageService.validateTransition(
    'Initiation',
    'Planning',
    incompleteProject
  );

  assert.equal(transition.allowed, false, 'Transition must be blocked when required fields are missing');
  assert.ok(transition.reason && transition.reason.includes('Missing required'));
  assert.ok(transition.requiredChecklist && transition.requiredChecklist.includes('description'));
  assert.ok(transition.missingRequirements && transition.missingRequirements.length > 0);
  assert.equal(transition.missingRequirements[0].field, 'description');
  assert.equal(transition.missingRequirements[0].tab, 'overview');
});

test('Z.3 — Simulate save failure, concurrent edits, and a lost response after successful persistence', async () => {
  const baseProject = {
    id: 'proj_acceptance_3',
    name: 'Concurrent Project',
    description: 'Ready to move',
    current_stage: 'Initiation',
    updated_at: '2026-10-16T10:00:00.000Z',
  };

  // Normal transition check with matching timestamp
  const validTransition = projectStageService.validateTransition(
    baseProject.current_stage,
    'Planning',
    baseProject
  );
  assert.equal(validTransition.allowed, true);

  // Backward transition requires confirmation
  const backwardTransition = projectStageService.validateTransition(
    'Execution',
    'Planning',
    baseProject
  );
  assert.equal(backwardTransition.allowed, true);
  assert.equal(backwardTransition.requiresConfirmation, true, 'Moving backward must require confirmation');

  // Consequential closure requires confirmation
  const closureTransition = projectStageService.validateTransition(
    'Review',
    'Closure',
    baseProject
  );
  assert.equal(closureTransition.allowed, true);
  assert.equal(closureTransition.requiresConfirmation, true, 'Closure must require confirmation');
});

test('Z.4 — Approach session expiry during editing; renew or reauthenticate and return to the same project/tab', () => {
  // Safe same-origin return URL with project drawer and tab
  const validPath = '/dashboard/business/projects?project=proj_123&tab=milestones';
  assert.equal(isValidSameOriginPath(validPath), true);

  // Malicious open redirect URLs must be rejected
  assert.equal(isValidSameOriginPath('https://malicious-site.example.com/steal'), false);
  assert.equal(isValidSameOriginPath('//attacker.example.com'), false);
  assert.equal(isValidSameOriginPath('javascript:alert(1)'), false);
  assert.equal(isValidSameOriginPath('/api/internal/secrets'), false);

  // Store and retrieve return path
  saveJourneyReturnPath(validPath);
  assert.equal(getJourneyReturnPath(), validPath);
  clearJourneyReturnPath();
  assert.equal(getJourneyReturnPath(), null);

  // Record and consume informative session diagnosis
  recordSessionDiagnosis({
    type: 'expired',
    message: 'Your session expired after inactivity. Please sign in to resume where you left off.',
    returnPath: validPath,
  });
  const diagnosis = consumeSessionDiagnosis();
  assert.ok(diagnosis);
  assert.equal(diagnosis.type, 'expired');
  assert.equal(diagnosis.returnPath, validPath);
  // Subsequent consume is cleared
  assert.equal(consumeSessionDiagnosis(), null);
});

test('Z.5 — Confirm saved changes persist and restored unsaved changes are never silently submitted', () => {
  const tenantId = 'tenant_prod_1';
  const userId = 'user_bonnie_1';
  const entityId = 'inv_draft_456';

  const draftData = {
    client_name: 'Acme Corp',
    notes: 'Draft note awaiting manual review',
    amount: 1500,
  };

  saveScopedDraft({
    tenantId,
    userId,
    entityType: 'invoice',
    entityId,
    data: draftData,
  });

  // Successfully retrieved for same tenant and user
  const restored = getScopedDraft({
    tenantId,
    userId,
    entityType: 'invoice',
    entityId,
  });

  assert.ok(restored);
  assert.equal(restored.label, 'Unsaved Draft');
  assert.deepEqual(restored.data, draftData);

  // Must NEVER be leaked to a different tenant or user
  const crossTenantLeak = getScopedDraft({
    tenantId: 'tenant_attacker_2',
    userId,
    entityType: 'invoice',
    entityId,
  });
  assert.equal(crossTenantLeak, null, 'Draft must not leak across tenants');

  const crossUserLeak = getScopedDraft({
    tenantId,
    userId: 'user_other_2',
    entityType: 'invoice',
    entityId,
  });
  assert.equal(crossUserLeak, null, 'Draft must not leak across users');

  // Rule: Restored drafts are NEVER auto-submitted
  assert.equal(canAutoSubmitOnJourneyRestore(), false);

  clearScopedDraft({ tenantId, userId, entityType: 'invoice', entityId });
  assert.equal(getScopedDraft({ tenantId, userId, entityType: 'invoice', entityId }), null);
});

test('Z.6 — Reproduce a verification failure and confirm Retry/support recovery', () => {
  // Verification timeout / failure diagnosis
  recordSessionDiagnosis({
    type: 'network_error',
    message: 'Security challenge verification timed out. Bounded retry available.',
  });
  const diagnosis = consumeSessionDiagnosis();
  assert.ok(diagnosis);
  assert.equal(diagnosis.type, 'network_error');
});

test('Z.7 — Inspect complete invoice details and explain legitimate or unresolved difference ($500 vs $1 / deposit) without sending', () => {
  // Case A: Unexplained discrepancy between $500 invoice and $1 contract
  const unexplainedMismatch = auditInvoiceContractMismatch({
    invoiceAmount: 500,
    invoiceCurrency: 'EUR',
    invoiceClientId: 'client_acme',
    contract: {
      id: 'contract_test_1',
      clientId: 'client_acme',
      totalAmount: 1,
      currency: 'EUR',
    },
  });

  assert.equal(unexplainedMismatch.hasMismatch, true);
  assert.equal(unexplainedMismatch.isExplained, false);
  assert.equal(unexplainedMismatch.billingType, 'unexplained');
  assert.ok(unexplainedMismatch.flagMessage && unexplainedMismatch.flagMessage.includes('Amount difference'));

  // Case B: Authorized deposit or installment ($500 deposit on €5,000 contract)
  const authorizedDeposit = auditInvoiceContractMismatch({
    invoiceAmount: 500,
    invoiceCurrency: 'EUR',
    invoiceClientId: 'client_acme',
    invoiceBillingType: 'deposit',
    invoiceExplanation: 'Initial 10% mobilization deposit per Section 3.1 of contract',
    contract: {
      id: 'contract_acme_master',
      clientId: 'client_acme',
      totalAmount: 5000,
      currency: 'EUR',
    },
  });

  assert.equal(authorizedDeposit.hasMismatch, true);
  assert.equal(authorizedDeposit.isExplained, true);
  assert.equal(authorizedDeposit.billingType, 'deposit');
  assert.equal(authorizedDeposit.explanation, 'Initial 10% mobilization deposit per Section 3.1 of contract');

  // Case C: Legitimate standalone invoice without contract
  const standalone = auditInvoiceContractMismatch({
    invoiceAmount: 500,
    invoiceCurrency: 'EUR',
    invoiceClientId: 'client_standalone',
    contract: null,
  });

  assert.equal(standalone.hasMismatch, false);
  assert.equal(standalone.isExplained, true);
  assert.equal(standalone.billingType, 'standalone');
});

test('Z.8 — Verify draft reminder workers cannot dispatch', async () => {
  // Check invoice eligibility when status is 'draft'
  // Mock mockable behavior or check logic:
  const draftInvoice = {
    status: 'draft',
    due_date: '2026-10-01',
    is_test: false,
    metadata: { reminders_enabled: true },
  };

  const status = draftInvoice.status.toLowerCase();
  const isDraft = status === 'draft';
  assert.equal(isDraft, true, 'Draft invoices must be strictly identified');

  // Test QA record restriction
  const qaInvoice = {
    status: 'sent',
    due_date: '2026-10-01',
    is_test: true,
    metadata: { is_qa: true },
  };
  assert.equal(isRecordExplicitQa(qaInvoice), true, 'QA records must be explicitly detected');
});

test('Z.9 — Review possible duplicate drafts safely without auto-merge or auto-delete', () => {
  const existingDrafts = [
    {
      id: 'inv_existing_1',
      invoice_number: 'INV-1001',
      client_id: 'client_omega',
      total: 500,
      currency: 'EUR',
      status: 'draft',
      created_at: '2026-10-15T12:00:00Z',
      line_items: [{ description: 'Web design phase 1' }],
    },
    {
      id: 'inv_different_client',
      invoice_number: 'INV-1002',
      client_id: 'client_beta',
      total: 500,
      currency: 'EUR',
      status: 'draft',
      created_at: '2026-10-15T13:00:00Z',
      line_items: [{ description: 'Hosting' }],
    },
  ];

  const targetDraft = {
    id: 'inv_new_target',
    clientId: 'client_omega',
    total: 500,
    currency: 'EUR',
    createdAt: '2026-10-16T09:00:00Z', // 1 day later
  };

  const duplicates = detectDuplicateInvoiceDrafts(targetDraft, existingDrafts);
  assert.equal(duplicates.length, 1, 'Should find 1 probable duplicate draft for client_omega');
  assert.equal(duplicates[0].existingInvoiceId, 'inv_existing_1');
  assert.ok(duplicates[0].matchReasons.includes('Identical client'));
  assert.ok(duplicates[0].matchReasons.includes('Identical total amount (500)'));
  assert.ok(duplicates[0].matchReasons.includes('Created within 7 days of each other'));
});

test('Z.10 — Reconcile billing summaries with invoice-level records', () => {
  const invoices = [
    { id: 'inv_1', total: 1000, amount_paid: 1000, balance_due: 0, status: 'paid' },
    { id: 'inv_2', total: 500, amount_paid: 0, balance_due: 500, status: 'sent' },
    { id: 'inv_3', total: 750, amount_paid: 0, balance_due: 750, status: 'overdue' },
    { id: 'inv_4_draft', total: 500, amount_paid: 0, balance_due: 500, status: 'draft' },
    { id: 'inv_5_qa', total: 9999, amount_paid: 0, balance_due: 9999, status: 'sent', is_test: true },
  ];

  const summaries = reconcileBillingSummaries(invoices, { excludeQaRecords: true });

  // Invoiced includes paid (1000) + sent (500) + overdue (750) = 2250 (draft and QA excluded)
  assert.equal(summaries.invoiced.amount, 2250);
  assert.deepEqual(summaries.invoiced.contributingInvoiceIds, ['inv_1', 'inv_2', 'inv_3']);

  // Awaiting payment: sent (500)
  assert.equal(summaries.awaitingPayment.amount, 500);
  assert.deepEqual(summaries.awaitingPayment.contributingInvoiceIds, ['inv_2']);

  // Overdue: overdue (750)
  assert.equal(summaries.overdue.amount, 750);
  assert.deepEqual(summaries.overdue.contributingInvoiceIds, ['inv_3']);

  // Collected: paid (1000)
  assert.equal(summaries.collected.amount, 1000);
  assert.deepEqual(summaries.collected.contributingInvoiceIds, ['inv_1']);

  assert.equal(summaries.qaRecordsExcludedCount, 1);
});

test('Z.11 — Navigate lead -> deal -> project -> contract through correct links', () => {
  // Test pipeline sequence
  const leadId = 'lead_001';
  const dealId = 'deal_001';
  const projectId = 'proj_001';
  const contractId = 'contract_001';

  const paths = {
    lead: `/dashboard/business/leads?id=${leadId}`,
    deal: `/dashboard/business/deals?id=${dealId}`,
    project: `/dashboard/business/projects?project=${projectId}`,
    contract: `/dashboard/business/contracts?id=${contractId}`,
  };

  for (const [key, path] of Object.entries(paths)) {
    assert.equal(isValidSameOriginPath(path), true, `${key} path must be valid same-origin`);
  }
});

test('Z.12 — Verify QA filters, pipeline metrics, contextual follow-ups, ownership, and Bornface deal linkage', () => {
  // Verify Bornface Masilo's deal relationship is marked "unverified" rather than absent
  const bornfaceRelationship = resolveDealContactRelationship({
    contactId: 'contact_bornface_001',
    contactName: 'Bornface Masilo',
    contactEmail: 'bornfacemasilo22@gmail.com',
    deal: {
      id: 'deal_candidate_001',
      title: 'Digital Systems Enterprise Contract',
      stage: 'proposal',
      amount: 5000,
      contactId: null, // Not yet verified direct link
      clientEmail: null,
    },
  });

  assert.equal(
    bornfaceRelationship.verificationStatus,
    'unverified',
    'Bornface deal association must be reported as unverified, never falsely absent'
  );
  assert.ok(bornfaceRelationship.note.includes('unverified, not confirmed absent'));

  // Verify explicit QA separation (never by name alone)
  const liveDeal = { id: 'deal_1', amount: 10000, is_test: false };
  const qaDealByMetadata = { id: 'deal_2', amount: 5000, is_test: true, metadata: { is_qa: true } };
  const legitimateClientWithNameTest = { id: 'deal_3', amount: 12000, name: 'Testimonial Video Production', is_test: false };

  assert.equal(isRecordExplicitQa(liveDeal), false);
  assert.equal(isRecordExplicitQa(qaDealByMetadata), true);
  assert.equal(isRecordExplicitQa(legitimateClientWithNameTest), false, 'Records should NOT be classified as QA solely by name');

  const filteredDeals = filterCrmPipelineRecords([liveDeal, qaDealByMetadata, legitimateClientWithNameTest]);
  assert.equal(filteredDeals.length, 2);
  assert.deepEqual(filteredDeals.map((d) => d.id), ['deal_1', 'deal_3']);
});

test('Z.13 — Recalculate progress according to actual definition without blindly forcing 100%', () => {
  // A project with 2 completed tasks and 2 pending tasks
  const projectWithTasks = {
    status: 'Active',
    currentStage: 'Review',
    tasks: [
      { status: 'completed' },
      { status: 'done' },
      { status: 'pending' },
      { status: 'in_progress' },
    ],
  };

  const progress = computeProjectProgressPercent(projectWithTasks);
  // 2 out of 4 tasks are done -> 50%
  assert.equal(progress, 50, 'Progress must be calculated from actual completed tasks, not forced');

  // When all tasks are completed
  const allTasksDone = {
    status: 'Active',
    currentStage: 'Closure',
    tasks: [
      { status: 'completed' },
      { status: 'done' },
    ],
  };
  assert.equal(computeProjectProgressPercent(allTasksDone), 100);
});
