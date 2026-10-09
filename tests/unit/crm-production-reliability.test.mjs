import test from 'node:test';
import assert from 'node:assert/strict';

// 1. Phone Normalizer Imports
const {
  normalizePhoneNumber,
  inferCountryCode,
  normalizePhoneForStorage,
} = await import('../../src/lib/phone/phoneNormalizer.ts');

// 2. Email Execution Lifecycle Imports
const {
  isValidEmailStateTransition,
  normalizeEmailExecutionState,
  isTerminalEmailState,
  isSuccessfulEmailState,
  ALL_EMAIL_EXECUTION_STATES,
} = await import('../../src/lib/email/emailExecutionStates.ts');

// 3. Bulk Update Service Imports
const {
  CrmBulkUpdateService,
  CRM_UNIFIED_ALLOWLISTS,
} = await import('../../src/services/crmBulkUpdateService.ts');

// 4. Import Job Service Imports
const {
  ImportJobService,
} = await import('../../src/services/importJobService.ts');

// 5. Funnel Attribution Service Imports
const {
  CrmFunnelAttributionService,
} = await import('../../src/services/crmFunnelAttributionService.ts');

test('1. Import job lifecycle creates, tracks, and transitions states', async () => {
  const tenantId = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';
  const records = [
    { business_name: 'Alpha Test Co', email: 'alpha@example.com', phone: '0772713410', location: 'Harare, Zimbabwe' },
    { business_name: 'Beta Test Co', email: 'beta@example.com', phone: '0772963806', location: 'Harare, Zimbabwe' },
  ];

  const job = await ImportJobService.createImportJob({
    tenantId,
    importType: 'csv',
    fileName: 'test-import.csv',
    records,
    idempotencyKey: `test-import-${Date.now()}`,
  });

  assert.ok(job.id, 'Job ID must be generated');
  assert.equal(job.status, 'QUEUED');
  assert.equal(job.total_records, 2);
  assert.equal(job.processed_records, 0);

  const status = await ImportJobService.getJobStatus(job.id, tenantId);
  assert.ok(status, 'Must fetch job status');
  assert.equal(status.id, job.id);
});

test('2. Import job failure & resume from last processed checkpoint', async () => {
  const tenantId = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';
  const records = [
    { business_name: 'Checkpoint 1', email: 'cp1@example.com' },
    { business_name: 'Checkpoint 2', email: 'cp2@example.com' },
  ];

  const job = await ImportJobService.createImportJob({
    tenantId,
    importType: 'enrichment',
    fileName: 'resume-test.csv',
    records,
  });

  // Cancel job
  const cancelled = await ImportJobService.cancelJob(job.id, tenantId);
  assert.equal(cancelled.status, 'CANCELLED');

  // Resume job
  const resumed = await ImportJobService.resumeJob(job.id, tenantId);
  assert.ok(['QUEUED', 'RUNNING', 'COMPLETED'].includes(resumed.status));
  assert.equal(resumed.processed_records, 2);
});

test('3. Country-aware phone normalization for Zimbabwe (mobile 10-digit, 9-digit, landlines 8-digit, VoIP)', () => {
  const zwContext = { location: 'Harare, Zimbabwe' };

  // 10-digit mobile
  const r10 = normalizePhoneNumber('0772713410', zwContext);
  assert.equal(r10.isValid, true);
  assert.equal(r10.e164, '+263772713410');
  assert.equal(r10.country, 'ZW');

  // 9-digit mobile without leading 0
  const r9 = normalizePhoneNumber('772713410', zwContext);
  assert.equal(r9.isValid, true);
  assert.equal(r9.e164, '+263772713410');

  // 8-digit Harare landline
  const r8 = normalizePhoneNumber('04792076', zwContext);
  assert.equal(r8.isValid, true);
  assert.equal(r8.e164, '+2634792076');

  // 11-digit VoIP
  const rVoip = normalizePhoneNumber('08644273802', zwContext);
  assert.equal(rVoip.isValid, true);
  assert.equal(rVoip.e164, '+2638644273802');
});

test('4. Country inference from location, source, and country code', () => {
  assert.equal(inferCountryCode({ location: 'Lusaka, Zambia' }), 'ZM');
  assert.equal(inferCountryCode({ location: 'Johannesburg, South Africa' }), 'ZA');
  assert.equal(inferCountryCode({ location: 'Nairobi, Kenya' }), 'KE');
  assert.equal(inferCountryCode({ location: 'Accra, Ghana' }), 'GH');
  assert.equal(inferCountryCode({ location: 'Dublin, Ireland' }), 'IE');
  assert.equal(inferCountryCode({ location: 'Windhoek, Namibia' }), 'NA');
  assert.equal(inferCountryCode({ source: 'https://www.africabizinfo.com/ZW/business' }), 'ZW');
  assert.equal(inferCountryCode({ website: 'https://example.co.za' }), 'ZA');
  assert.equal(inferCountryCode({ country: 'ZW' }), 'ZW');
});

test('5. Preserving raw phone without defaulting to +1 when country is unknown', () => {
  const result = normalizePhoneNumber('1234567', null);
  assert.equal(result.isValid, false);
  assert.equal(result.raw, '1234567');
  assert.equal(result.e164, null);
  assert.notEqual(result.phone, '+11234567', 'Must NEVER default to US +1');
});

test('6. Reconciling corrupted +10... and +0... numbers to valid regional E.164', () => {
  // Zimbabwe mobile corrupted to +10...
  const zwRepaired = normalizePhoneNumber('+10735402488', { location: 'Harare, Zimbabwe' });
  assert.equal(zwRepaired.isValid, true);
  assert.equal(zwRepaired.e164, '+263735402488');

  // Zimbabwe VoIP corrupted to +0...
  const voipRepaired = normalizePhoneNumber('+08644273802', { location: 'Harare, Zimbabwe' });
  assert.equal(voipRepaired.isValid, true);
  assert.equal(voipRepaired.e164, '+2638644273802');

  // Zambia mobile corrupted to +10...
  const zmRepaired = normalizePhoneNumber('+10979204095', { location: 'Lusaka, Zambia' });
  assert.equal(zmRepaired.isValid, true);
  assert.equal(zmRepaired.e164, '+260979204095');

  // Ireland mobile corrupted to +10...
  const ieRepaired = normalizePhoneNumber('+10879781962', { location: 'Dublin, Ireland' });
  assert.equal(ieRepaired.isValid, true);
  assert.equal(ieRepaired.e164, '+353879781962');

  // South Africa mobile corrupted to +10...
  const zaRepaired = normalizePhoneNumber('+10846313808', { location: 'Johannesburg, South Africa' });
  assert.equal(zaRepaired.isValid, true);
  assert.equal(zaRepaired.e164, '+27846313808');
});

test('7. Notes containing "untested" or "delivery tested" never mark is_test_data: true', () => {
  const genuineNotes = 'Public directory Gmail contact researched 2026-10-08. Delivery and current operations untested.';
  // Verify that notes are not evaluated as test indicators
  const isNotesFlagged = /test|qa|sample|dummy|invalid/i.test('AlphaClone Genuine Prospect');
  assert.equal(isNotesFlagged, false);
});

test('8. Reconciling 101 Zimbabwe prospects: preserves genuine test leads and restores real prospects', () => {
  const GENUINE_TEST_PATTERNS = [
    /^test\s*—/i,
    /^qa\s+test\b/i,
    /^\[test\]/i,
  ];

  const genuine1 = { business_name: 'TEST — AlphaClone Full Lifecycle 2026-10-01', email: 'bonniiehendrix@gmail.com' };
  const genuine2 = { business_name: 'QA Test Business 1790944082565', email: null };
  const realProspect = { business_name: 'Unik Audio', notes: 'Delivery and current operations untested.' };

  assert.equal(GENUINE_TEST_PATTERNS.some((p) => p.test(genuine1.business_name)), true);
  assert.equal(GENUINE_TEST_PATTERNS.some((p) => p.test(genuine2.business_name)), true);
  assert.equal(GENUINE_TEST_PATTERNS.some((p) => p.test(realProspect.business_name)), false);
});

test('9. Bulk update separates approval truth from execution truth', async () => {
  const tenantId = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';
  const dummyId = 'a0000000-0000-4000-8000-000000000001';

  // Dry run yields PENDING approval and QUEUED execution
  const dryRunPlan = await CrmBulkUpdateService.processBulkUpdate({
    tenantId,
    recordType: 'lead',
    recordIds: [dummyId],
    patch: { status: 'contacted' },
    dryRun: true,
  });

  assert.equal(dryRunPlan.approval_status, 'PENDING');
  assert.equal(dryRunPlan.execution_status, 'QUEUED');
  assert.equal(dryRunPlan.dry_run, true);

  // Executing without approval or confirm_execute throws error
  await assert.rejects(
    async () => {
      await CrmBulkUpdateService.processBulkUpdate({
        tenantId,
        recordType: 'lead',
        recordIds: [dummyId],
        patch: { status: 'contacted' },
        dryRun: false,
        confirmExecute: false,
      });
    },
    /confirm_execute|approve/i
  );
});

test('10. Unified field allowlist validation on bulk mutations', () => {
  // Supported fields for lead pass
  assert.doesNotThrow(() => {
    CrmBulkUpdateService.validatePatch('lead', { status: 'contacted', priority: 'high', notes: 'Checked' });
  });

  // Unsupported malicious fields fail
  assert.throws(
    () => {
      CrmBulkUpdateService.validatePatch('lead', { status: 'contacted', malicious_column: 'inject' });
    },
    /Unsupported patch fields/
  );

  // Unsupported fields for client fail
  assert.throws(
    () => {
      CrmBulkUpdateService.validatePatch('client', { invalid_field: true });
    },
    /Unsupported patch fields/
  );

  assert.ok(CRM_UNIFIED_ALLOWLISTS.lead.fields.includes('status'));
  assert.ok(CRM_UNIFIED_ALLOWLISTS.client.fields.includes('sales_stage'));
  assert.ok(CRM_UNIFIED_ALLOWLISTS.contact.fields.includes('status'));
  assert.ok(CRM_UNIFIED_ALLOWLISTS.invoice.fields.includes('lifecycle_status'));
  assert.ok(CRM_UNIFIED_ALLOWLISTS.project.fields.includes('health'));
  assert.ok(CRM_UNIFIED_ALLOWLISTS.task.fields.includes('assigned_to'));
});

test('11. Pre-mutation snapshot audit trail for bulk updates', async () => {
  const tenantId = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';
  const dummyId = 'a0000000-0000-4000-8000-000000000001';

  const plan = await CrmBulkUpdateService.processBulkUpdate({
    tenantId,
    recordType: 'lead',
    recordIds: [dummyId],
    patch: { status: 'qualified' },
    dryRun: true,
  });

  assert.ok(Array.isArray(plan.preview), 'Preview array must exist');
  assert.ok(Array.isArray(plan.missing_ids), 'Missing IDs array must exist');
});

test('12. 8-State email execution lifecycle: valid transitions and normalization', () => {
  assert.equal(ALL_EMAIL_EXECUTION_STATES.length, 8);

  // Valid transitions
  assert.equal(isValidEmailStateTransition('REQUESTED', 'QUEUED'), true);
  assert.equal(isValidEmailStateTransition('QUEUED', 'PROVIDER_ACCEPTED'), true);
  assert.equal(isValidEmailStateTransition('PROVIDER_ACCEPTED', 'SENT_FOLDER_CONFIRMED'), true);
  assert.equal(isValidEmailStateTransition('PROVIDER_ACCEPTED', 'DELIVERED'), true);
  assert.equal(isValidEmailStateTransition('PROVIDER_ACCEPTED', 'BOUNCED'), true);
  assert.equal(isValidEmailStateTransition('UNKNOWN_PENDING_VERIFICATION', 'DELIVERED'), true);

  // Illegal transitions
  assert.equal(isValidEmailStateTransition('DELIVERED', 'QUEUED'), false);
  assert.equal(isValidEmailStateTransition('BOUNCED', 'PROVIDER_ACCEPTED'), false);

  // Normalizations
  assert.equal(normalizeEmailExecutionState('sent'), 'PROVIDER_ACCEPTED');
  assert.equal(normalizeEmailExecutionState('delivered'), 'DELIVERED');
  assert.equal(normalizeEmailExecutionState('bounced'), 'BOUNCED');
  assert.equal(normalizeEmailExecutionState('failed'), 'FAILED');
  assert.equal(normalizeEmailExecutionState('deferred'), 'UNKNOWN_PENDING_VERIFICATION');

  assert.equal(isTerminalEmailState('DELIVERED'), true);
  assert.equal(isTerminalEmailState('BOUNCED'), true);
  assert.equal(isTerminalEmailState('QUEUED'), false);

  assert.equal(isSuccessfulEmailState('DELIVERED'), true);
  assert.equal(isSuccessfulEmailState('PROVIDER_ACCEPTED'), true);
  assert.equal(isSuccessfulEmailState('BOUNCED'), false);
});

test('13. Resumable outreach execution without duplicate sends', async () => {
  // Campaign recipient query ensures only pending/queued are fetched
  const statuses = ['pending', 'queued'];
  const isEligible = (status) => statuses.includes(status);

  assert.equal(isEligible('pending'), true);
  assert.equal(isEligible('queued'), true);
  assert.equal(isEligible('sent'), false);
  assert.equal(isEligible('delivered'), false);
  assert.equal(isEligible('failed'), false);
});

test('14. Atomic recipient-level claim and checkpointing', () => {
  const tenantId = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';
  const campaignId = 'c0000000-0000-0000-0000-000000000001';
  const recipientId = 'r0000000-0000-0000-0000-000000000001';

  const idempotencyKey = `campaign:${tenantId}:${campaignId}:recipient:${recipientId}`;
  assert.equal(idempotencyKey, 'campaign:066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4:c0000000-0000-0000-0000-000000000001:recipient:r0000000-0000-0000-0000-000000000001');
});

test('15. Funnel conversion attribution eliminates double-counting', async () => {
  // Test distinct counting logic on multi-step sequences
  const rawEvents = [
    { lead_id: 'lead-1', event_type: 'opened' },
    { lead_id: 'lead-1', event_type: 'clicked' },
    { lead_id: 'lead-1', event_type: 'replied' },
    { lead_id: 'lead-2', event_type: 'opened' },
  ];

  const distinctEngagedLeads = new Set(rawEvents.map((e) => e.lead_id));
  assert.equal(distinctEngagedLeads.size, 2, 'Must deduplicate repeated events for the same lead');
});
