import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertBalancedJournal,
  calculateInvoiceLine,
  decimalToScaled,
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
