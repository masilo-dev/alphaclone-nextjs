import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLlmExecutionTruth} from '../../src/lib/mcp/llmTruthfulResponse.ts';
import {emailReceiptReferenceFields} from '../../src/lib/email/emailReferenceLookup.ts';
test('completed reads do not inherit business draft status', () => {
 const read=buildLlmExecutionTruth({toolName:'get_contract',parsedResult:{id:'record',status:'draft'}});
 assert.equal(read.status,'VERIFIED'); assert.equal(read.may_claim_completed,true); assert.match(read.user_message,/lookup/);
 assert.equal(buildLlmExecutionTruth({toolName:'get_contract',parsedResult:{success:false}}).status,'FAILED');
});
test('acceptance, queued jobs and unevidenced writes stay distinct', () => {
 const accepted=buildLlmExecutionTruth({toolName:'send_email',parsedResult:{status:'provider_accepted'}});
 assert.equal(accepted.status,'PROVIDER_PROCESSING');assert.equal(accepted.may_claim_completed,false);assert.match(accepted.user_message,/Final delivery has not been verified/);
 assert.equal(buildLlmExecutionTruth({toolName:'send_email',parsedResult:{status:'queued'}}).status,'QUEUED');
 assert.equal(buildLlmExecutionTruth({toolName:'create_project',parsedResult:{id:'record'}}).status,'REQUESTED');
 assert.equal(buildLlmExecutionTruth({toolName:'create_project',parsedResult:{receipt:{status:'verified'}}}).status,'VERIFIED');
});
test('numeric provider IDs never enter UUID tracking or action columns', () => {
 assert.deepEqual(emailReceiptReferenceFields('auto','1791401742485001200'),['provider_reference','idempotency_key']);
 assert.deepEqual(emailReceiptReferenceFields('action_id','91ffb42b-a672-4b8e-917f-9ce4c02b567d'),['action_id']);
 assert.throws(()=>emailReceiptReferenceFields('tracking_id','1791401742485001200'),/UUID/);
});
