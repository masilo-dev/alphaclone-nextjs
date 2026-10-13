import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,mocks,globals={}) {
 const module={exports:{}};
 const code=ts.transpileModule(readFileSync(new URL('../../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{console,Date,URL,Response,crypto:{randomUUID:()=> 'test-room'},...globals})(name=>{if(!(name in mocks))throw new Error('Unexpected dependency '+name);return mocks[name]},module,module.exports);
 return module.exports;
}
function database() {
 let id=0;
 const tables={tenants:[{id:'t',name:'Test Business',slug:'test-business',subscription_plan:'free',settings:{booking:{enabled:true},calendly:{accessToken:'private-test-token'},billing:{private:'private-test-value'}}}],booking_types:[],booking_automation_rules:[],booking_automation_jobs:[],profiles:[{id:'owner',email:'owner@example.invalid'}],tenant_users:[{tenant_id:'t',user_id:'owner',role:'owner'}],bookings:[],calendar_events:[],tasks:[],leads:[],video_calls:[]};
 return {tables,from(table){
  const filters=[];let action='read',payload,options={};
  const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},not(k,op,v){filters.push(r=>!v.slice(1,-1).split(',').includes(r[k]));return q},lte(k,v){filters.push(r=>r[k]<=v);return q},order(){return q},limit(){return q},or(){return q},insert(p){action='insert';payload=p;return q},upsert(p,o){action='upsert';payload=p;options=o;return q},update(p){action='update';payload=p;return q},single(){return run(true)},maybeSingle(){return run(true)},then(ok,bad){return run(false).then(ok,bad)}};
  async function run(single){let rows=tables[table].filter(r=>filters.every(f=>f(r)));if(action==='insert'||action==='upsert'){rows=[];for(const value of Array.isArray(payload)?payload:[payload]){const old=options.onConflict&&tables[table].find(r=>r[options.onConflict]===value[options.onConflict]);if(old){rows.push(old);if(!options.ignoreDuplicates)Object.assign(old,value);continue}const row={id:String(++id),is_active:true,...value};tables[table].push(row);rows.push(row)}}else if(action==='update')rows.forEach(r=>Object.assign(r,payload));return {data:single?(rows[0]||null):rows,error:null}}
  return q;
 }};
}
const publicOrigin={publicAppUrl:path=>'https://example.invalid'+path};
function setup() {
 const db=database();const sent=[];
 const bootstrap=load('src/lib/tenant/bootstrapTenantServer.ts',{'server-only':{},'@/lib/config/public-origin':publicOrigin});
 const automation=load('src/lib/booking/bookingAutomation.ts',{'server-only':{},'@/lib/email/sendEmailServer':{sendEmailServer:async request=>{sent.push(request);return {success:true,emailId:'test-message-'+sent.length}}}});
 const confirmation=load('src/lib/booking/confirmNativeBooking.ts',{'server-only':{},'@/lib/tenant/bootstrapTenantServer':bootstrap,'./bookingAutomation':automation});
 return {db,sent,bootstrap,automation,confirmation};
}
test('every business receives its own active booking link and both confirmation rules',async()=>{
 const {db,bootstrap}=setup();await bootstrap.ensureNativeBookingDefaults(db,'t','test-business');await bootstrap.ensureNativeBookingDefaults(db,'t','test-business');
 assert.equal(db.tables.tenants[0].booking_slug,'test-business');
 assert.equal(db.tables.tenants[0].settings.booking.publicUrl,'https://example.invalid/book/test-business');
 assert.equal(db.tables.booking_types.length,1);
 assert.equal(db.tables.booking_automation_rules.filter(r=>r.timing==='after_event'&&r.offset_minutes===0).length,2);
});
test('host and customer confirmations are scoped, transactional and retry-safe',async()=>{
 const {db,sent,confirmation}=setup();
 db.tables.booking_automation_jobs.push({id:'foreign',tenant_id:'other',booking_id:'other',status:'pending',scheduled_for:'2000-01-01T00:00:00Z',recipient_email:'foreign@example.invalid'});
 const input={tenantId:'t',bookingId:'b',bookingTypeName:'Discovery',clientName:'Guest',clientEmail:'guest@example.invalid',hostUserId:'owner',startTime:new Date(Date.now()+2*86400000).toISOString(),endTime:new Date(Date.now()+2*86400000+1800000).toISOString(),source:'native'};
 await confirmation.confirmNativeBooking(db,'test-business',input);await confirmation.confirmNativeBooking(db,'test-business',input);
 assert.deepEqual(sent.map(r=>r.to).sort(),['guest@example.invalid','owner@example.invalid']);
 assert.ok(sent.every(r=>r.tenantId==='t'&&r.category==='booking_calendar'&&r.idempotencyKey));
 assert.equal(db.tables.booking_automation_jobs.find(r=>r.id==='foreign').status,'pending');
});
test('public pages work without a user session and never return private workspace settings',async()=>{
 const {db,bootstrap}=setup();await bootstrap.ensureNativeBookingDefaults(db,'t','test-business');
 const actions=load('src/actions/booking.ts',{'@/lib/supabase-admin':{createSupabaseAdminClient:()=>db}});
 const result=await actions.fetchTenantBookingPage('test-business');
 assert.equal(result.services.length,1);assert.equal(result.tenant.name,'Test Business');
 assert.equal(JSON.stringify(result).includes('private-test'),false);
 db.tables.tenants[0].settings.booking.enabled=false;
 await assert.rejects(actions.fetchTenantBookingPage('test-business'),/not available/);
});
test('native booking creates tenant-owned calendar records and reuses a booking on retry',async()=>{
 const {db,bootstrap,confirmation,sent}=setup();await bootstrap.ensureNativeBookingDefaults(db,'t','test-business');
 const route=load('src/app/api/booking/create/route.ts',{'next/server':{NextResponse:{json:Response.json}},'@/lib/api/clientErrorResponse':{clientErrorResponse:()=>Response.json({error:'failed'},{status:500})},'@/lib/supabase-admin':{createSupabaseAdminClient:()=>db},'@/lib/booking/confirmNativeBooking':confirmation,'@/lib/config/public-origin':publicOrigin,'@/lib/cron/distributedLock':{acquireCronLock:async()=>({acquired:true,release:async()=>{}})},'@/services/server/microsoftServerService':{microsoftServerService:{getConnection:async()=>null}},'@/lib/rateLimit':{rateLimitMiddleware:async()=>null,rateLimitConfigs:{public:{contact:{}}}},'@/lib/verifyTurnstile':{isTurnstileEnforced:()=>false},'@/services/tenancy/types':{PLAN_PRICING:{free:{features:{}}}}});
 const body={tenant_id:'t',booking_type_id:db.tables.booking_types[0].id,client_name:'Guest',client_email:'guest@example.invalid',start_time:new Date(Date.now()+2*86400000).toISOString(),end_time:new Date(Date.now()+2*86400000+1800000).toISOString()};
 const request=()=>({json:async()=>body,headers:new Headers()});
 const first=await route.POST(request());assert.equal(first.status,200);const booking=(await first.json()).booking;
 const retry=await route.POST(request());assert.equal(retry.status,200);
 assert.equal(db.tables.bookings.length,1);assert.equal(db.tables.calendar_events.length,1);
 assert.equal(db.tables.video_calls[0].tenant_id,'t');
 assert.equal(db.tables.calendar_events[0].video_room_id,booking.video_call_id);
 assert.equal(db.tables.calendar_events[0].id,booking.calendar_event_id);
 assert.equal(sent.length,2);
});
test('registration bootstrap provisions a booking page without any provider OAuth',async()=>{
 const {db,bootstrap}=setup();
 db.rpc=async(name,args)=>{
  assert.equal(name,'create_tenant_idempotent');
  db.tables.tenants.push({id:'new-t',name:args.p_name,slug:args.p_slug,settings:{},subscription_plan:'free'});
  db.tables.tenant_users.push({tenant_id:'new-t',user_id:args.p_admin_user_id,role:'owner'});
  return {data:'new-t',error:null};
 };
 const result=await bootstrap.bootstrapTenantForUser(db,{id:'new-owner',email:'new-owner@example.invalid',user_metadata:{}},{mode:'create',name:'New Business',slug:'new-business',idempotencyKey:'registration-test'});
 assert.equal(result.tenantId,'new-t');
 const tenant=db.tables.tenants.find(t=>t.id==='new-t');
 assert.equal(tenant.settings.booking.enabled,true);
 assert.equal(tenant.settings.booking.publicUrl,'https://example.invalid/book/new-business');
 assert.equal(db.tables.booking_types.filter(t=>t.tenant_id==='new-t').length,1);
 assert.equal(db.tables.booking_automation_rules.filter(r=>r.tenant_id==='new-t'&&r.recipient==='host').length,1);
});
test('an already-claimed confirmation job is not sent by a second worker',async()=>{
 const {db,sent,automation}=setup();
 db.tables.booking_automation_jobs.push({id:'j',tenant_id:'t',booking_id:'b',status:'pending',scheduled_for:'2000-01-01T00:00:00Z',recipient_email:'guest@example.invalid',subject:'Confirmed',body_html:'Confirmation',attempts:0});
 await Promise.all([automation.processDueBookingAutomationJobs(db),automation.processDueBookingAutomationJobs(db)]);
 assert.equal(sent.length,1);
});
