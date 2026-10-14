import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseQueueHealth} from '../../src/lib/bonnie/runtime/queueHealth.ts';
const now=Date.parse('2026-10-14T15:30:00Z');
test('due unstarted work is flagged without claiming it failed or delivered',()=>{
 const result=diagnoseQueueHealth([{id:'invoice',status:'READY',updated_at:'2026-10-14T15:07:46Z'}],now);
 assert.equal(result.status,'stalled');assert.deepEqual(result.stalled_task_ids,['invoice']);assert.match(result.message,/do not resend/);
});
test('future, fresh, approval, completed and running tasks are not stalled queue work',()=>{
 const tasks=[['future','READY','2026-10-15T00:00:00Z'],['approval','WAITING_FOR_APPROVAL'],['done','COMPLETED'],['running','RUNNING']].map(([id,status,scheduled_at])=>({id,status,scheduled_at,updated_at:'2026-10-01T00:00:00Z'}));
 tasks.push({id:'fresh',status:'QUEUED',updated_at:'2026-10-14T15:29:59Z'});
 assert.equal(diagnoseQueueHealth(tasks,now).status,'no_stalled_tasks');
});
