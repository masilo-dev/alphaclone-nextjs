/* Rendered QA against the real application with synthetic, isolated provider data.
 * No production credentials and no external/business mutations.
 * Run: PHASE2_BROWSER_PATH=/path/to/chrome node qa/playwright/22-phase2-product-system.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { createHmac } = require('node:crypto');
const { chromium } = require('playwright');
const uid = '11111111-1111-4111-8111-111111111111';
const tid = '22222222-2222-4222-8222-222222222222';
const cid = '33333333-3333-4333-8333-333333333333';
const pid = '44444444-4444-4444-8444-444444444444';
const base = 'http://127.0.0.1:3000';
const secret = 'phase2-isolated-local-client-portal-secret';
const now = Math.floor(Date.now()/1000);
const encode = object => Buffer.from(JSON.stringify(object)).toString('base64url');
const user = { id: uid, email: 'qa@example.test', aud: 'authenticated', role: 'authenticated',
  created_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString(), confirmed_at: new Date().toISOString(), user_metadata: { name: 'QA Owner', avatar: '/icon-192.png' }, app_metadata: { provider: 'email' } };
const tenant = { id:tid, name:'QA Business', slug:'qa-business', role:'owner', subscription_plan:'pro', subscription_status:'active', settings:{}, created_at:'2026-01-01T00:00:00Z', updated_at:new Date().toISOString() };
const client = { id:cid, tenant_id:tid, name:'QA Client', email:'client@example.test', sales_stage:'customer', is_active:true, created_at:new Date().toISOString(), finance_portal_token:'fixture-client', client_portal_session_salt:'fixture-salt' };
const project = { id:pid, tenant_id:tid, client_id:cid, name:'QA Delivery', title:'QA Delivery', status:'active', current_stage:'planning', progress:20, description:'Synthetic client project', created_at:new Date().toISOString(), client:client };
let variant='existing';
const profile=()=>({ id:uid,email:user.email,name:user.user_metadata.name,avatar:user.user_metadata.avatar,role:'tenant_admin',tenant_id:tid,company_name:'QA Business',account_status:'active',email_verified:true,onboarding_status:'completed',onboarding_completed:variant==='completed',walkthrough_completed:variant==='completed',created_at:variant==='new'?new Date().toISOString():'2025-01-01T00:00:00Z' });
function rows(url){
 const table=url.pathname.split('/').at(-1);
 const requestedTenant=url.searchParams.get('tenant_id');
 if(requestedTenant && !requestedTenant.includes(tid))return [];
 if(table==='profiles')return [profile()];
 if(table==='get_user_tenants')return [tenant];
 if(table==='tenants')return [tenant];
 if(table==='tenant_users')return [{tenant_id:tid,user_id:uid,role:'owner',tenant}];
 if(table==='business_clients')return variant==='new'?[]:[client];
 if(table==='projects')return variant==='new'?[]:[project];
 if(table==='client_portal_sessions')return [{session_jti:'fixture-session',client_id:cid,tenant_id:tid,expires_at:new Date(Date.now()+3600000).toISOString(),revoked_at:null}];
 return [];
}
function payload(url){
 if(url.pathname.includes('/platform/policy'))return {policy:{openRegistration:true}};
 if(url.pathname.includes('/dashboard/stats'))return {stats:{clientCount:variant==='new'?0:1,activeProjects:variant==='new'?0:1,totalLeads:0,totalRevenue:0,pendingInvoices:0,overdueInvoices:0,totalTasks:0,totalMessages:0,recentActivity:[],monthlyRevenue:[],pipeline:{}}};
 if(url.pathname.endsWith('/onboarding/progress'))return {progress:{profile:true,client:variant!=='new',project:variant!=='new',email:false,social:false,execution:false}};
 if(url.pathname.includes('/client-finance/portal'))return {success:true,data:{client,tenant:{id:tid,name:tenant.name},businessName:tenant.name,projects:[project],invoices:[],quotes:[],contracts:[],documents:[],approvals:[],summary:{outstandingBalance:0,totalPaid:0,overdueCount:0,pendingQuotes:0,activeProjects:1,pendingContracts:0}}};
 if(url.pathname.endsWith('/clients'))return {clients:[client],pageInfo:{hasMore:false,total:1,nextCursor:null}};
 if(url.pathname.endsWith('/projects'))return {projects:[project],pageInfo:{hasMore:false,total:1,nextCursor:null}};
 if(url.pathname.includes('/integrations'))return {integrations:[],personalConnections:{},providerConnections:{}};
 return {success:true,data:[],events:[],activity:[],messages:[],notifications:[],accounts:[],identities:[],pages:[],clients:[],projects:[],invoices:[],quotes:[],contracts:[],documents:[],campaigns:[],leads:[],tasks:[],members:[],templates:[],permissions:[],sessions:[],total:0,unreadCount:0,pageInfo:{hasMore:false,total:0,nextCursor:null}};
}
const mock=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:54321');
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Expose-Headers','Content-Range');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,HEAD,OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 res.setHeader('Content-Type','application/json');
 let data;
 if(url.pathname.includes('/auth/v1/user')) data=user;
 else if(url.pathname.startsWith('/auth/'))data={user};
 else {data=rows(url);if(req.method==='HEAD'){res.setHeader('Content-Range',`0-0/${data.length}`);res.end();return;}
   if((req.headers.accept||'').includes('object+json'))data=data[0]||null;
 }
 res.end(JSON.stringify(data));
});
const group=process.env.PHASE2_QA_GROUP||'all';
const output=path.join(process.cwd(),'qa','results','phase2',group.replace(/[^a-z0-9-]/gi,'-'));fs.mkdirSync(output,{recursive:true});
const results={fixture:'synthetic local tenant; real app rendering; no provider writes',checks:[],startedAt:new Date().toISOString()};
let server,browser;
process.on('SIGINT',()=>{if(server){try{process.kill(-server.pid,'SIGKILL');}catch{}}process.exit(130);});
function save(){fs.writeFileSync(path.join(output,'rendered-results.json'),JSON.stringify(results,null,2));}
async function check(name,fn){try{const detail=await fn();results.checks.push({name,pass:true,...detail});console.log('PASS',name);}catch(error){results.checks.push({name,pass:false,error:error.message});console.log('FAIL',name,error.message.slice(0,220));}save();}
async function context(auth=true){
 const context=await browser.newContext({viewport:{width:1280,height:800},bypassCSP:true});
 await context.route('**/api/**',async route=>{
  const req=route.request();const url=new URL(req.url());
  if(url.pathname==='/api/account/profile'&&req.method()==='PATCH')variant='completed';
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload(url))});
 });
 if(auth){
  const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:uid,aud:'authenticated',role:'authenticated',aal:'aal1',iat:now,exp:now+3600})+'.fixture';
  const session={access_token:token,refresh_token:'fixture-refresh-token',token_type:'bearer',expires_in:3600,expires_at:now+3600,user};
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+encode(session),url:base}]);
  await context.addInitScript(({tid})=>{localStorage.setItem('current_tenant_id',tid);}, {tid});
 }
 return context;
}
async function metrics(page){return page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,dialogs:document.querySelectorAll('[role="dialog"]').length,heading:(document.querySelector('h1')?.textContent||'').trim()}));}
(async()=>{
 try{
  await new Promise(resolve=>mock.listen(54321,'127.0.0.1',resolve));
  const log=fs.openSync(path.join(output,'server.log'),'w');
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',process.env.PHASE2_QA_WEBPACK?'--webpack':'--turbopack','--hostname','127.0.0.1','--port','3000'],{cwd:process.cwd(),stdio:['ignore',log,log],detached:true,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'phase2-local-fixture-key',SUPABASE_SERVICE_ROLE_KEY:'phase2-local-fixture-service-key',CLIENT_PORTAL_SESSION_SIGNING_SECRET:secret,NODE_OPTIONS:'--max-old-space-size=4096',NEXT_TELEMETRY_DISABLED:'1'}});
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){try{const response=await fetch(base+'/auth/login',{signal:AbortSignal.timeout(20000)});if(response.ok)break;}catch{} await new Promise(r=>setTimeout(r,500));}
  browser=await chromium.launch({executablePath:process.env.PHASE2_BROWSER_PATH,headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  if(group==='all'||group==='auth'){
  const anonymous=await context(false);const authPage=await anonymous.newPage();
  await authPage.goto(base+'/auth/login',{waitUntil:'domcontentloaded',timeout:120000});await authPage.locator('input[type="email"]').waitFor({timeout:120000});
  for(const width of [320,360,375,390,412,430,768,1280])for(const theme of ['light','dark'])await check(`auth ${width}px ${theme}`,async()=>{
   await authPage.setViewportSize({width,height:844});await authPage.evaluate(theme=>{document.documentElement.className=theme;},theme);
   const detail=await metrics(authPage);if(detail.scrollWidth>width+1)throw Error(`horizontal overflow ${detail.scrollWidth}`);
   const surface=await authPage.locator('.ac-auth-card').evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));
   if(surface.background!=='rgb(255, 255, 255)')throw Error('auth surface not opaque white');
   return {...detail,...surface};
  });
  await authPage.screenshot({path:path.join(output,'auth-desktop.png')});await anonymous.close();
  }
  for(const scenario of (group==='all'||group==='onboarding'?['existing','completed','new']:[]))await check(`onboarding ${scenario}`,async()=>{
   variant=scenario;const c=await context();const page=await c.newPage();
   await page.goto(base+'/dashboard',{waitUntil:'domcontentloaded',timeout:120000});await page.locator('.ac-business-root').waitFor({timeout:120000});
   if(scenario==='new'){
    await page.getByRole('dialog').waitFor({timeout:30000});if(await page.getByRole('dialog').count()!==1)throw Error('competing guidance surfaces');
    await page.getByRole('button',{name:'Explore the full workspace instead'}).click();await page.getByRole('dialog').waitFor({state:'hidden',timeout:30000});
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('.ac-business-root').waitFor({timeout:30000});
   }else await page.waitForTimeout(1500);
   if(await page.getByRole('dialog').count())throw Error('unexpected first-run dialog');
   if(!new URL(page.url()).pathname.startsWith('/dashboard'))throw Error('fixture authentication failed: '+page.url());
   const detail=await metrics(page);await c.close();return detail;
  });
  variant='completed';const c=await context();const page=await c.newPage();
  if(group==='tour')await check('intentional Product Tour replay',async()=>{
   await page.goto(base+'/dashboard',{waitUntil:'domcontentloaded',timeout:120000});
   await page.getByRole('button',{name:'Account menu',exact:true}).click();
   await page.getByRole('menuitem',{name:'Help · Product Tour',exact:true}).click();
   await page.locator('.react-joyride__tooltip').waitFor({timeout:30000});
   if(await page.getByRole('dialog').count())throw Error('first-run dialog competes with replay');
   await page.getByRole('button',{name:'Skip Tour',exact:true}).click();
   await page.locator('.react-joyride__tooltip').waitFor({state:'hidden',timeout:30000});
   return await metrics(page);
  });
  const routes=['/dashboard','/dashboard/crm/workspace','/dashboard/leads/campaigns','/dashboard/business/projects/manage','/dashboard/business/documents','/dashboard/business/mail','/dashboard/business/campaigns','/dashboard/business/social','/dashboard/accounting','/dashboard/business/billing/manage','/dashboard/business/quotes','/dashboard/business/contracts','/dashboard/calendar','/dashboard/business/bookings','/dashboard/business/analytics','/dashboard/settings','/dashboard/settings/integrations','/dashboard/notifications'];
  for(const route of (group==='all'||group.startsWith('module')?routes.filter(route=>!process.env.PHASE2_QA_ROUTES||process.env.PHASE2_QA_ROUTES.split(',').includes(route)):[]))await check(`module ${route}`,async()=>{
   await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:120000});await page.locator('.ac-business-root').waitFor({timeout:120000});
   await page.waitForTimeout(800);if(!new URL(page.url()).pathname.startsWith('/dashboard'))throw Error('fixture authentication failed: '+page.url());const text=await page.locator('body').innerText();if(/Build Error Occurred|Application error|Invalid hook call/.test(text))throw Error('runtime module error');
   const detail=await metrics(page);if(detail.scrollWidth>detail.width+1)throw Error(`horizontal overflow ${detail.scrollWidth}`);return detail;
  });
  for(const width of (group==='all'||group==='mobile'?[320,360,375,390,412,430,768,1280]:[]))await check(`workspace ${width}px`,async()=>{
   await page.setViewportSize({width,height:844});await page.goto(base+'/dashboard/crm/workspace',{waitUntil:'domcontentloaded'});await page.locator('.ac-business-root').waitFor({timeout:30000});await page.waitForTimeout(300);const detail=await metrics(page);if(detail.scrollWidth>width+1)throw Error(`horizontal overflow ${detail.scrollWidth}`);return detail;
  });
  if(group==='all'||group==='mobile')await page.screenshot({path:path.join(output,'workspace-mobile.png')});
  if(group==='all'||group==='portal')await check('client portal separated workspace',async()=>{
   const unsigned=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:cid,tid,jti:'fixture-session',salt:'fixture-salt',iat:now,exp:now+3600,iss:'alphaclone-systems',aud:'ac:client-portal'});
   const signed=unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
   await c.addCookies([{name:'ac_client_portal_session',value:signed,url:base}]);await page.goto(base+'/portal/fixture-client',{waitUntil:'domcontentloaded',timeout:120000});
   await page.getByRole('navigation',{name:'Client workspace',exact:true}).waitFor({timeout:30000});
   const detail=await metrics(page);if(!await page.getByRole('button',{name:/sign out|logout/i}).count())throw Error('client logout missing');return detail;
  });
  await c.close();results.finishedAt=new Date().toISOString();save();
 }finally{if(browser)await browser.close();if(server){try{process.kill(-server.pid,'SIGKILL');}catch{}}mock.close();}
 console.log(JSON.stringify({checks:results.checks.length,passed:results.checks.filter(r=>r.pass).length,failed:results.checks.filter(r=>!r.pass).length}));
 if(results.checks.some(r=>!r.pass))process.exitCode=1;
})().catch(error=>{results.fatal=error.message;save();console.error(error.message);if(server){try{process.kill(-server.pid,'SIGKILL');}catch{}}mock.close();process.exitCode=1;});
