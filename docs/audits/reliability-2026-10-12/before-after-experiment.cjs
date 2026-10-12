const fs = require('node:fs'), vm = require('node:vm'), cp = require('node:child_process');
const ts = require(process.cwd() + '/node_modules/typescript');
const baseline = p => cp.execFileSync('git', ['show', '8f9f596a7a8b8273a50c44e37bd78661debe2c2a:' + p], { encoding: 'utf8' });
function load(source, dependencies = {}, globals = {}) {
 const exports = {};
 const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 vm.runInNewContext(code, { exports, require: n => dependencies[n] || {}, console, process, Date, Promise, Response, Request, Headers, URL, Event, setTimeout, clearTimeout, setInterval, clearInterval, ...globals });
 return exports;
}
(async () => {
 let beforeCalls = 0, afterCalls = 0;
 const old = baseline('src/lib/supabase.ts');
 const policyBlock = old.slice(old.indexOf('const sleep ='), old.indexOf('export const createClient')) + '\nexports.read = resilientSupabaseFetch;';
 const before = load(policyBlock, {}, { fetch: async () => { beforeCalls++; return Response.json({ healthy: true }); } }).read;
 const factory = load(fs.readFileSync('src/lib/readRequestPolicy.ts', 'utf8')).createReadRequestClient;
 const after = factory({ fetch: async () => { afterCalls++; return Response.json({ healthy: true }); } });
 await Promise.all(Array.from({length:20}, () => before('https://mock.example/rest/v1/profiles?id=eq.synthetic')));
 await Promise.all(Array.from({length:20}, () => after('https://mock.example/rest/v1/profiles?id=eq.synthetic')));
 const presenceCounts = [];
 for (const source of [baseline('src/services/presenceService.ts'), fs.readFileSync('src/services/presenceService.ts','utf8')]) {
  const window = new EventTarget(), document = new EventTarget(); document.visibilityState = 'visible'; const counts = {};
  const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
  window.addEventListener = (name, fn) => { counts[name] = (counts[name] || 0) + 1; add(name, fn); };
  window.removeEventListener = (name, fn) => { counts[name] = (counts[name] || 0) - 1; remove(name, fn); };
  const supabase = { auth: { getUser: async () => ({ data: { user: { id: 'synthetic-user' } } }) }, rpc: async () => ({ error:null }) };
  const service = load(source, {'../lib/supabase':{supabase}}, { window, document, navigator:{userAgent:'mock'}, setInterval:()=>1, clearInterval(){} }).presenceService;
  for (let i=0;i<20;i++){await service.initializePresence('synthetic-user');await service.cleanup('synthetic-user');}
  presenceCounts.push({mousemove:counts.mousemove||0,focus:counts.focus||0,beforeunload:counts.beforeunload||0});
 }
 const metrics = { baseline:'8f9f596a7a8b8273a50c44e37bd78661debe2c2a', scope:'isolated mocked boundaries; no live requests', concurrentIdenticalHealthyReads:{consumers:20,before:beforeCalls,after:afterCalls}, residualPresenceListenersAfter20MountCycles:{before:presenceCounts[0],after:presenceCounts[1]} };
 fs.writeFileSync('/tmp/ac-before-after.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
