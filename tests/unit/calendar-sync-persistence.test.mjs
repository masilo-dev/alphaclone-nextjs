import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, mocks) {
 const module={exports:{}};
 const code=ts.transpileModule(readFileSync(new URL('../../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{console,Date,URL,URLSearchParams,AbortSignal,fetch,Response})(name=>{if(!(name in mocks))throw new Error('Unexpected dependency '+name);return mocks[name]},module,module.exports);
 return module.exports;
}
function database() {
 const tables={tenant_users:[{tenant_id:'t',user_id:'host',role:'owner'}],leads:[],bookings:[],calendar_events:[],tasks:[],booking_automation_jobs:[],video_calls:[]};
 let id=0;
 return {tables,from(table){
  const filters=[];let action='read',payload;
  const field=(row,key)=>key.startsWith('metadata->>')?row.metadata?.[key.slice(11)]:row[key];
  const q={select(){return q},eq(k,v){filters.push(r=>field(r,k)===v);return q},filter(k,op,v){return q.eq(k,v)},limit(){return q},insert(p){action='insert';payload=p;return q},update(p){action='update';payload=p;return q},maybeSingle(){return run(true)},single(){return run(true)},then(ok,bad){return run(false).then(ok,bad)}};
  async function run(single){let rows=tables[table].filter(r=>filters.every(f=>f(r)));if(action==='insert'){const row={id:String(++id),...payload};tables[table].push(row);rows=[row]}else if(action==='update')rows.forEach(r=>Object.assign(r,payload));return {data:single?(rows[0]||null):rows,error:null}}
  return q;
 }};
}
const locks={acquireCronLock:async()=>({acquired:true,release:async()=>{}})};
test('White-label booking retry/reschedule/cancel updates one event and never sends import emails',async()=>{
 const db=database();let queued=0;
 const {upsertNativeBookingFromProvider}=load('src/lib/booking/nativeBookingSync.ts',{'server-only':{},'@/lib/cron/distributedLock':locks,'@/lib/email/sendEmailServer':{sendEmailServer:()=>{throw new Error('Unexpected email')}},'@/lib/booking/bookingAutomation':{enqueueBookingAutomationJobs:async()=>{queued++}}});
 const input={tenantId:'t',hostUserId:'host',source:'cal_diy',providerBookingId:'provider-1',clientName:'Test',clientEmail:'test@example.invalid',startTime:'2026-10-13T10:00:00Z',endTime:'2026-10-13T11:00:00Z',notify:false};
 await upsertNativeBookingFromProvider(db,input);
 await upsertNativeBookingFromProvider(db,{...input,startTime:'2026-10-14T10:00:00Z'});
 assert.equal(db.tables.bookings.length,1);
 assert.equal(db.tables.calendar_events.length,1);
 assert.equal(db.tables.tasks.length,0);
 assert.equal(db.tables.calendar_events[0].start_time,'2026-10-14T10:00:00Z');
 await upsertNativeBookingFromProvider(db,{...input,status:'cancelled'});
 assert.equal(db.tables.calendar_events[0].metadata.provider_status,'cancelled');
 assert.equal(queued,0);
});
test('Calendly cancellation retains provider identity for repeated webhooks',async()=>{
 const db=database();db.tables.bookings.push({id:'b',tenant_id:'t',metadata:{calendly_event_uri:'https://api.calendly.com/scheduled_events/e'}});
 db.tables.calendar_events.push({id:'e',tenant_id:'t',metadata:{calendly_event_uri:'https://api.calendly.com/scheduled_events/e',booking_id:'b'}});
 const {upsertCalendlyEvent}=load('src/lib/calendly/syncToNative.ts',{'@/lib/supabase-admin':{createSupabaseAdminClient:()=>db},'@/lib/cron/distributedLock':locks,'./scheduledEventFeed':{},'@/services/calendly/calendlyIntegrationService':{},'@/config/env':{ENV:{}},'@/lib/email/sendEmailServer':{sendEmailServer:()=>{throw new Error('Unexpected email')}}});
 const input={tenantId:'t',hostUserId:'host',eventUri:'https://api.calendly.com/scheduled_events/e',eventName:'Test',startTime:'2026-10-13T10:00:00Z',endTime:'2026-10-13T11:00:00Z',status:'canceled'};
 await upsertCalendlyEvent(input);await upsertCalendlyEvent(input);
 assert.equal(db.tables.calendar_events.length,1);
 assert.equal(db.tables.calendar_events[0].metadata.calendly_event_uri,input.eventUri);
 assert.equal(db.tables.calendar_events[0].metadata.booking_id,'b');
 assert.equal(db.tables.calendar_events[0].metadata.calendly_status,'canceled');
});
test('Google Calendar preserves the viewed range while loading subsequent pages',async()=>{
 const calls=[];
 const module={exports:{}};
 const source=readFileSync(new URL('../../src/app/api/tenant/[tenantId]/google-calendar/events/route.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
 const mocks={'next/server':{NextResponse:{json:Response.json}},'zod':require('zod'),'@/lib/apiAuth':{requireTenantAccess:async()=>({user:{id:'u'},admin:{}}),routeErrorResponse:()=>Response.json({error:'failed'},{status:500})},'@/lib/supabase-admin':{},'@/services/google/googleAccessTokenService':{getValidGoogleAccessToken:async()=> 'fake'}};
 vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{Date,URL,URLSearchParams,AbortSignal,fetch:async(url)=>{calls.push(url);return Response.json({items:[{id:String(calls.length)}],...(calls.length===1?{nextPageToken:'next'}:{})})}})(name=>mocks[name],module,module.exports);
 const response=await module.exports.GET({url:'https://example.invalid/api?timeMin=2026-09-01T00:00:00Z&timeMax=2026-10-01T00:00:00Z'},{params:Promise.resolve({tenantId:'t'})});
 assert.equal((await response.json()).events.length,2);
 assert.equal(new URL(calls[1]).searchParams.get('timeMin'),'2026-09-01T00:00:00Z');
 assert.equal(new URL(calls[1]).searchParams.get('pageToken'),'next');
});
test('MCP Calendly sync uses the server importer, not a relative browser API URL',async()=>{
 const calls=[];
 const {calendlyService}=load('src/services/calendlyService.ts',{'../lib/supabase':{},'./tenancy/TenantService':{},'./calendarService':{},'@/services/calendly/calendlyIntegrationService':{getCalendlyConfig:async()=>({accessToken:'fake',calendlyUserUri:'user'})},'@/lib/supabase-admin':{createSupabaseAdminClient:()=>({})},'@/lib/calendly/syncToNative':{pullAndSyncCalendlyEvents:async(...args)=>{calls.push(args);return {syncedCount:2}}}});
 assert.equal(await calendlyService.syncUpcomingEvents('host','t'),2);
 assert.equal(calls[0][0],'t');
 assert.equal(calls[0][1],'host');
});
