import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { NextRequest } from 'next/server';
const hooks = registerHooks({
 resolve(specifier,context,next){const map={'@/lib/supabase-admin':'file-test:db','@/lib/clientPortal/files':'file-test:files'};return map[specifier]?{url:map[specifier],shortCircuit:true}:next(specifier,context);},
 load(url,context,next){const source=url==='file-test:db'?'export const createSupabaseAdminClient=()=>globalThis.__fileDb;':url==='file-test:files'?'export const readContractFile=async()=>{globalThis.__fileReads++;return globalThis.__storedPdf;}':null;return source?{format:'module',source,shortCircuit:true}:next(url,context);}
});
const {GET}=await import('../../src/app/api/contracts/file/route.ts');
const valid={tenant_id:'tenant-a',contract_id:'contract-a',expires_at:'2099-01-01',used_at:'2026-01-01',metadata:{signature_event_id:'event-a'}};
function setup(link=valid,contract={id:'contract-a',tenant_id:'tenant-a',status:'fully_signed'}){
 globalThis.__fileReads=0;globalThis.__storedPdf={bytes:new TextEncoder().encode('%PDF-fixture')};
 globalThis.__fileDb={from(table){const q={select(){return q;},eq(key,value){if(table==='contracts')assert.equal(value,key==='id'?'contract-a':'tenant-a');return q;},async maybeSingle(){return {data:table==='contracts'?contract:link,error:null};}};return q;}};
}
const request=()=>new NextRequest('https://example.test/api/contracts/file?token=fixture');
test('completed signer receives recorded PDF with private headers',async()=>{setup();const r=await GET(request());assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal(await r.text(),'%PDF-fixture');assert.equal(globalThis.__fileReads,1);});
test('invalid expired revoked unused tokens cannot access storage',async()=>{for(const link of [null,{...valid,expires_at:'invalid'},{...valid,expires_at:'2020-01-01'},{...valid,revoked_at:'2026-01-01'},{...valid,used_at:null},{...valid,metadata:{}}]){setup(link);assert.ok([403,410].includes((await GET(request())).status));assert.equal(globalThis.__fileReads,0);}});
test('tenant mismatch and incomplete contracts cannot access storage',async()=>{for(const [contract,status]of [[{tenant_id:'tenant-b',status:'signed'},404],[{tenant_id:'tenant-a',status:'client_signed'},409]]){setup(valid,contract);assert.equal((await GET(request())).status,status);assert.equal(globalThis.__fileReads,0);}});
test('missing executed PDF remains missing rather than regenerating evidence',async()=>{setup();globalThis.__storedPdf=null;const r=await GET(request());assert.equal(r.status,404);assert.equal((await r.json()).code,'SIGNED_FILE_MISSING');});
test.after(()=>{hooks.deregister();delete globalThis.__fileDb;delete globalThis.__fileReads;delete globalThis.__storedPdf;});
