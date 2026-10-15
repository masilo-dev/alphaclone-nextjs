import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

function load(path, dependencies = {}) {
  const source = fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(
    code,
    {
      exports,
      require: (name) => {
        if (name === 'node:crypto' || name === 'crypto') return crypto;
        if (dependencies[name]) return dependencies[name];
        if (name === '@/lib/supabase-admin') {
          return {
            createSupabaseAdminClient: () => dependencies.__mockAdmin || {},
            resolveSupabaseAdminClient: async () => dependencies.__mockAdmin || {},
          };
        }
        if (name === '@/services/businessInvoiceService') {
          return {
            businessInvoiceService: dependencies.__mockInvoiceService || {
              getInvoiceWithDetails: async () => ({ invoice: null, error: 'Not found' }),
            },
          };
        }
        if (name === '@/lib/email/sendEmailServer') {
          return {
            sendEmailServer: dependencies.__mockSendEmailServer || (async () => ({ success: true, provider: 'zoho', emailId: 'msg-123' })),
          };
        }
        if (name === '@/lib/email/invoiceEmailTemplates') {
          return {
            invoiceEmailTemplates: {
              invoiceSent: () => '<html>Invoice Sent</html>',
              invoiceOverdue: () => '<html>Invoice Overdue</html>',
            },
          };
        }
        if (name === '@/lib/invoices/publicInvoiceAccess') {
          return {
            getPublicInvoicePaymentUrl: async () => 'https://alphaclonesystems.com/invoice/inv-1?token=tok-1',
          };
        }
        if (name === '@/lib/audit/invoiceAuditLogger') {
          return { logInvoiceEvent: async () => {} };
        }
        if (name === '@/lib/documents/themedDocumentPdf') {
          return {
            generateThemedInvoicePdfBuffer: async () => Buffer.from('%PDF-1.4 test invoice pdf content'),
          };
        }
        if (name === '@/lib/server/dailyResourceQuota') {
          return { recordDailyResourceQuota: async () => {} };
        }
        if (name === '@/lib/documents/fileDocument') {
          return { fileInvoiceDocument: async () => {} };
        }
        if (name === '@/lib/invoices/postInvoiceIssueJournalServer') {
          return { postInvoiceIssueJournalServer: async () => {} };
        }
        if (name === '@/lib/invoices/invoiceLifecycleFollowUp') {
          return { scheduleInvoiceLifecycleFollowUp: async () => {} };
        }
        if (name === '@/lib/tenant/platformTenant') {
          return load('src/lib/tenant/platformTenant.ts');
        }
        return {};
      },
      crypto,
      console,
      setTimeout,
      clearTimeout,
      process,
      Buffer,
      Uint8Array,
      ...(dependencies.__globals || {}),
    },
    { filename: path }
  );
  return exports;
}

// Helper to create chainable Supabase query builders for unit tests
function createChainableQuery(defaultRow = { name: 'Test Tenant', id: 'inv-456' }) {
  const chain = {
    eq: () => chain,
    in: () => chain,
    order: () => Promise.resolve({ data: [defaultRow], error: null }),
    limit: () => chain,
    select: () => chain,
    maybeSingle: async () => ({ data: defaultRow, error: null }),
    single: async () => ({ data: defaultRow, error: null }),
    then: (resolve) => resolve({ data: [defaultRow], error: null }),
  };
  return chain;
}

// ----------------------------------------------------------------------------
// Test 1: Bucket self-healing creation logic
// ----------------------------------------------------------------------------
test('1. ensureInvoiceDocumentsBucket creates bucket if missing and succeeds idempotently', async () => {
  let createdBucketName = '';
  let createdBucketOpts = null;
  const mockAdmin = {
    storage: {
      getBucket: async (name) => {
        if (name === 'invoice-documents') return { data: null, error: { message: 'Bucket not found' } };
        return { data: null, error: { message: 'Not found' } };
      },
      createBucket: async (name, opts) => {
        createdBucketName = name;
        createdBucketOpts = opts;
        return { data: { name }, error: null };
      },
    },
  };

  const { ensureInvoiceDocumentsBucket, INVOICE_DOCUMENTS_BUCKET } = load('src/lib/invoices/invoiceLifecycleSteps.ts');
  assert.equal(INVOICE_DOCUMENTS_BUCKET, 'invoice-documents');

  await ensureInvoiceDocumentsBucket(mockAdmin);
  assert.equal(createdBucketName, 'invoice-documents');
  assert.equal(createdBucketOpts.public, false);
  assert.equal(createdBucketOpts.fileSizeLimit, 15728640);
  assert.deepEqual(Array.from(createdBucketOpts.allowedMimeTypes), ['application/pdf']);
});

// ----------------------------------------------------------------------------
// Test 2: generateAndStoreInvoicePdf retries bucket creation on "Bucket not found"
// ----------------------------------------------------------------------------
test('2. generateAndStoreInvoicePdf handles bucket not found by auto-provisioning and uploading', async () => {
  let bucketCreated = false;
  let uploadAttempts = 0;
  let uploadedPath = '';

  const mockAdmin = {
    storage: {
      getBucket: async () => ({ data: bucketCreated ? { name: 'invoice-documents' } : null, error: bucketCreated ? null : { message: 'Not found' } }),
      createBucket: async () => {
        bucketCreated = true;
        return { data: { name: 'invoice-documents' }, error: null };
      },
      from: () => ({
        upload: async (path) => {
          uploadAttempts++;
          if (!bucketCreated) {
            return { data: null, error: { message: 'Bucket not found' } };
          }
          uploadedPath = path;
          return { data: { path }, error: null };
        },
      }),
    },
    from: (table) => ({
      select: () => createChainableQuery({ id: 'inv-456', invoice_number: 'INV-456', name: 'Test Tenant' }),
      update: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    }),
  };

  const mockInvoiceService = {
    getInvoiceWithDetails: async () => ({
      invoice: {
        id: 'inv-456',
        tenant_id: 'tenant-123',
        invoice_number: 'INV-456',
        client: { name: 'Client Test', email: 'client@example.com' },
      },
      error: null,
    }),
  };

  const { generateAndStoreInvoicePdf } = load('src/lib/invoices/invoiceLifecycleSteps.ts', {
    __mockAdmin: mockAdmin,
    __mockInvoiceService: mockInvoiceService,
  });

  const res = await generateAndStoreInvoicePdf('inv-456', 'tenant-123');
  assert.ok(res.storagePath.includes('tenant-123') && res.storagePath.includes('inv-456'));
  assert.equal(uploadedPath, res.storagePath);
  assert.ok(uploadAttempts >= 1, 'Should have executed upload');
});

// ----------------------------------------------------------------------------
// Test 3: generateAndStoreInvoicePdf falls back to metadata when column 42703 occurs
// ----------------------------------------------------------------------------
test('3. generateAndStoreInvoicePdf falls back to metadata update if pdf_storage_path column is missing', async () => {
  let metaUpdated = false;
  let savedMetadata = null;

  const mockAdmin = {
    storage: {
      getBucket: async () => ({ data: { name: 'invoice-documents' }, error: null }),
      from: () => ({
        upload: async (path) => ({ data: { path }, error: null }),
      }),
    },
    from: (table) => ({
      select: () => createChainableQuery({ id: 'inv-col-missing', invoice_number: 'INV-COL', name: 'Test Tenant' }),
      update: (fields) => {
        if ('pdf_storage_path' in fields) {
          return {
            eq: () => ({
              eq: () => Promise.resolve({ error: { code: '42703', message: 'column business_invoices.pdf_storage_path does not exist' } }),
            }),
          };
        }
        if ('metadata' in fields) {
          metaUpdated = true;
          savedMetadata = fields.metadata;
          return {
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        }
        return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      },
    }),
  };

  const mockInvoiceService = {
    getInvoiceWithDetails: async () => ({
      invoice: {
        id: 'inv-col-missing',
        tenant_id: 'tenant-123',
        invoice_number: 'INV-COL',
        metadata: { existing_key: 'value' },
      },
      error: null,
    }),
  };

  const { generateAndStoreInvoicePdf } = load('src/lib/invoices/invoiceLifecycleSteps.ts', {
    __mockAdmin: mockAdmin,
    __mockInvoiceService: mockInvoiceService,
  });

  const res = await generateAndStoreInvoicePdf('inv-col-missing', 'tenant-123');
  assert.ok(metaUpdated, 'Metadata fallback must be executed on column 42703');
  assert.equal(savedMetadata.pdf_storage_path, res.storagePath);
  assert.equal(savedMetadata.existing_key, 'value');
  assert.ok(savedMetadata.pdf_generated_at);
});

// ----------------------------------------------------------------------------
// Test 4: sendInvoiceEmailPhase auto-generates missing PDF and sends
// ----------------------------------------------------------------------------
test('4. sendInvoiceEmailPhase automatically regenerates and stores PDF if missing before dispatch', async () => {
  let emailDispatched = false;
  let attachedPdfFilename = '';
  let attachedPdfBytes = 0;

  const mockAdmin = {
    storage: {
      getBucket: async () => ({ data: { name: 'invoice-documents' }, error: null }),
      from: () => ({
        download: async () => ({
          data: {
            arrayBuffer: async () => Buffer.from('%PDF-1.4 fresh buffer'),
          },
          error: null,
        }),
        upload: async (path) => ({ data: { path }, error: null }),
      }),
    },
    from: (table) => {
      if (table === 'invoice_delivery_log') {
        return { insert: async () => ({ error: null }) };
      }
      return {
        select: () => createChainableQuery({ id: 'inv-no-pdf', invoice_number: 'INV-AUTO', name: 'Test Tenant' }),
        update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
      };
    },
  };

  const mockInvoiceService = {
    getInvoiceWithDetails: async () => ({
      invoice: {
        id: 'inv-no-pdf',
        tenant_id: 'tenant-123',
        invoice_number: 'INV-AUTO',
        client: { name: 'Valued Client', email: 'client@example.com' },
        pdf_storage_path: null, // PDF is missing
      },
      error: null,
    }),
  };

  const mockSendEmailServer = async (params) => {
    emailDispatched = true;
    if (params.attachments && params.attachments[0]) {
      attachedPdfFilename = params.attachments[0].filename;
      attachedPdfBytes = Buffer.from(params.attachments[0].content, 'base64').byteLength;
    }
    return { success: true, provider: 'brevo', emailId: 'brevo-msg-789' };
  };

  const { sendInvoiceEmailPhase } = load('src/lib/invoices/invoiceLifecycleSteps.ts', {
    __mockAdmin: mockAdmin,
    __mockInvoiceService: mockInvoiceService,
    __mockSendEmailServer: mockSendEmailServer,
  });

  const res = await sendInvoiceEmailPhase({
    invoiceId: 'inv-no-pdf',
    tenantId: 'tenant-123',
  });

  assert.ok(emailDispatched, 'Email must be dispatched');
  assert.equal(res.provider, 'brevo');
  assert.equal(res.emailId, 'brevo-msg-789');
  assert.equal(attachedPdfFilename, 'Invoice_INV-AUTO.pdf');
  assert.ok(attachedPdfBytes > 0, 'PDF attachment must contain valid bytes');
});

// ----------------------------------------------------------------------------
// Test 5: Storage path prefix validation in assertTenantStoragePath
// ----------------------------------------------------------------------------
test('5. assertTenantStoragePath accepts both tenant/{tenantId}/ and {tenantId}/ formats', () => {
  const { assertTenantStoragePath } = load('src/lib/tenant/platformTenant.ts');

  // Both should pass without throwing
  assert.doesNotThrow(() => {
    assertTenantStoragePath({
      filePath: 'tenant/tenant-abc/invoices/inv-1.pdf',
      tenantId: 'tenant-abc',
    });
  });

  assert.doesNotThrow(() => {
    assertTenantStoragePath({
      filePath: 'tenant-abc/inv-1/invoice.pdf',
      tenantId: 'tenant-abc',
    });
  });

  // Cross-tenant path must throw NOT_FOUND
  assert.throws(
    () => {
      assertTenantStoragePath({
        filePath: 'tenant/other-tenant/invoices/inv-1.pdf',
        tenantId: 'tenant-abc',
      });
    },
    /Storage path not found for this workspace/
  );
});

// ----------------------------------------------------------------------------
// Test 6: Storage proxy route whitelists invoice-documents as private bucket
// ----------------------------------------------------------------------------
test('6. Storage proxy whitelists invoice-documents and enforces tenant authorization', () => {
  const routeSource = fs.readFileSync(new URL('../../src/app/api/storage/[bucket]/[...path]/route.ts', import.meta.url), 'utf8');
  assert.ok(routeSource.includes("'invoice-documents'"), 'route.ts must include invoice-documents in privateBuckets');
  assert.ok(routeSource.includes("const privateBuckets = new Set"), 'privateBuckets must be defined');
});

// ----------------------------------------------------------------------------
// Test 7: Public invoice PDF route authorization logic
// ----------------------------------------------------------------------------
test('7. /api/invoices/[id]/pdf route supports metadata public_token and legacy token', () => {
  const routeSource = fs.readFileSync(new URL('../../src/app/api/invoices/[id]/pdf/route.ts', import.meta.url), 'utf8');
  assert.ok(routeSource.includes('metadata->>public_token'), 'Should query metadata->>public_token');
  assert.ok(routeSource.includes('Buffer.from(publicToken, \'base64url\')'), 'Should support legacy base64url invoice ID matching');
});

// ----------------------------------------------------------------------------
// Test 8: Public invoice page download PDF handler
// ----------------------------------------------------------------------------
test('8. /app/invoice/[id]/page.tsx passes public token and download parameter', () => {
  const pageSource = fs.readFileSync(new URL('../../src/app/invoice/[id]/page.tsx', import.meta.url), 'utf8');
  assert.ok(pageSource.includes('/api/invoices/${invoice.id}/pdf'), 'Should query /api/invoices/${invoice.id}/pdf');
  assert.ok(pageSource.includes('qs.set(\'download\', \'true\')'), 'Should include download=true');
  assert.ok(pageSource.includes('qs.set(\'token\', token)'), 'Should attach public token');
});

// ----------------------------------------------------------------------------
// Test 9: DocumentPreview container and height sync
// ----------------------------------------------------------------------------
test('9. DocumentPreview has dynamic height sync and overflow-visible wrapper on expandToContent', () => {
  const previewSource = fs.readFileSync(new URL('../../src/components/documents/DocumentPreview.tsx', import.meta.url), 'utf8');
  assert.ok(previewSource.includes('syncHeight'), 'Must define syncHeight handler');
  assert.ok(previewSource.includes('body.scrollHeight'), 'Must measure body.scrollHeight');
  assert.ok(previewSource.includes('docEl.scrollHeight'), 'Must measure docEl.scrollHeight');
  assert.ok(previewSource.includes("expandToContent ? 'overflow-visible' : 'overflow-hidden'"), 'Must use overflow-visible when expandToContent is true');
  assert.ok(previewSource.includes("scrolling={expandToContent ? 'no' : 'auto'}"), 'Must disable internal iframe scrolling so parent page scrolls naturally');
});

// ----------------------------------------------------------------------------
// Test 10: Contract page container removes overflow-hidden scroll traps
// ----------------------------------------------------------------------------
test('10. Contract signing page does not enclose document or SignaturePad in overflow-hidden', () => {
  const contractPageSource = fs.readFileSync(new URL('../../src/app/contract/[id]/page.tsx', import.meta.url), 'utf8');
  // Outer card should not have overflow-hidden
  assert.ok(!contractPageSource.includes('sm:rounded-2xl overflow-hidden shadow-2xl'), 'Outer card must not have overflow-hidden');
  assert.ok(contractPageSource.includes('sm:rounded-2xl shadow-2xl'), 'Outer card retains rounded shadow layout');

  // SignaturePad wrapper should not have overflow-hidden
  assert.ok(!contractPageSource.includes('overflow-hidden bg-white rounded-xl transition-opacity'), 'SignaturePad must not be trapped in overflow-hidden bg-white');
  assert.ok(contractPageSource.includes('initialFullName={legalName}'), 'SignaturePad receives pre-populated legalName');
});

// ----------------------------------------------------------------------------
// Test 11: SignaturePad synchronizes initialFullName on asynchronous update
// ----------------------------------------------------------------------------
test('11. SignaturePad synchronizes initialFullName when prop updates asynchronously', () => {
  const padSource = fs.readFileSync(new URL('../../src/components/contracts/SignaturePad.tsx', import.meta.url), 'utf8');
  assert.ok(padSource.includes('useEffect(() => {'), 'Must include useEffect for prop synchronization');
  assert.ok(padSource.includes('if (initialFullName && !fullName)'), 'Must update fullName if unset');
});

// ----------------------------------------------------------------------------
// Test 12: Additive database migration provisions invoice-documents bucket
// ----------------------------------------------------------------------------
test('12. Additive migration provisions invoice-documents bucket with RLS and columns', () => {
  const migrationSource = fs.readFileSync(new URL('../../supabase/migrations/20261015110000_provision_invoice_documents_bucket.sql', import.meta.url), 'utf8');
  assert.ok(migrationSource.includes("INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)"), 'Must insert into storage.buckets');
  assert.ok(migrationSource.includes("'invoice-documents'"), 'Must name bucket invoice-documents');
  assert.ok(migrationSource.includes("15728640"), 'Must enforce 15MB limit');
  assert.ok(migrationSource.includes("ARRAY['application/pdf']"), 'Must restrict allowed_mime_types to PDF');
  assert.ok(migrationSource.includes("invoice_documents_tenant_read"), 'Must configure tenant read policy');
  assert.ok(migrationSource.includes("pdf_storage_path"), 'Must ensure pdf_storage_path column exists');
  assert.ok(migrationSource.includes("pdf_generated_at"), 'Must ensure pdf_generated_at column exists');
});

// ----------------------------------------------------------------------------
// Test 13: globals.css does not trap .ac-business-root in overflow: hidden or 100dvh
// ----------------------------------------------------------------------------
test('13. globals.css does not trap .ac-business-root in overflow: hidden or 100dvh', () => {
  const cssSource = fs.readFileSync(new URL('../../src/app/globals.css', import.meta.url), 'utf8');
  assert.ok(!cssSource.includes('.ac-business-root {\n  height: 100dvh;\n  height: 100svh;\n  overflow: hidden;'), 'ac-business-root must not have fixed 100dvh + overflow: hidden');
  assert.ok(!cssSource.includes('.ac-dashboard-root,\n.ac-business-root {\n  height: 100dvh'), 'ac-business-root must not share 100dvh rule with dashboard-root');
  assert.ok(cssSource.includes('.ac-business-root {\n  width: 100%;\n  min-height: 100%;'), 'ac-business-root must allow natural document height');
});
