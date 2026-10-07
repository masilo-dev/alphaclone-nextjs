import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveStatus,overallStatus,STALE_MS} from '../../src/lib/platform-monitoring/model.ts';
const now=Date.now();
const row={status:'operational',checked_at:new Date(now).toISOString(),metadata_json:{verified:true}};
test('green requires fresh verified evidence, never configuration or missing samples',()=>{
 assert.equal(effectiveStatus(row,now),'operational');
 assert.equal(effectiveStatus(undefined,now),'unknown');
 assert.equal(effectiveStatus({...row,metadata_json:{verified:false}},now),'unknown');
 assert.equal(effectiveStatus({...row,checked_at:new Date(now-STALE_MS-1).toISOString()},now),'unknown');
 assert.equal(effectiveStatus({...row,checked_at:'invalid'},now),'unknown');
 assert.equal(effectiveStatus({...row,checked_at:new Date(now+120000).toISOString()},now),'unknown');
});
test('outages take precedence over missing evidence; one unknown prevents all green',()=>{
 assert.equal(overallStatus(['operational','unknown']),'unknown');
 assert.equal(overallStatus(['unknown','major_outage']),'major_outage');
 assert.equal(overallStatus(['operational','degraded']),'degraded');
 assert.equal(overallStatus([]),'unknown');
 assert.equal(overallStatus(['operational','operational']),'operational');
});
