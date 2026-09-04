import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('E2E schema write compatibility', () => {
  it('create_task uses schemaWriteCompat instead of tasks.client_id', () => {
    const source = readFileSync(path.join(root, 'src/lib/mcp/tools/gap-tools-crm.ts'), 'utf8');
    assert.match(source, /insertTaskSchemaCompat/);
    assert.doesNotMatch(source, /\.from\('tasks'\)\.insert\(\{ tenant_id: args\.tenant_id, title: args\.title[^}]*client_id/);
  });

  it('create_quote uses quote_items table not quotes.line_items column', () => {
    const source = readFileSync(path.join(root, 'src/lib/mcp/tools/gap-tools-finance.ts'), 'utf8');
    assert.match(source, /insertQuoteSchemaCompat/);
    const compat = readFileSync(path.join(root, 'src/lib/mcp/schemaWriteCompat.ts'), 'utf8');
    assert.match(compat, /quote_items/);
    assert.match(compat, /name: input\.title/);
    assert.match(compat, /contact_id:/);
  });

  it('create_invoice avoids generated total_amount column', () => {
    const source = readFileSync(path.join(root, 'src/lib/mcp/tools/invoicing.ts'), 'utf8');
    assert.match(source, /insertBusinessInvoiceSchemaCompat/);
    const compat = readFileSync(path.join(root, 'src/lib/mcp/schemaWriteCompat.ts'), 'utf8');
    const fn = compat.slice(compat.indexOf('insertBusinessInvoiceSchemaCompat'));
    assert.match(fn, /currency_code/);
    assert.doesNotMatch(fn.slice(0, fn.indexOf('return supabase')), /total_amount:/);
  });

  it('verify_lead_created registered as direct connector tool', () => {
    const source = readFileSync(path.join(root, 'src/lib/mcp/tools/verification-ops.ts'), 'utf8');
    assert.match(source, /name: 'verify_lead_created'/);
    assert.match(source, /name: 'get_automation_health'/);
    const registry = readFileSync(path.join(root, 'src/lib/mcp/tool-registry.ts'), 'utf8');
    assert.match(registry, /verification-ops/);
  });

  it('create_contract persists governing_law and jurisdiction from body text', () => {
    const source = readFileSync(path.join(root, 'src/lib/mcp/tools/contracts.ts'), 'utf8');
    assert.match(source, /extractContractLegalFields/);
    assert.match(source, /governing_law:/);
    assert.match(source, /jurisdiction,/);
  });
});

describe('extractContractLegalFields', () => {
  it('includes patterns for governing law and jurisdiction extraction', () => {
    const source = readFileSync(path.join(root, 'src/lib/contracts/extractContractLegalFields.ts'), 'utf8');
    assert.match(source, /governing\\s\+law/);
    assert.match(source, /jurisdiction/);
    assert.match(source, /governed\\s\+by/);
  });
});
