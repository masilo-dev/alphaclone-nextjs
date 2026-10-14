import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// PGLITE_MODULE points to an installed local PostgreSQL WASM runtime. No production writes.
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const tenant = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const owner = '33333333-3333-4333-8333-333333333333';
await db.exec('create role anon;create role authenticated;create role service_role;');
await db.exec(fs.readFileSync(new URL('./fixtures/contract-signing-live-schema.sql',import.meta.url),'utf8'));
await db.exec(`alter table contracts add primary key(id);alter table contract_signing_tokens add primary key(id);alter table contract_signing_tokens add unique(token);
alter table contracts add check(status in ('draft','sent','client_signed','fully_signed','signed','rejected','expired','void'));
alter table contract_audit_trail add check(action in ('created','viewed','modified','sent','opened','downloaded','signature_initiated','signature_completed','signature_declined','voided','completed','expired'));
grant usage on schema public to service_role,anon,authenticated;grant select,insert,update on all tables in schema public to service_role;`);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261014105959_atomic_contract_signing.sql',import.meta.url),'utf8'));
await db.query('insert into tenant_users(tenant_id,user_id,role) values($1,$2,$3)',[tenant,owner,'owner']);
let sequence = 0;
async function fixture({ parties=false }={}) {
  const id = `44444444-4444-4444-8444-${String(++sequence).padStart(12,'0')}`;
  const token = `offline-sign-${sequence}`;
  await db.query('insert into contracts(id,tenant_id,title,status,content,metadata) values($1,$2,$3,$4,$5,$6)',[id,tenant,'Offline contract','sent',JSON.stringify('<h1>Agreement</h1><p>USD 1. Final binding clause.</p>'),JSON.stringify({client_email:'client@example.test'})]);
  await db.query('insert into contract_signing_tokens(tenant_id,contract_id,token,signer_email,signer_role,expires_at,metadata) values($1,$2,$3,$4,$5,now()+interval \'1 day\',$6)',[tenant,id,token,'client@example.test','client',JSON.stringify({document_version:'v1'})]);
  if (parties) {
    for (const [role,email,order] of [['client','client@example.test',1],['provider','owner@example.test',2]]) await db.query('insert into contract_parties(tenant_id,contract_id,role,party_snapshot,signing_order) values($1,$2,$3,$4,$5)',[tenant,id,role,JSON.stringify({email,name:role}),order]);
  }
  return {id,token};
}
const request = f => ({signingToken:f.token,signerName:'Fixture Client',signerEmail:'client@example.test',signatureDataUrl:'data:image/png;base64,AAAA',consentGiven:true,ipAddress:'127.0.0.1',userAgent:'offline-test'});
const sign = async req => (await db.query('select record_contract_signature_atomic($1::jsonb) as result',[JSON.stringify(req)])).rows[0].result;
const counts = async id => (await db.query(`select (select count(*) from signature_events where contract_id=$1)::int as signatures,(select count(*) from esignature_consents where contract_id=$1)::int as consents,(select count(*) from contract_audit_trail where contract_id=$1)::int as audits,(select count(*) from contract_signature_events where contract_id=$1)::int as canonical`,[id])).rows[0];

test('client/provider evidence, consent, status and audit commit atomically and source/amount stay unchanged',async()=>{
  const f=await fixture({parties:true});const first=await sign(request(f));
  assert.equal(first.contract.status,'sent');assert.equal(first.replayed,false);
  const completed=await sign({contractId:f.id,userId:owner,role:'admin',signerName:'Owner',signerEmail:'owner@example.test',signatureDataUrl:'typed:Owner',consentGiven:true,ipAddress:'127.0.0.1'});
  assert.equal(completed.contract.status,'fully_signed');assert.match(completed.contract.content,/USD 1/);
  assert.deepEqual(await counts(f.id),{signatures:2,consents:2,audits:2,canonical:2});
  const token=(await db.query('select used_at,metadata from contract_signing_tokens where token=$1',[f.token])).rows[0];
  assert.ok(token.used_at);assert.equal(token.metadata.document_version,'v1');
});
test('simultaneous identical submissions return one new signature and one replay',async()=>{
  const f=await fixture();const results=await Promise.all([sign(request(f)),sign(request(f))]);
  assert.equal(results.filter(r=>r.replayed).length,1);
  assert.deepEqual(await counts(f.id),{signatures:1,consents:1,audits:1,canonical:1});
});
test('a legacy provider signature is preserved when only the client is a canonical party',async()=>{
  const f=await fixture();
  await db.query('update contracts set admin_signature=$1,admin_signed_at=$2 where id=$3',['typed:Existing Provider','2026-10-01T12:00:00Z',f.id]);
  await db.query('insert into contract_parties(tenant_id,contract_id,role,party_snapshot,signing_order) values($1,$2,$3,$4,1)',[tenant,f.id,'client',JSON.stringify({email:'client@example.test'})]);
  const signed=await sign(request(f));
  assert.equal(signed.contract.status,'fully_signed');
  assert.equal(signed.contract.admin_signature,'typed:Existing Provider');
  assert.equal(Date.parse(signed.contract.admin_signed_at),Date.parse('2026-10-01T12:00:00Z'));
  assert.equal((await counts(f.id)).signatures,1);
});
test('different signature cannot overwrite a used token or stored evidence',async()=>{
  const f=await fixture();await sign(request(f));await assert.rejects(sign({...request(f),signatureDataUrl:'typed:different'}),/already signed/);
  assert.equal((await counts(f.id)).signatures,1);
});
test('a late audit failure rolls back every write and leaves the token usable',async()=>{
  const f=await fixture({parties:true});
  await db.exec(`create function offline_fail_audit() returns trigger language plpgsql as $$begin raise exception 'injected audit failure'; end;$$; create trigger fail_audit before insert on contract_audit_trail for each row execute function offline_fail_audit();`);
  try {await assert.rejects(sign(request(f)),/injected audit failure/);} finally {await db.exec('drop trigger fail_audit on contract_audit_trail;drop function offline_fail_audit();');}
  assert.deepEqual(await counts(f.id),{signatures:0,consents:0,audits:0,canonical:0});
  assert.equal((await db.query('select used_at from contract_signing_tokens where token=$1',[f.token])).rows[0].used_at,null);
  assert.equal((await db.query('select count(*)::int as n from contract_parties where contract_id=$1 and signature_status=\'signed\'',[f.id])).rows[0].n,0);
  await sign(request(f));assert.equal((await counts(f.id)).signatures,1);
});
test('review-only, expired, revoked, wrong-email and cross-tenant links do not write evidence',async()=>{
  for (const mode of ['review','expired','revoked','email','tenant']) {
    const f=await fixture();
    if(mode==='review')await db.query('update contract_signing_tokens set metadata=metadata || \'{"review_only":true}\' where token=$1',[f.token]);
    if(mode==='expired')await db.query('update contract_signing_tokens set expires_at=now()-interval \'1 day\' where token=$1',[f.token]);
    if(mode==='revoked')await db.query('update contract_signing_tokens set revoked_at=now() where token=$1',[f.token]);
    if(mode==='tenant')await db.query('update contract_signing_tokens set tenant_id=$1 where token=$2',[other,f.token]);
    await assert.rejects(sign({...request(f),...(mode==='email'?{signerEmail:'wrong@example.test'}:{})}));
    assert.equal((await counts(f.id)).signatures,0);
  }
});
test('provider order and authenticated client identity are enforced',async()=>{
  const f=await fixture({parties:true});
  await assert.rejects(sign({contractId:f.id,userId:owner,role:'admin',signerName:'Owner',signerEmail:'owner@example.test',signatureDataUrl:'typed:Owner',consentGiven:true}),/earlier signer/);
  await assert.rejects(sign({contractId:f.id,userId:owner,role:'client',signerName:'Wrong',signerEmail:'wrong@example.test',signatureDataUrl:'typed:Wrong',consentGiven:true}),/authorized party/);
});
test('anonymous and authenticated database roles cannot call the signing function directly',async()=>{
  for(const role of ['anon','authenticated']){
    await db.exec(`set role ${role}`);
    try {await assert.rejects(sign({}),/permission denied/);} finally {await db.exec('reset role');}
  }
});
test.after(()=>db.close());
