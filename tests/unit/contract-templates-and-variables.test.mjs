import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRACT_TEMPLATE_REGISTRY,
} from '../../src/lib/contracts/templates/contractTemplateRegistry.ts';
import {
  buildContractVariableContext,
  resolveContractVariables,
  validateContractVariables,
  resolveCanonicalContractStatus,
} from '../../src/lib/contracts/contractVariables.ts';

test('CONTRACT_TEMPLATE_REGISTRY contains all 14 corporate agreement templates', () => {
  const expectedTemplates = [
    'service_agreement',
    'consulting_agreement',
    'nda_mutual',
    'nda_unilateral',
    'independent_contractor',
    'website_development',
    'software_development',
    'marketing_services',
    'maintenance_agreement',
    'retainer_agreement',
    'statement_of_work',
    'master_services_agreement',
    'simple_agreement',
    'custom_agreement',
  ];

  for (const id of expectedTemplates) {
    const template = CONTRACT_TEMPLATE_REGISTRY[id];
    assert.ok(template, `Template ${id} must exist in registry`);
    assert.ok(template.name.length > 0, `Template ${id} must have a name`);
    assert.ok(template.category.length > 0, `Template ${id} must have a category`);
    assert.ok(template.description.length > 0, `Template ${id} must have a description`);
    assert.ok(Array.isArray(template.sections), `Template ${id} must have sections array`);
    assert.ok(template.sections.length >= 3, `Template ${id} must have at least 3 sections`);

    for (const section of template.sections) {
      assert.ok(section.heading.length > 0, `Section in ${id} must have a heading`);
      assert.ok(section.body.length > 0, `Section in ${id} must have body content`);
    }
  }
});

test('buildContractVariableContext builds complete dictionary from records', () => {
  const context = buildContractVariableContext({
    tenant: {
      name: 'Apex Solutions LLC',
      business_address: '100 Innovation Way, Suite 400',
      email: 'billing@apexsolutions.com',
      phone: '+1-555-0199',
      tax_id: 'US-99887766',
    },
    client: {
      name: 'Acme Global Corp',
      company: 'Acme Global Corporation',
      email: 'legal@acmeglobal.com',
      address: '500 Commerce Blvd, New York, NY',
    },
    contract: {
      id: 'f87a98b0-1234-5678-9abc-def012345678',
      title: 'Enterprise Software Agreement',
      payment_amount: 45000,
      currency: 'USD',
      metadata: {
        governing_law: 'State of Delaware',
        jurisdiction: 'Courts of New Castle County, Delaware',
        payment_terms: '50% upon signing, 50% upon delivery',
      },
    },
    project: {
      name: 'Alpha Enterprise Portal',
      description: 'End-to-end development of customer self-service portal',
    },
    user: {
      full_name: 'John Apex',
      email: 'john@apexsolutions.com',
    },
  });

  assert.equal(context.business?.name, 'Apex Solutions LLC');
  assert.equal(context.business?.address, '100 Innovation Way, Suite 400');
  assert.equal(context.client?.name, 'Acme Global Corp');
  assert.equal(context.contract?.number, 'CNT-F87A98B0');
  assert.equal(context.contract?.governing_law, 'State of Delaware');
  assert.equal(context.financial?.total, '45,000.00');
  assert.equal(context.financial?.currency, 'USD');
  assert.equal(context.project?.name, 'Alpha Enterprise Portal');
});

test('resolveContractVariables substitutes {{namespace.key}} and legacy bracket placeholders', () => {
  const context = buildContractVariableContext({
    tenant: { name: 'Acme Systems Inc', business_address: '123 Tech Lane' },
    client: { name: 'Globex Corp', company: 'Globex Corp', address: '456 Market St' },
    contract: {
      id: 'abc-1234-5678',
      metadata: { governing_law: 'State of New York', jurisdiction: 'New York, NY' },
    },
    financial: { total: 12500, currency: 'USD' },
    project: { name: 'Cloud Migration', description: 'Migration to AWS' },
  });

  const rawText = `Agreement between {{business.name}} and {{client.name}} for project {{project.name}}.
Total fee: {{financial.total}} {{financial.currency}}.
Governing law: {{contract.governing_law}}.
Legacy check: [Client Name] shall pay [Your Business Name].`;

  const resolved = resolveContractVariables(rawText, context);

  assert.ok(!resolved.includes('{{business.name}}'));
  assert.ok(!resolved.includes('{{client.name}}'));
  assert.ok(!resolved.includes('{{project.name}}'));
  assert.ok(!resolved.includes('[Client Name]'));
  assert.ok(!resolved.includes('[Your Business Name]'));

  assert.ok(resolved.includes('Acme Systems Inc'));
  assert.ok(resolved.includes('Globex Corp'));
  assert.ok(resolved.includes('Cloud Migration'));
  assert.ok(resolved.includes('State of New York'));
});

test('validateContractVariables detects unresolved {{...}} and legacy brackets', () => {
  const incompleteText = `This agreement is made between {{business.name}} and {{client.name}}.
Fee: {{financial.total}}.
Additional placeholder: [Client Company].`;

  const validation = validateContractVariables(incompleteText);
  assert.equal(validation.valid, false);
  assert.ok(validation.unresolvedTokens.includes('{{business.name}}'));
  assert.ok(validation.unresolvedTokens.includes('{{client.name}}'));
  assert.ok(validation.unresolvedTokens.includes('{{financial.total}}'));
  assert.ok(validation.unresolvedTokens.includes('[Client Company]'));

  const completeText = 'This agreement is made between Acme Corp and Globex LLC with no placeholders.';
  const completeValidation = validateContractVariables(completeText);
  assert.equal(completeValidation.valid, true);
  assert.equal(completeValidation.unresolvedTokens.length, 0);
});

test('resolveCanonicalContractStatus maps legacy database states to canonical lifecycle', () => {
  assert.equal(resolveCanonicalContractStatus('draft'), 'draft');
  assert.equal(resolveCanonicalContractStatus('prepared'), 'prepared');
  assert.equal(resolveCanonicalContractStatus('sent'), 'sent');
  assert.equal(resolveCanonicalContractStatus('viewed'), 'viewed');
  assert.equal(resolveCanonicalContractStatus('client_signed'), 'partially_signed');
  assert.equal(resolveCanonicalContractStatus('fully_signed'), 'signed');
  assert.equal(resolveCanonicalContractStatus('completed'), 'completed');
  assert.equal(resolveCanonicalContractStatus('rejected'), 'declined');
  assert.equal(resolveCanonicalContractStatus('declined'), 'declined');
  assert.equal(resolveCanonicalContractStatus('expired'), 'expired');
  assert.equal(resolveCanonicalContractStatus('voided'), 'voided');
  assert.equal(resolveCanonicalContractStatus('cancelled'), 'cancelled');
});
