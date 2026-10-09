import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const token='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const stubs={
'server-only':'',
'next/headers':"export const cookies=async()=>({get:()=>globalThis.__routeCookie?{value:globalThis.__routeCookie}:undefined});",
'next/server':"export class NextResponse extends Response{static json(body,init){return new NextResponse(JSON.stringify(body),{...init,headers:{'Content-Type':'application/json',...init?.headers}})}};export class NextRequest extends Request{}",
'@/lib/supabase-admin':"export const resolveSupabaseAdminClient=async()=>globalThis.__routeAdmin;export const createSupabaseAdminClient=()=>globalThis.__routeAdmin;",
'@/services/finance/clientFinancePortalService':"export const resolveClientByPortalToken=async()=>globalThis.__routeClient;",
'@/lib/redis/client':"export const getActiveRedisBackend=()=>null;export const getRedisAsync=async()=>null;",
'@/lib/projects/portalPassword':"export const hashPortalPassword=()=>{};export const verifyPortalPassword=()=>{};",
'@/lib/documents/themedDocumentPdf':"export const generateThemedContractPdfBuffer=()=>{throw Error('Unauthorized PDF generation')};export const generateThemedInvoicePdfBuffer=()=>{throw Error('Unauthorized PDF generation')};",
'@/lib/projects/projectClientNotification':"export const notifyProjectTeamClientPortalMessage=()=>{throw Error('Unauthorized notification')};",
'@/lib/email/sendEmailServer':"export const sendEmailServer=()=>{throw Error('Unauthorized email')};",
};
const plugin={name:'scoped-api-boundaries',setup(b){b.onResolve({filter:/.*/},a=>a.path in stubs?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'js'}));}};
const load=async file=>{const r=await build({entryPoints:[file],bundle:true,write:false,platform:'node',format:'esm',plugins:[plugin]});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));};
process.env.CLIENT_PORTAL_SESSION_SIGNING_SECRET='fixture-only-signing-key-at-least-32-characters';
const auth=await load('src/lib/auth/clientPortalAuth.ts');
const client={id:'client-a',tenant_id:'tenant-a',is_active:true,client_portal_session_salt:'salt'};
let accesses=[];let filters=[];
globalThis.__routeAdmin={from(table){accesses.push(table);let single=false;const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q},in:()=>q,is:()=>q,order:()=>q,limit:()=>q,maybeSingle:()=>{single=true;return q},then(resolve){return Promise.resolve({data:table==='business_clients'?client:table==='client_portal_sessions'?{is_active:true,signed_out_at:null,expires_at:'2099-01-01'}:single?null:[],error:null}).then(resolve)}};return q;}};
for(const section of ['contract','document','invoice','project','messages']){const route=await load(`src/app/api/client-finance/${section}/route.ts`);test(`${section} read rejects missing session and swapped portal before resource lookup`,async()=>{const req=new Request(`https://fixture.invalid/api/client-finance/${section}?token=${token}&${section}Id=${other}`);req.nextUrl=new URL(req.url);delete globalThis.__routeCookie;accesses=[];assert.equal((await route.GET(req)).status,401);assert.deepEqual(accesses,[]);globalThis.__routeCookie=auth.signClientPortalSession({clientId:client.id,tenantId:client.tenant_id,sessionSalt:'salt',sessionJti:'session'});globalThis.__routeClient={id:'client-b',tenant_id:'tenant-a'};accesses=[];assert.equal((await route.GET(req)).status,403);assert.deepEqual(accesses,['business_clients','client_portal_sessions']);});if(section!=='messages')test(`${section} rejects a resource absent from the authenticated client scope`,async()=>{globalThis.__routeClient=client;globalThis.__routeCookie=auth.signClientPortalSession({clientId:client.id,tenantId:client.tenant_id,sessionSalt:'salt',sessionJti:'session'});filters=[];const req=new Request(`https://fixture.invalid/api/client-finance/${section}?token=${token}&${section}Id=${other}`);req.nextUrl=new URL(req.url);assert.equal((await route.GET(req)).status,404);assert.ok(filters.some(([k,v])=>k==='tenant_id'&&v===client.tenant_id));assert.ok(filters.some(([k,v])=>(k==='client_id'||k==='entity_id')&&v===client.id));});if(section==='messages')test('message write rejects swapped portal without persistence or notification',async()=>{globalThis.__routeClient={id:'client-b',tenant_id:'tenant-a'};const req=new Request('https://fixture.invalid/api/client-finance/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,content:'Synthetic message'})});req.nextUrl=new URL(req.url);assert.equal((await route.POST(req)).status,403);});}
