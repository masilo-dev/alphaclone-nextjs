import test from 'node:test';
import assert from 'node:assert/strict';
import {projectNotificationSuppression,projectEventCopy,processProjectNotificationOutbox} from '../../src/lib/projects/projectNotificationOutbox.ts';
import {contractIsFullyExecuted} from '../../src/lib/contracts/projectExecutionAuthorization.ts';
function database(rows) {
 return {from(table) {let filters=[],patch,max=Infinity;const q={select(){return q},order(){return q},limit(n){max=n;return q},eq(k,v){filters.push(r=>r[k]===v);return q},lt(k,v){filters.push(r=>r[k]!=null && r[k]<v);return q},lte(k,v){filters.push(r=>r[k]<=v);return q},is(k,v){filters.push(r=>(r[k]??null)===v);return q},not(k,op,v){filters.push(r=>(r[k]??null)!==v);return q},update(v){patch=v;return q},
 async maybeSingle(){const result=await q;return {...result,data:result.data[0] || null}},then(resolve,reject){const found=(rows[table] || []).filter(r=>filters.every(f=>f(r))).slice(0,max);if(patch)found.forEach(r=>Object.assign(r,patch));return Promise.resolve({error:null,data:structuredClone(found)}).then(resolve,reject)}};return q}};
}
const policy={project_notifications:{enabled:true,transactional_authorized:true}};
test('QA/import emails are suppressed even when transactional notifications are enabled',()=>{
 assert.equal(projectNotificationSuppression({name:'QA TEST — Website',metadata:{}},policy,{},'project_created'),'test_or_historical_record');
 assert.equal(projectNotificationSuppression({metadata:{historical_import:true}},policy,{},'project_created'),'test_or_historical_record');
 assert.equal(projectNotificationSuppression({metadata:{}},{},{},'project_created'),'transactional_notifications_not_authorized');
 assert.equal(projectNotificationSuppression({metadata:{}},policy,{projects:{email_client:false}},'project_created'),'tenant_client_notifications_disabled');
});
test('activation wording requires recorded execution authorization',()=>{
 assert.equal(projectEventCopy({action:'project_status_changed',new_value:{status:'Active'}}),null);
 assert.match(projectEventCopy({action:'project_status_changed',new_value:{status:'Active',execution_authorized:true}}).title,/started/);
 assert.equal(projectEventCopy({action:'task_completed'}),null);
});
test('partial client signature does not authorize contract execution',async()=>{
 const db=database({contracts:[{id:'c',tenant_id:'t',status:'client_signed'}],contract_parties:[{tenant_id:'t',contract_id:'c',signature_required:true,signature_status:'signed'},{tenant_id:'t',contract_id:'c',signature_required:true,signature_status:'pending'}]});
 assert.equal(await contractIsFullyExecuted(db,'t','c'),false);
 assert.equal(await contractIsFullyExecuted(db,'foreign','c'),false);
});
function fixture(){return {project_notification_outbox:[{id:'o',tenant_id:'t',project_id:'p',event_id:'e',event_type:'project_created',status:'queued',attempts:0,next_attempt_at:'2020',created_at:'2020'}],projects:[{id:'p',tenant_id:'t',client_id:'c',name:'Website',status:'Pending',metadata:{}}],tenants:[{id:'t',settings:policy}],tenant_notification_policies:[],project_activity:[{id:'e',tenant_id:'t',action:'project_created'}],business_clients:[{id:'c',tenant_id:'t',name:'Test recipient',email:'controlled@example.test',is_active:true}]};}
const brand=async()=>({isPlatformFallback:false,brand:{tradingName:'Tenant Business'},replyToEmail:'support@example.test'});
test('provider acceptance stays accepted and a replay never sends twice',async()=>{
 const rows=fixture();let sends=0;const services={branding:brand,send:async()=>{sends++;return {success:true,deliveryStatus:'provider_accepted',emailId:'provider-id',canonicalMessageId:'m'}}};const db=database(rows);
 await processProjectNotificationOutbox(10,db,services);assert.equal(rows.project_notification_outbox[0].status,'provider_accepted');
 await processProjectNotificationOutbox(10,db,services);assert.equal(sends,1);
 rows.email_messages=[{id:'m',tenant_id:'t',delivered_at:'2026-10-14',delivery_status:'delivered'}];
 await processProjectNotificationOutbox(10,db,services);assert.equal(rows.project_notification_outbox[0].status,'delivered');assert.equal(sends,1);
});
test('ambiguous provider outcome goes to reconciliation and is never resent',async()=>{
 const rows=fixture();let sends=0;const services={branding:brand,send:async()=>{sends++;throw new Error('timeout')}};const db=database(rows);
 await processProjectNotificationOutbox(10,db,services);await processProjectNotificationOutbox(10,db,services);
 assert.equal(rows.project_notification_outbox[0].status,'needs_reconciliation');assert.equal(sends,1);
});
test('disabled policy prevents contacting the provider',async()=>{
 const rows=fixture();rows.tenants[0].settings={};let sends=0;
 await processProjectNotificationOutbox(10,database(rows),{branding:brand,send:async()=>{sends++;return {success:true}}});
 assert.equal(rows.project_notification_outbox[0].status,'suppressed');assert.equal(sends,0);
});
