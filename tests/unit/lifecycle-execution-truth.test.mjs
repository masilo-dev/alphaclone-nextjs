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
test('provider receipts resolve the recipient without mistaking business IDs for email',async()=>{
 const {emailReceiptRecipient}=await import('../../src/lib/email/emailReferenceLookup.ts');
 assert.equal(emailReceiptRecipient({sanitized_input:{target:{resource_type:'email_message',resource_id:'bonniiehendrix@gmail.com'}}}),'bonniiehendrix@gmail.com');
 assert.equal(emailReceiptRecipient({sanitized_input:{target:{resource_type:'contract',resource_id:'9d4ad497-7b90-4e46-a6c0-2f3b1671a4f2'}}}),null);
 assert.equal(emailReceiptRecipient({sanitized_output:{sent_to:'bonniiehendrix@gmail.com'}}),'bonniiehendrix@gmail.com');
});
test('structured provider failures carry FAILED execution truth',async()=>{
 const {structuredErrorToMcpContent}=await import('../../src/lib/mcp/formatMcpError.ts');
 const result=structuredErrorToMcpContent({ok:false,tool:'send_contract',data:null,receipt:null,error:{code:'EMAIL_SENDER_NOT_VERIFIED',message:'Activate the configured tenant sender',retryable:false},meta:{}});
 const parsed=JSON.parse(result.content[0].text);assert.equal(parsed.error.code,'EMAIL_SENDER_NOT_VERIFIED');assert.equal(parsed.execution_truth.status,'FAILED');assert.equal(parsed.execution_truth.may_claim_completed,false);
});
test('dispatched pending mailbox status remains resumable rather than executing', () => {
 const pending=buildLlmExecutionTruth({toolName:'execute_internal_tool',parsedResult:{ok:true,tool:'get_email_sync_status',data:{status:'pending'},receipt:{status:'pending'}}});
 assert.equal(pending.status,'REQUESTED');assert.equal(pending.may_claim_completed,false);assert.match(pending.next_action,/Resume sync_all_inboxes/);
});
