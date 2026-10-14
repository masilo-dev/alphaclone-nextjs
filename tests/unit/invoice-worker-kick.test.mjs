import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleDurableWorkerKick} from '../../src/lib/bonnie/runtime/workerKick.ts';
test('response schedules only the persisted invoice task and never executes inline', async()=>{
 let callback; const calls=[];
 await scheduleDurableWorkerKick({tenantId:'tenant-a',taskId:'invoice-task'}, {
  schedule: work=>{callback=work}, process:async(...args)=>calls.push(args),log:()=>assert.fail('unexpected error')
 });
 assert.equal(calls.length,0);
 await callback();
 assert.deepEqual(calls,[[1,{tenantId:'tenant-a',taskId:'invoice-task'}]]);
});
test('worker failure is visible without enqueueing or resending the invoice',async()=>{
 let callback;let attempts=0;const logs=[];
 await scheduleDurableWorkerKick({tenantId:'t',taskId:'i'}, {
  schedule:work=>{callback=work},process:async()=>{attempts++;throw new Error('claim failed')},log:error=>logs.push(error.message)
 });
 await callback();assert.equal(attempts,1);assert.deepEqual(logs,['claim failed']);
});
test('unavailable request context leaves durable poller ownership and logs the failure',async()=>{
 let processed=false;const logs=[];
 await scheduleDurableWorkerKick({tenantId:'t',taskId:'i'}, {
  schedule:()=>{throw new Error('no request context')},process:async()=>{processed=true},log:error=>logs.push(error.message)
 });
 assert.equal(processed,false);assert.deepEqual(logs,['no request context']);
});

test('shared kick continues other persisted tasks after one worker error',async()=>{
 let callback;const calls=[];const logs=[];
 await scheduleDurableWorkerKick([{tenantId:'a',taskId:'email'},{tenantId:'a',taskId:'social'}], {
  schedule:work=>{callback=work},process:async(_,scope)=>{calls.push(scope.taskId);if(scope.taskId==='email')throw new Error('lookup failed')},log:error=>logs.push(error.message)
 });
 await callback();assert.deepEqual(calls,['email','social']);assert.deepEqual(logs,['lookup failed']);
});
