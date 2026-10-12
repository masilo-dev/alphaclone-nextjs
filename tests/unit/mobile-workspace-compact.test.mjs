import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import postcss from 'postcss';

const read = path => fs.readFileSync(path, 'utf8');

test('phone keyboard follows visible viewport and removes listeners on cleanup', () => {
  let effect;
  const exports = {};
  const listeners = new Map(), viewportListeners = new Map(), properties = new Map();
  let width = 390;
  const root = { dataset: {}, style: { setProperty:(key,value)=>properties.set(key,value), removeProperty:key=>properties.delete(key) } };
  const viewport = { height: 844, addEventListener:(key,fn)=>viewportListeners.set(key,fn), removeEventListener:key=>viewportListeners.delete(key) };
  const window = { innerHeight:844, visualViewport:viewport, matchMedia:()=>({matches:width<768}), addEventListener:(key,fn)=>listeners.set(key,fn), removeEventListener:key=>listeners.delete(key) };
  const code = ts.transpileModule(read('src/hooks/usePhoneViewport.ts'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code, {exports, require:()=>({useEffect:fn=>effect=fn}), window, document:{documentElement:root}});
  exports.usePhoneViewport(); const cleanup = effect();
  assert.equal(root.dataset.keyboardOpen, 'false');
  viewport.height = 480; viewportListeners.get('resize')();
  assert.equal(root.dataset.keyboardOpen, 'true');
  assert.equal(properties.get('--ac-visible-height'), '480px');
  viewport.height = 844; viewportListeners.get('resize')();
  assert.equal(root.dataset.keyboardOpen, 'false');
  width = 1024; viewport.height = 480; listeners.get('resize')();
  assert.equal(root.dataset.keyboardOpen, 'false');
  cleanup(); assert.equal(listeners.size,0); assert.equal(viewportListeners.size,0); assert.equal(properties.size,0);
});

test('phone action rows are excluded from generic dialog grid stacking', () => {
  const css = postcss.parse(read('src/styles/alphaclone-os-v3-pwa.css'));
  const flattened = [];
  css.walkRules(rule => { if (rule.selector.includes('.grid-cols-3')) flattened.push(rule.selector); });
  assert.ok(flattened.length >= 3);
  for (const selector of flattened) assert.ok(selector.includes(':not([data-record-actions])'));
  const compact = postcss.parse(read('src/styles/mobile-workspace-compact.css'));
  let actionPosition;
  compact.walkRules('.ac-record-actions', rule => rule.walkDecls('position', declaration => actionPosition = declaration.value));
  assert.equal(actionPosition, 'static');
});

test('pane height chain and Bonnie composer use bounded phone layouts', () => {
  const route = read('src/components/dashboard/business/BusinessDashboard.tsx');
  assert.match(route, /data-module-layout=/);
  assert.match(route, /w-full h-full min-h-0 flex flex-col/);
  const tabs = read('src/components/ui/EnterpriseTabWrapper.tsx');
  for (const path of ['/dashboard/projects', '/dashboard/bonnie', '/dashboard/business/bonnie']) assert.ok(tabs.includes(`'${path}'`));
  const chat = read('src/components/dashboard/bonnie/BonnieChatPanel.tsx');
  assert.match(chat, /!e.nativeEvent.isComposing/);
  assert.match(chat, /Math.min\(120, Math.max\(44, element.scrollHeight\)\)/);
  const client = read('src/components/dashboard/CRMTab.tsx');
  assert.doesNotMatch(client.slice(client.indexOf('const clientActions'), client.indexOf('  return (', client.indexOf('const clientActions'))), /sticky bottom|fixed bottom/);
});
