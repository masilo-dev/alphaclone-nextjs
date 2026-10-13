import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { normalizeRecipientRows, readRecipientWorkbook } from '../../src/lib/import/recipientWorkbook.ts';

test('recipient import normalizes headers and removes duplicate and invalid emails', () => {
  const result = normalizeRecipientRows([{ 'Email Address': ' HELLO@acme.test ', Company: 'Acme' }, { Email: 'hello@acme.test' }, { Email: 'broken' }]);
  assert.equal(result.records.length, 1); assert.equal(result.records[0].name, 'Acme');
  assert.equal(result.records[0].email, 'hello@acme.test');
  assert.equal(result.invalid, 1); assert.equal(result.duplicates, 1);
});
test('Excel import preserves empty columns and does not evaluate formulas', async () => {
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Recipients');
  sheet.addRow(['Name', '', 'Email']); sheet.addRow(['Alice', '', 'alice@acme.test']);
  sheet.addRow(['Bob', '', { formula: 'A2', result: 'bob@acme.test' }]);
  const file = new File([await workbook.xlsx.writeBuffer()], 'contacts.xlsx');
  const rows = await readRecipientWorkbook(file);
  const result = normalizeRecipientRows(rows);
  assert.equal(result.records.length, 1); assert.equal(result.records[0].email, 'alice@acme.test'); assert.equal(result.invalid, 1);
});
test('unsupported and oversized uploads fail before parsing', async () => {
  await assert.rejects(readRecipientWorkbook(new File(['data'], 'contacts.xls')), /xlsx/);
  await assert.rejects(readRecipientWorkbook(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.xlsx')), /5 MB/);
});
