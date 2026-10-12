import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, dependencies) {
 const exports = {};
 const code = ts.transpileModule(fs.readFileSync(path,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>dependencies[name],console,Promise});
 return exports;
}
test('workspace context starts snapshot and module reads together', async () => {
 const started = []; let release;
 const barrier = new Promise(resolve=>release=resolve);
 const module = load('src/lib/bonnie/bonnieWarmContext.ts',{
  '@/lib/bonnie/bonnieWorkspaceSnapshot':{getBonnieWorkspaceSnapshot:async()=>{started.push('snapshot');await barrier;return {counts:{},module_summary:'test'};}},
  '@/lib/bonnie/executeSingleBonnieTool':{executeSingleBonnieTool:async input=>{started.push(input.tool);await barrier;return {tool:input.tool,success:true};}},
  '@/lib/bonnie/bonnieTenantDataRules':{BONNIE_MODULE_DATA_TOOLS:{general:['list_leads']}}
 });
 const request=module.warmBonnieWorkspaceContext('tenant','user','general');
 assert.deepEqual(started,['snapshot','summarize_workspace','list_leads']);
 release();const result=await request;assert.equal(result.warmResults.length,2);
});
test('agent session history and clearing are restricted to the selected conversation', async()=>{
 const queries=[];
 const db={from(){const filters=[];queries.push(filters);const q={select(){return q;},eq(key,value){filters.push([key,value]);return q;},order(){return q;},limit(){return q;},delete(){return q;},maybeSingle(){return Promise.resolve({data:null,error:null});},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}};return q;}};
 const {BonnieDatabaseSession}=load('src/lib/bonnie/bonnieDatabaseSession.ts',{'@/lib/supabase-admin':{createSupabaseAdminClient:()=>db}});
 const a=new BonnieDatabaseSession({tenantId:'tenant',userId:'user',conversationId:'chat-a'});
 const b=new BonnieDatabaseSession({tenantId:'tenant',userId:'user',conversationId:'chat-b'});
 assert.notEqual(await a.getSessionId(),await b.getSessionId());
 await a.getItems();await a.popItem();await a.clearSession();
 for(const filters of queries){assert.ok(filters.some(([key,value])=>key==='session_id'&&value===a.sessionId));assert.ok(filters.some(([key,value])=>key==='tenant_id'&&value==='tenant'));assert.ok(filters.some(([key,value])=>key==='user_id'&&value==='user'));}
});
