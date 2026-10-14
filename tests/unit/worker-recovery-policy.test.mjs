import test from 'node:test';
import assert from 'node:assert/strict';
import {workerRecoveryFilter} from '../../src/lib/bonnie/runtime/workerRecoveryPolicy.ts';
test('recovery admits new jobs plus an explicit existing job, leaving historical records intact',()=>{
 assert.equal(workerRecoveryFilter({BONNIE_WORKER_MIN_TASK_CREATED_AT:'2026-10-14T15:00:00Z',BONNIE_WORKER_RECOVERY_TASK_IDS:'391ac3d9-9b0c-4977-87e4-951e9f134a2c'}),'created_at.gte.2026-10-14T15:00:00.000Z,id.in.(391ac3d9-9b0c-4977-87e4-951e9f134a2c)');
});
test('invalid recovery configuration fails closed',()=>{
 assert.throws(()=>workerRecoveryFilter({BONNIE_WORKER_RECOVERY_TASK_IDS:'bad'}));
 assert.throws(()=>workerRecoveryFilter({BONNIE_WORKER_MIN_TASK_CREATED_AT:'bad'}));
 assert.throws(()=>workerRecoveryFilter({BONNIE_WORKER_RECOVERY_TASK_IDS:'391ac3d9-9b0c-4977-87e4-951e9f134a2c'}));
 assert.equal(workerRecoveryFilter({}),null);
});
