import test from 'node:test';
import assert from 'node:assert/strict';
import { documentPreviewUrl } from '../../src/lib/documents/previewSource.ts';
test('file previews preserve bucket, escape path characters and scope tenant', () => {
 assert.equal(documentPreviewUrl({storage_path:'tenant/file #1.pdf',metadata:{storage_bucket:'contracts'}},'t'), '/api/storage/contracts/tenant/file%20%231.pdf?tenantId=t');
});
test('Supabase PDF URLs resolve to storage keys, stripping expired tokens', () => {
 assert.equal(documentPreviewUrl({storage_path:'https://project.supabase.co/storage/v1/object/sign/documents/tenant/a%20b.pdf?token=expired'},'t'), '/api/storage/documents/tenant/a%20b.pdf?tenantId=t');
});
test('existing proxies refresh tenant hint, missing files have no invented URL', () => {
 assert.equal(documentPreviewUrl({storage_path:'/api/storage/uploads/a.pdf?tenantId=old'},'new'), '/api/storage/uploads/a.pdf?tenantId=new');
 assert.equal(documentPreviewUrl({},'t'),null);
 assert.equal(documentPreviewUrl({storage_path:'https://example.com/a.pdf'},'t'),'https://example.com/a.pdf');
});
test('CRM and generated vault files use their bucket tags', () => {
 assert.equal(documentPreviewUrl({storage_path:'tenant/invoice.pdf', tags:['invoice', 'bucket:invoice-documents']},'t'), '/api/storage/invoice-documents/tenant/invoice.pdf?tenantId=t');
 assert.equal(documentPreviewUrl({storage_path:'tenant/contract.pdf', tags:['bucket:contracts']},'t'), '/api/storage/contracts/tenant/contract.pdf?tenantId=t');
});
