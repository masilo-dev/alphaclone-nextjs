import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertBalancedJournal,
  calculateInvoiceLine,
  decimalToScaled,
  deriveInvoiceCollectionStatus,
  deriveInvoicePaymentStatus,
  scaledToDecimal,
} from '../../src/lib/finance/canonicalDomain.ts';

test('decimal money conversion rounds deterministically to four places', () => {
  assert.equal(decimalToScaled('0.10005'), 1001n);
  assert.equal(scaledToDecimal(decimalToScaled('123456789.98765')), '123456789.9877');
});

test('canonical line calculation applies discount before tax without floats', () => {
  assert.deepEqual(
    calculateInvoiceLine({
      description: 'Consulting',
      quantity: '3',
      unitPrice: '19.995',
      discountType: 'percentage',
      discountValue: '10',
      taxRate: '8.1',
    }),
    {
      description: 'Consulting',
      quantity: '3',
      unitPrice: '19.995',
      discountType: 'percentage',
      discountValue: '10',
      taxRate: '8.1',
      netAmount: '53.9865',
      taxAmount: '4.3729',
      grossAmount: '58.3594',
    },
  );
});

test('payment status is derived from allocations and adjustments', () => {
  assert.deepEqual(
    deriveInvoicePaymentStatus({ invoiceTotal: '100', successfulAllocations: '40' }),
    { status: 'partially_paid', balanceDue: '60.0000' },
  );
  assert.deepEqual(
    deriveInvoicePaymentStatus({ invoiceTotal: '100', successfulAllocations: '110' }),
    { status: 'overpaid', balanceDue: '0.0000' },
  );
  assert.deepEqual(
    deriveInvoicePaymentStatus({ invoiceTotal: '100', successfulAllocations: '100', refunds: '25' }),
    { status: 'partially_refunded', balanceDue: '25.0000' },
  );
});

test('collection state is independently derived from evidence and due date', () => {
  const now = new Date('2026-09-14T10:00:00.000Z');
  assert.equal(deriveInvoiceCollectionStatus({ paymentStatus: 'paid', balanceDue: '0', dueDate: '2026-09-01', now }), 'normal');
  assert.equal(deriveInvoiceCollectionStatus({ paymentStatus: 'unpaid', balanceDue: '10', dueDate: '2026-09-13', now }), 'overdue');
  assert.equal(deriveInvoiceCollectionStatus({ paymentStatus: 'unpaid', balanceDue: '10', dueDate: '2026-09-20', now }), 'due_soon');
  assert.equal(deriveInvoiceCollectionStatus({ paymentStatus: 'unpaid', balanceDue: '10', dueDate: '2026-09-20', now, collectionActive: true }), 'collection_active');
  assert.equal(deriveInvoiceCollectionStatus({ paymentStatus: 'disputed', balanceDue: '10', dueDate: '2026-09-01', now }), 'disputed');
});

test('journals must balance and each line has one side', () => {
  assert.doesNotThrow(() => assertBalancedJournal([
    { debit: '125.25', credit: '0' },
    { debit: '0', credit: '100.00' },
    { debit: '0', credit: '25.25' },
  ]));
  assert.throws(
    () => assertBalancedJournal([{ debit: '10', credit: '0' }, { debit: '0', credit: '9.99' }]),
    /balance/,
  );
});

test('the migration serializes allocation checks and makes evidence immutable', async () => {
  const migration = await import('node:fs/promises').then(({ readFile }) =>
    readFile('supabase/migrations/20260726220000_canonical_finance_foundation.sql', 'utf8'),
  );
  assert.match(migration, /FROM public\.finance_payments p[\s\S]*FOR UPDATE/);
  assert.match(migration, /FROM public\.business_invoices i[\s\S]*FOR UPDATE/);
  assert.match(migration, /Payment allocations are immutable/);
});

test('dual-write migration projects every legacy payment and never treats payment as delivery', async () => {
  const migration = await import('node:fs/promises').then(({ readFile }) =>
    readFile('supabase/migrations/20260914110000_canonical_payment_projection_and_collection_state.sql', 'utf8'),
  );
  assert.match(migration, /AFTER INSERT ON public\.business_invoice_payments/);
  assert.match(migration, /payment_allocations/);
  assert.match(migration, /canonical_invoice_financial_status/);
  assert.match(migration, /prevent_payment_from_forging_delivery_state/);
});
