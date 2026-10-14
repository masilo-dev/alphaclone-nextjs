import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSavedBusinessSignature,applySavedBusinessSignature} from '../../src/lib/contracts/savedBusinessSignature.ts';
function fixture(role='owner') {
 const requests=[];
 const rows={tenant_users:[{tenant_id:'t',user_id:'u',role}],contracts:[{id:'c',tenant_id:'t',status:'sent',content:'Approved agreement'}],profiles:[{id:'u',custom_fields:{contract_signer_profile:{providerEmail:'owner@example.test',signature:{fullName:'Owner',dataUrl:'data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAA'}}}}]};
 return {requests,db:{from(table){const filters=[];const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},async maybeSingle(){return {data:rows[table].find(r=>filters.every(f=>f(r)))||null,error:null}}};return q},async rpc(name,args){requests.push({name,args});return {data:{contract:{status:'sent'},signature_event_id:'event'},error:null}}}};
}
test('saved signature cannot be applied without contract-specific approval and consent',async()=>{
 const {db,requests}=fixture();await assert.rejects(()=>applySavedBusinessSignature(db,{tenantId:'t',userId:'u',contractId:'c',ownerApproved:false,consentGiven:true,expectedContentHash:'hash'}),/approval/);assert.equal(requests.length,0);
});
test('tenant membership and exact approved content guard signing',async()=>{
 const {db,requests}=fixture();await assert.rejects(()=>inspectSavedBusinessSignature(db,'other','u','c'),/administrator/);
 await assert.rejects(()=>applySavedBusinessSignature(db,{tenantId:'t',userId:'u',contractId:'c',ownerApproved:true,consentGiven:true,expectedContentHash:'stale'}),/changed/);assert.equal(requests.length,0);
});
test('business signature uses authenticated actor and atomic evidence without signing client',async()=>{
 const {db,requests}=fixture();const prepared=await inspectSavedBusinessSignature(db,'t','u','c');
 const result=await applySavedBusinessSignature(db,{tenantId:'t',userId:'u',contractId:'c',ownerApproved:true,consentGiven:true,expectedContentHash:prepared.contentHash});
 assert.equal(requests[0].args.p_request.role,'admin');assert.equal(requests[0].args.p_request.userId,'u');assert.equal(requests[0].args.p_request.expectedContentHash,prepared.contentHash);
 assert.equal(result.status,'sent');assert.equal(result.signature_event_id,'event');assert.equal(JSON.stringify(result).includes('base64'),false);
});
