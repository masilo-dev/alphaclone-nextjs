import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  inspectContractLifecycle,
  inspectInvoiceLifecycle,
  inspectQuoteLifecycle,
  isOperationalRecord,
} from '../../src/lib/business/lifecycleConsistency.ts';

describe('business lifecycle consistency', () => {
  it('routes dashboard metrics through canonical workspace statistics', () => {
    const source = fs.readFileSync(
      new URL('../../src/lib/mcp/tools/reports-ops.ts', import.meta.url),
      'utf8',
    );
    assert.match(source, /getCanonicalWorkspaceCounts/);
    assert.match(source, /stats_source: 'canonical_workspace_stats'/);
    assert.doesNotMatch(source, /countOf\('invoices'\)/);
    assert.match(source, /getLifecycleConsistencyReport/);
  });

  it('surfaces the same lifecycle report in operational health', () => {
    const source = fs.readFileSync(
      new URL('../../src/services/operationsService.ts', import.meta.url),
      'utf8',
    );
    assert.match(source, /getLifecycleConsistencyReport\(admin, tenantId\)/);
    assert.match(source, /lifecycleConsistency/);
  });

  it('blocks evidence-free paid and signed status updates', () => {
    const invoices = fs.readFileSync(new URL('../../src/lib/mcp/tools/invoicing.ts', import.meta.url), 'utf8');
    const contracts = fs.readFileSync(new URL('../../src/lib/mcp/tools/contracts.ts', import.meta.url), 'utf8');
    assert.match(invoices, /INVOICE_PAYMENT_EVIDENCE_REQUIRED/);
    assert.match(contracts, /CONTRACT_SIGNATURE_EVIDENCE_REQUIRED/);
    assert.match(contracts, /inspectContractLifecycle/);
  });

  it('returns effective quote expiry without mutating historical evidence', () => {
    const quotes = fs.readFileSync(new URL('../../src/lib/mcp/tools/gap-tools-finance.ts', import.meta.url), 'utf8');
    assert.match(quotes, /effective_status/);
    assert.match(quotes, /QUOTE_EXPIRED_STATE_MISMATCH/);
  });

  it('requires payment evidence before an invoice can claim paid', () => {
    assert.equal(inspectInvoiceLifecycle({ id: 'i1', status: 'paid', total: 100, amount_paid: 100 }).at(0)?.code,
      'INVOICE_PAID_WITHOUT_PAYMENT_EVIDENCE');
    assert.deepEqual(inspectInvoiceLifecycle({ id: 'i1', status: 'paid', total: 100, amount_paid: 100, paid_at: '2026-09-11T00:00:00Z' }), []);
  });

  it('detects contract signature state mismatches in either direction', () => {
    assert.equal(inspectContractLifecycle({
      id: 'c1',
      status: 'sent',
      client_signed_at: '2026-09-11T00:00:00Z',
      admin_signed_at: '2026-09-11T00:01:00Z',
    }).at(0)?.code,
      'CONTRACT_SIGNATURE_STATE_MISMATCH');
    assert.equal(inspectContractLifecycle({ id: 'c2', lifecycle_status: 'signed' }).at(0)?.code,
      'CONTRACT_SIGNED_WITHOUT_SIGNATURE_EVIDENCE');
  });

  it('allows a partially signed contract to remain sent', () => {
    assert.deepEqual(inspectContractLifecycle({
      id: 'c1',
      status: 'sent',
      client_signed_at: '2026-09-11T00:00:00Z',
    }), []);
  });

  it('treats elapsed unresolved quotes as lifecycle mismatches', () => {
    assert.equal(inspectQuoteLifecycle({ id: 'q1', status: 'draft', valid_until: '2026-09-01' }, new Date('2026-09-11T00:00:00Z')).at(0)?.code,
      'QUOTE_EXPIRED_STATE_MISMATCH');
    assert.deepEqual(inspectQuoteLifecycle({ id: 'q2', status: 'accepted', valid_until: '2026-09-01' }, new Date('2026-09-11T00:00:00Z')), []);
  });

  it('excludes explicitly tagged test records from operational KPIs', () => {
    assert.equal(isOperationalRecord({ is_test_data: true }), false);
    assert.equal(isOperationalRecord({ is_test_data: false }), true);
    assert.equal(isOperationalRecord({}), true);
  });
});
