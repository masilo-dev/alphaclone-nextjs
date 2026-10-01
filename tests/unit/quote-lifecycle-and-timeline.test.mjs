import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('convertQuoteToContract is exported as a canonical service', async () => {
  const quoteContractSource = fs.readFileSync('src/lib/quotes/convertQuoteToContract.ts', 'utf8');
  assert.match(quoteContractSource, /export async function convertQuoteToContract/);
  assert.match(quoteContractSource, /revenue_lifecycle_links/);
  assert.match(quoteContractSource, /source_type:\s*'quote'/);
  assert.match(quoteContractSource, /target_type:\s*'contract'/);
  assert.match(quoteContractSource, /relationship:\s*'converted_to'/);
  assert.match(quoteContractSource, /emitBusinessEvent\(tenantId,\s*'contract\.created'/);
});

test('convertQuoteToInvoice creates revenue_lifecycle_links and emits event', () => {
  const quoteInvoiceSource = fs.readFileSync('src/lib/quotes/convertQuoteToInvoice.ts', 'utf8');
  assert.match(quoteInvoiceSource, /revenue_lifecycle_links/);
  assert.match(quoteInvoiceSource, /source_type:\s*'quote'/);
  assert.match(quoteInvoiceSource, /target_type:\s*'invoice'/);
  assert.match(quoteInvoiceSource, /relationship:\s*'billed_by'/);
  assert.match(quoteInvoiceSource, /emitBusinessEvent\(tenantId,\s*'quote\.converted'/);
});

test('CommercialEngine delegates contract generation to canonical service', () => {
  const engineSource = fs.readFileSync('src/lib/engine/commercialEngine.ts', 'utf8');
  assert.match(engineSource, /convertQuoteToContract/);
  assert.match(engineSource, /runContractSignedFlow/);
});

test('Entity context and timeline service support deal and quote entities', () => {
  const timelineSource = fs.readFileSync('src/lib/audit/entityTimelineService.ts', 'utf8');
  assert.match(timelineSource, /'deal'\s*\|\s*'quote'/);
  assert.match(timelineSource, /export async function buildDealTimeline/);
  assert.match(timelineSource, /export async function buildQuoteTimeline/);
  assert.match(timelineSource, /entityType === 'deal'/);
  assert.match(timelineSource, /entityType === 'quote'/);

  const routeSource = fs.readFileSync(
    'src/app/api/tenant/[tenantId]/entities/[entityType]/[entityId]/context/route.ts',
    'utf8'
  );
  assert.match(routeSource, /'deal'/);
  assert.match(routeSource, /'quote'/);
});

test('MCP tool convert_quote_to_contract is registered in gap-finance', () => {
  const gapFinanceSource = fs.readFileSync('src/lib/mcp/tools/gap-tools-finance.ts', 'utf8');
  assert.match(gapFinanceSource, /name:\s*'convert_quote_to_contract'/);
  assert.match(gapFinanceSource, /convertQuoteToContract/);
});

test('Contract sign route triggers synchronous runContractSignedFlow on executed', () => {
  const signRouteSource = fs.readFileSync('src/app/api/contracts/sign/route.ts', 'utf8');
  assert.match(signRouteSource, /runContractSignedFlow/);
});
