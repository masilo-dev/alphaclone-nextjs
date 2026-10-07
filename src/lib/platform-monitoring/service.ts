import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {createSupabaseAdminClient} from '@/lib/supabase-admin';
import {PUBLIC_APP_ORIGIN} from '@/lib/config/public-origin';
import {ENV} from '@/config/env';
import {SERVICES,effectiveStatus,overallStatus,type Evidence} from './model';

const TIMEOUT=6000;
class Unverified extends Error {}
async function http(url:string, init:RequestInit={}) {
 return fetch(url,{...init,cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(TIMEOUT)});
}
async function okJson(url:string,init:RequestInit={}) {
 const r=await http(url,init); if(!r.ok) throw new Error('Provider request failed'); return r.json();
}
function required(value:string|undefined) {if(!value) throw new Unverified('Monitoring credential unavailable');return value;}
async function route(path:string,html=false) {
 const r=await http(`${PUBLIC_APP_ORIGIN}${path}`);
 if(!r.ok) throw new Error('Application route failed');
 if(html && !(await r.text()).includes('<html')) throw new Error('Invalid application response');
}
async function read(table:string) {
 const {error}=await createSupabaseAdminClient().from(table).select('id').limit(1).abortSignal(AbortSignal.timeout(TIMEOUT));
 if(error) throw new Error('Module data read failed');
}
async function worker(name:string) {
 const {data,error}=await createSupabaseAdminClient().from('automation_cron_logs').select('status,ran_at')
 .eq('trigger_type',name).order('ran_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(TIMEOUT));
 if(error) throw new Error('Worker evidence unavailable');
 if(!data?.length) throw new Unverified('No worker heartbeat recorded');
 if(data[0].status!=='success'||Date.now()-Date.parse(data[0].ran_at)>10*60_000) throw new Error('Worker heartbeat failed or expired');
}
async function auth() {
 // Dedicated non-customer synthetic account. No session tokens are persisted in health evidence.
 const client=createClient(required(ENV.VITE_SUPABASE_URL),required(ENV.VITE_SUPABASE_ANON_KEY),{
 auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>http(String(url),init)}});
 const {data,error}=await client.auth.signInWithPassword({email:required(process.env.MONITOR_AUTH_EMAIL),password:required(process.env.MONITOR_AUTH_PASSWORD)});
 if(error||!data.session) throw new Error('Synthetic sign-in failed');
 try {
 const refreshed=await client.auth.refreshSession({refresh_token:data.session.refresh_token});
 if(refreshed.error||!refreshed.data.session) throw new Error('Session refresh failed');
 await route('/auth/login',true);
 // A complete OAuth flow must be externally exercised. Fresh receipt required, never infer from route reachability.
 const {data:receipt,error:receiptError}=await createSupabaseAdminClient().from('platform_health_current').select('*')
 .eq('service_name','oauth_synthetic').abortSignal(AbortSignal.timeout(TIMEOUT)).maybeSingle();
 if(receiptError||effectiveStatus(receipt as Evidence)!=='operational') throw new Unverified('OAuth callback synthetic evidence unavailable');
 } finally {await client.auth.signOut({scope:'local'});}
}
async function mcp() {
 const token=required(process.env.MONITOR_MCP_TOKEN);
 const body={jsonrpc:'2.0',id:'status-monitor',method:'tools/list',params:{}};
 const headers={'Content-Type':'application/json',Accept:'application/json, text/event-stream'};
 const denied=await http(`${PUBLIC_APP_ORIGIN}/api/mcp`,{method:'POST',headers,body:JSON.stringify(body)});
 if(![401,403].includes(denied.status)) throw new Error('MCP unauthenticated request was not denied');
 const r=await http(`${PUBLIC_APP_ORIGIN}/api/mcp`,{method:'POST',headers:{...headers,Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
 if(!r.ok) throw new Error('Authenticated MCP request failed');
 const text=await r.text();
 const payload=r.headers.get('content-type')?.includes('text/event-stream')
 ? text.split('\n').filter(line=>line.startsWith('data:')).map(line=>JSON.parse(line.slice(5))).find(p=>p.id==='status-monitor'):JSON.parse(text);
 if(!Array.isArray(payload?.result?.tools)||!payload.result.tools.length) throw new Error('MCP tool registry unavailable');
}
async function stripe() {
 await okJson('https://api.stripe.com/v1/account',{headers:{Authorization:`Bearer ${required(process.env.STRIPE_SECRET_KEY)}`}});
 // Invalid signature must be rejected; receipt proves real signed event processing separately.
 const r=await http(`${PUBLIC_APP_ORIGIN}/api/stripe/webhook`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 const body=await r.json(); if(r.status!==400||body.code!=='STRIPE_WEBHOOK_SIGNATURE') throw new Error('Webhook verification boundary failed');
 const {data,error}=await createSupabaseAdminClient().from('stripe_webhook_events').select('status,processed_at')
 .order('created_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(TIMEOUT));
 if(error) throw new Error('Webhook storage unavailable');
 if(!data?.length||!data[0].processed_at||Date.now()-Date.parse(data[0].processed_at)>86400000) throw new Unverified('No recent signed webhook receipt');
 if(data[0].status!=='processed') throw new Error('Webhook processing failed');
}
async function provider(name:string) {
 if(name==='brevo') {
 const p=await okJson('https://api.brevo.com/v3/senders',{headers:{'api-key':required(process.env.BREVO_PLATFORM_API_KEY||process.env.BREVO_API_KEY)}});
 if(!p.senders?.some((s:{active:boolean})=>s.active)) throw new Error('No active sender'); return;
 }
 const specs:Record<string,[string,string,string]>={
 zoho:[`https://mail.zoho.${process.env.MONITOR_ZOHO_REGION==='eu'?'eu':'com'}/api/accounts`,'MONITOR_ZOHO_TOKEN','Zoho-oauthtoken'],
 outlook:['https://graph.microsoft.com/v1.0/me','MONITOR_OUTLOOK_TOKEN','Bearer'],
 linkedin:['https://api.linkedin.com/v2/userinfo','MONITOR_LINKEDIN_TOKEN','Bearer'],
 facebook:['https://graph.facebook.com/v23.0/me?fields=id','MONITOR_FACEBOOK_TOKEN','Bearer'],
 instagram:['https://graph.instagram.com/v23.0/me?fields=id','MONITOR_INSTAGRAM_TOKEN','Bearer']};
 const [url,key,prefix]=specs[name]; const p=await okJson(url,{headers:{Authorization:`${prefix} ${required(process.env[key])}`}});
 if(p.error||name==='zoho'&&p.status?.code!==200) throw new Error('Connector authentication failed');
}
export async function runMonitoring() {
 const admin=createSupabaseAdminClient(); const checked_at=new Date(Math.floor(Date.now()/60000)*60000).toISOString();
 const claim=await admin.rpc('platform_monitor_claim',{p_minute:checked_at}).abortSignal(AbortSignal.timeout(TIMEOUT));
 if(claim.error) throw new Error('Monitoring storage unavailable'); if(!claim.data) return {skipped:true};
 const checks:Evidence[]=await Promise.all(SERVICES.filter(s=>s[0]!=='billing').map(async([name])=>{
 const start=Date.now(); let status:Evidence['status']='operational'; let verified=true; let message='Latest probe passed'; let scope='provider API authentication';
 try {
 switch(name) {
 case 'website': scope='Homepage HTTP and HTML'; await route('/',true); break;
 case 'dashboard': scope='Dashboard route availability'; {const r=await http(`${PUBLIC_APP_ORIGIN}/dashboard`);if(!r.ok&&![302,303,307,308].includes(r.status)) throw new Error('Dashboard route unavailable'); if(r.status!==200) throw new Unverified('Authenticated dashboard synthetic check unavailable');} break;
 case 'api':scope='API liveness';{const p=await okJson(`${PUBLIC_APP_ORIGIN}/api/health`);if(!['healthy','operational'].includes(p.status)) throw new Error('API liveness failed');}break;
 case 'database':scope='Monitoring schema read/write round trip';{const p=await admin.rpc('platform_monitor_database_probe').abortSignal(AbortSignal.timeout(TIMEOUT));if(p.error||p.data!==true) throw new Error('Database probe failed');}break;
 case 'authentication':scope='Synthetic login, refresh and OAuth receipt'; await auth();break;
 case 'mcp':scope='Authenticated tools/list and auth rejection';await mcp();break;
 case 'agent_runtime':scope='Durable worker heartbeat';await read('agent_tasks');await worker('bonnie-runtime-worker');break;
 case 'automation':scope='Scheduler heartbeat';await worker('process-events');break;
 case 'notifications':scope='Notification queue and heartbeat';await read('notification_queue');await worker('notification-digests');break;
 case 'crm':case 'projects':case 'contracts': scope='Module data read (workflow not exercised)';await read(name==='crm'?'clients':name);throw new Unverified('Module data available; workflow synthetic check unavailable');
 case 'client_portal':scope='Portal login route';await route('/portal-login',true);throw new Unverified('Client workspace synthetic check unavailable');
 case 'stripe':scope='Stripe API, signature rejection and recent webhook receipt';await stripe();break;
 default:await provider(name);
 }
 }catch(e) {verified=!(e instanceof Unverified);status=verified?(name==='database'||name==='mcp'?'major_outage':'degraded'):'degraded';message=verified?'Latest probe failed':e instanceof Error?e.message:'Monitoring evidence unavailable';}
 const latency_ms=Date.now()-start;
 if(status==='operational'&&latency_ms>2500){status='degraded';message='Probe passed with elevated latency';}
 return {service_name:name,status,latency_ms,message,checked_at,metadata_json:{verified,scope}};
 }));
 const stripeCheck=checks.find(c=>c.service_name==='stripe')!;
 let billing:Evidence={...stripeCheck,service_name:'billing',metadata_json:{...stripeCheck.metadata_json,scope:'Invoice data and Stripe dependency'}};
 try{await read('invoices');if(billing.status==='operational'){billing={...billing,status:'degraded',message:'Payment workflow synthetic check unavailable',metadata_json:{...billing.metadata_json,verified:false}};}}
 catch{billing={...billing,status:'degraded',message:'Billing data probe failed',metadata_json:{...billing.metadata_json,verified:true}};}
 checks.push(billing);
 const saved=await admin.rpc('platform_monitor_save',{p_checks:checks}).abortSignal(AbortSignal.timeout(TIMEOUT));
 if(saved.error) throw new Error('Monitoring results could not be persisted');return {checks:checks.length,checked_at};
}
export async function getStatusSnapshot() {
 const admin=createSupabaseAdminClient();
 const [current,daily,incidents]=await Promise.all([
 admin.from('platform_health_current').select('*').limit(50).abortSignal(AbortSignal.timeout(TIMEOUT)),
 admin.from('platform_health_daily').select('*').gte('day',new Date(Date.now()-90*86400000).toISOString().slice(0,10)).limit(2500).abortSignal(AbortSignal.timeout(TIMEOUT)),
 admin.from('platform_status_incidents').select('id,service_name,status,started_at,resolved_at,message').order('started_at',{ascending:false}).limit(100).abortSignal(AbortSignal.timeout(TIMEOUT))]);
 if(current.error||daily.error||incidents.error) throw new Error('Status evidence unavailable');
 const now=Date.now();
 const services=SERVICES.map(([id,name,group])=>{
 let row=current.data?.find(r=>r.service_name===id) as Evidence|undefined;
 const edge=['website','api'].includes(id)?current.data?.find(r=>r.service_name===`edge_${id}`) as Evidence|undefined:undefined;
 const status=['website','api'].includes(id)?overallStatus([effectiveStatus(row,now),effectiveStatus(edge,now)]):effectiveStatus(row,now);
 if(edge && effectiveStatus(edge,now)!=='operational') row=edge;
 const history=daily.data?.filter(r=>r.service_name===id)||[];
 const samples=history.reduce((sum,r)=>sum+r.samples,0); const verified=history.reduce((sum,r)=>sum+r.verified_samples,0);
 const operational=history.reduce((sum,r)=>sum+r.operational_samples,0);
 return {id,name,group,status,checked_at:edge&&['website','api'].includes(id)?(Date.parse(edge.checked_at)<Date.parse(row?.checked_at||'')?edge.checked_at:row?.checked_at||null):row?.checked_at||null,latency_ms:row?.latency_ms??null,
 message:row&&now-Date.parse(row.checked_at)>180000?'Monitoring evidence expired':row?.message||'No monitoring evidence yet',scope:row?.metadata_json.scope||'Not configured',
 uptime:verified?Number((operational/verified*100).toFixed(2)):null,samples,verified_samples:verified};
 });
 // Only fixed service identifiers and generic probe messages reach the public endpoint.
 return {overall:overallStatus(services.map(s=>s.status)),services,incidents:incidents.data?.map(i=>({...i,service_name:i.service_name.replace(/^edge_/, '')})).filter(i=>SERVICES.some(s=>s[0]===i.service_name))||[],generated_at:new Date(now).toISOString()};
}
