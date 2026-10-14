import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveInvoiceSendVerification} from '../../src/services/automation/verificationService.ts';
import {buildLlmExecutionTruth} from '../../src/lib/mcp/llmTruthfulResponse.ts';
test('paid and issued invoice is not proof of an email send',()=>{
 const result=deriveInvoiceSendVerification({id:'i',status:'paid',issued_at:'2026-10-14',canonical_delivery_status:'not_sent'},[]);
 assert.equal(result.status,'not_sent');assert.equal(result.retryable,false);
 const truth=buildLlmExecutionTruth({toolName:'verify_invoice_sent',parsedResult:{ok:true,data:result}});
 assert.equal(truth.status,'REQUESTED');assert.equal(truth.may_claim_completed,false);
});
test('provider acceptance is distinct from final delivery',()=>{
 const receipt={provider_msg_id:'provider-1',delivery_status:'PENDING'};
 const accepted=deriveInvoiceSendVerification({id:'i',status:'sent'},[receipt]);
 assert.equal(accepted.status,'provider_accepted');assert.equal(accepted.retryable,false);
 assert.equal(buildLlmExecutionTruth({toolName:'verify_invoice_sent',parsedResult:{data:accepted}}).may_claim_completed,false);
 assert.equal(deriveInvoiceSendVerification({id:'i'},[{...receipt,delivered_at:'2026-10-14'}]).status,'verified');
});
test('bounce, unknown and queue never suggest a blind retry',()=>{
 assert.equal(deriveInvoiceSendVerification({id:'i'},[{provider_msg_id:'p',bounced_at:'2026-10-14'}]).status,'failed');
 assert.equal(deriveInvoiceSendVerification({id:'i',status:'sent'},[]).status,'unknown');
 assert.equal(deriveInvoiceSendVerification({id:'i',canonical_delivery_status:'queued'},[]).status,'queued');
});
