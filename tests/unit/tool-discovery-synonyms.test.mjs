import test from 'node:test';
import assert from 'node:assert/strict';
import { findToolsByQuery } from '../../src/lib/mcp/progressiveDiscovery.ts';

test('Progressive Discovery & Synonyms Map', async (t) => {
  await t.test('discovers PDF tools from intent query "send PDF"', () => {
    const tools = findToolsByQuery('send PDF');
    const names = tools.map((t) => t.name);
    assert.ok(names.length > 0, 'Expected at least one matching tool for "send PDF"');
    assert.ok(
      names.includes('send_invoice') || names.includes('send_contract') || names.includes('preview_send_package') || names.includes('render_document_pdf'),
      `Expected document/pdf send tools, got: ${names.join(', ')}`
    );
  });

  await t.test('discovers document tools from "upload document"', () => {
    const tools = findToolsByQuery('upload document');
    const names = tools.map((t) => t.name);
    assert.ok(names.length > 0, 'Expected at least one matching tool for "upload document"');
    assert.ok(
      names.includes('upload_file') || names.includes('save_document_version') || names.includes('create_quote'),
      `Expected upload/document tools, got: ${names.join(', ')}`
    );
  });

  await t.test('discovers client portal tools from "client portal access"', () => {
    const tools = findToolsByQuery('client portal access');
    const names = tools.map((t) => t.name);
    assert.ok(names.length > 0, 'Expected at least one matching tool for "client portal access"');
    assert.ok(
      names.includes('enable_client_portal_access') || names.includes('get_client_portal_status'),
      `Expected portal tools, got: ${names.join(', ')}`
    );
  });

  await t.test('discovers customer correction tools from "correct customer email"', () => {
    const tools = findToolsByQuery('correct customer email');
    const names = tools.map((t) => t.name);
    assert.ok(names.length > 0, 'Expected at least one matching tool for "correct customer email"');
    assert.ok(
      names.includes('correct_customer_identity') || names.includes('update_client') || names.includes('update_contact'),
      `Expected identity correction tools, got: ${names.join(', ')}`
    );
  });

  await t.test('discovers customer 360 tools from "customer history"', () => {
    const tools = findToolsByQuery('customer history');
    const names = tools.map((t) => t.name);
    assert.ok(names.length > 0, 'Expected at least one matching tool for "customer history"');
    assert.ok(
      names.includes('get_customer_360') || names.includes('get_client_history') || names.includes('get_client'),
      `Expected 360/history tools, got: ${names.join(', ')}`
    );
  });

  await t.test('discovers workflow resumption tools from "resume invoice"', () => {
    const tools = findToolsByQuery('resume invoice');
    const names = tools.map((t) => t.name);
    assert.ok(names.length > 0, 'Expected at least one matching tool for "resume invoice"');
    assert.ok(
      names.includes('resume_workflow') || names.includes('send_invoice') || names.includes('create_invoice'),
      `Expected workflow or invoice tools, got: ${names.join(', ')}`
    );
  });
});
