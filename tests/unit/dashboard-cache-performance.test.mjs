import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { getOrLoadStatsCache, clearStatsCache, getStatsCache } from '../../src/lib/dashboard/statsCache.ts';
import { CacheService } from '../../src/services/cacheService.ts';
import { rememberVisitedRoute } from '../../src/lib/dashboard/persistentRoutes.ts';
import { loadSavedStats, readSavedStats, clearSavedStats, statsRequestKey } from '../../src/lib/dashboard/clientStatsCache.ts';

test('concurrent dashboard reads share one load and warmed reads skip the loader', async () => {
  clearStatsCache();
  let calls = 0, release;
  const barrier = new Promise(resolve => release = resolve);
  const loader = async () => { calls++; await barrier; return { count: 42 }; };
  const reads = Array.from({length: 20}, () => getOrLoadStatsCache('home:tenant-a:user-a:today', loader));
  release();
  assert.equal((await Promise.all(reads)).length, 20);
  assert.equal(calls, 1);
  const start = performance.now();
  for (let i = 0; i < 1000; i++) assert.equal((await getOrLoadStatsCache('home:tenant-a:user-a:today', loader)).count, 42);
  const elapsed = performance.now() - start;
  assert.equal(calls, 1);
  console.log(`1,000 warm dashboard cache reads: ${elapsed.toFixed(2)} ms`);
});

test('invalidated reads cannot restore old values; failures never enter server cache', async () => {
  clearStatsCache();
  let release;
  const old = getOrLoadStatsCache('home:tenant-a:user-a:today', () => new Promise(resolve => release = resolve));
  await Promise.resolve();
  clearStatsCache('tenant-a');
  await getOrLoadStatsCache('home:tenant-a:user-a:today', async () => 'new');
  release('old'); await old;
  assert.equal(getStatsCache('home:tenant-a:user-a:today'), 'new');
  let calls = 0;
  for (let i = 0; i < 2; i++) await getOrLoadStatsCache('error', async () => { calls++; return Response.json({error:'offline'}, {status:503}); });
  assert.equal(calls, 2);
});

test('general module cache shares reads and isolates invalidated in-flight values', async () => {
  const cache = new CacheService();
  let calls = 0, release;
  const loader = () => { calls++; return new Promise(resolve => release = resolve); };
  const a = cache.get('tenant:a:projects', loader), b = cache.get('tenant:a:projects', loader);
  await Promise.resolve(); assert.equal(calls, 1);
  cache.invalidate('tenant:a:projects');
  await cache.get('tenant:a:projects', async () => ['new']);
  release(['old']); await Promise.all([a, b]);
  assert.deepEqual(await cache.get('tenant:a:projects', async () => []), ['new']);
});

test('visited screens survive navigation with a bounded five-screen working set', () => {
  let routes = [];
  for (const route of ['home','crm','projects','billing','mail','tasks']) routes = rememberVisitedRoute(routes, route);
  assert.deepEqual(routes, ['crm','projects','billing','mail','tasks']);
  routes = rememberVisitedRoute(routes, 'crm');
  assert.deepEqual(routes, ['projects','billing','mail','tasks','crm']);
});

test('client prefetch and screen share reads; user/tenant/period keys stay separate and reset blocks old saves', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.sessionStorage;
  const storage = new Map();
  globalThis.sessionStorage = { getItem:key=>storage.get(key)||null, setItem:(key,value)=>storage.set(key,value), removeItem:key=>storage.delete(key), key:index=>[...storage.keys()][index], get length(){return storage.size;} };
  let calls = 0, release;
  globalThis.fetch = async () => { calls++; await new Promise(resolve => release = resolve); return Response.json({stats:{totalLeads:7}}); };
  try {
    const key = statsRequestKey('user-a','tenant-a','/stats?period=today');
    assert.notEqual(key, statsRequestKey('user-b','tenant-a','/stats?period=today'));
    assert.notEqual(key, statsRequestKey('user-a','tenant-b','/stats?period=today'));
    assert.notEqual(key, statsRequestKey('user-a','tenant-a','/stats?period=month'));
    const a = loadSavedStats(key,'/stats'), b = loadSavedStats(key,'/stats');
    assert.equal(calls, 1); release(); await Promise.all([a,b]);
    assert.equal((await loadSavedStats(key,'/stats')).totalLeads, 7); assert.equal(calls, 1);
    const old = loadSavedStats(key,'/stats',true);
    clearSavedStats(); release(); await assert.rejects(old, /context changed/);
    assert.equal(readSavedStats(key), undefined);
  } finally { globalThis.fetch = originalFetch; globalThis.sessionStorage = originalStorage; clearSavedStats(); }
});
