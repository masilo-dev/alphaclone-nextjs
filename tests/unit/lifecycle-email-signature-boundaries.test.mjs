import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,mocks) {const exports={};const context={exports,require:(name)=>{if(name in mocks)return mocks[name];throw new Error(`Unexpected import ${name}`)},console,Date,Buffer};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(`../../${path}`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);return exports;}
test('review-only token cannot claim or record a signature',async()=>{
 let claims=0;const query={select(){return this},eq(){return this},maybeSingle:async()=>({data:{metadata:{review_only:true}},error:null}),update(){claims++;return this}};
 const module=load('src/services/server/contractServerService.ts',{'@/lib/supabase-admin':{createSupabaseAdminClient:()=>({from:()=>query})},'@/lib/supabase-server':{},crypto:{}});
 await assert.rejects(()=>module.contractServerService.signContractWithToken({signingToken:'test-token',signerEmail:'bonniiehendrix@gmail.com'}),/review only/);assert.equal(claims,0);
});
test('durable receipt retains acceptance and separates bounce; lookup scopes account and tenant',async()=>{
 const filters=[];let message={provider_message_id:'1791401742485001200',provider_account_id:'account',provider_accepted_at:'2026-10-07T19:35:00Z',metadata:{provider:'zoho'}};
 const query={select(){return this},eq(k,v){filters.push([k,v]);return this},maybeSingle:async()=>({data:message,error:null})};
 const module=load('src/lib/email/emailReceiptEvidence.ts',{'@/lib/supabase-admin':{createSupabaseAdminClient:()=>({from:()=>query})},'@/lib/email/reconcileBrevoMessage':{reconcileBrevoMessage:()=>{throw Error('must not reconcile Zoho')}}});
 const receipt={tool:'send_contract',provider_reference:message.provider_message_id,sanitized_output:{providerAccountId:'account'}};
 const accepted=await module.emailReceiptEvidence('tenant','owner',receipt);assert.equal(accepted.delivery_evidence.status,'provider_accepted');assert.equal(accepted.delivery_evidence.delivered_at,undefined);assert.ok(filters.some(([k,v])=>k==='tenant_id'&&v==='tenant'));assert.ok(filters.some(([k,v])=>k==='provider_account_id'&&v==='account'));
 message={...message,bounced_at:'2026-10-08T00:00:00Z'};assert.equal((await module.emailReceiptEvidence('tenant','owner',receipt)).delivery_evidence.status,'bounced');
});
