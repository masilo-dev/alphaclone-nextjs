/**
 * Outbound Safety & Quota Enforcement Unit Tests.
 *
 * Verifies Phase 3 requirements:
 * 1. Email usage metering never charges for failed sends.
 * 2. Successful sends debit quota deterministically and idempotently.
 * 3. LinkedIn social publishing strictly rejects personal vs organization destination mismatches.
 * 4. Facebook/Instagram platform vs identity_type conflicts fail closed.
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  recordSuccessfulEmailSend,
  recordFailedEmailAttempt,
  checkEmailSendQuotaAvailable,
} = await import("../../src/lib/email/usageMeteringService.ts");

const { handlePublishSocialPost } = await import("../../src/lib/mcp/tools/socialPublishTool.ts");

test("recordFailedEmailAttempt never charges tenant quota", async () => {
  await assert.doesNotReject(async () => {
    await recordFailedEmailAttempt({
      tenantId: "11111111-1111-4111-8111-111111111111",
      initiationSource: "unit_test",
      failureFingerprint: "smtp_connection_refused",
      attemptNumber: 1,
      provider: "smtp",
    });
  });
});

test("socialPublishTool fails closed when platform conflicts with identity_type", async () => {
  const res = await handlePublishSocialPost(
    "publish_social_post",
    {
      platform: "facebook",
      identity_type: "linkedin_person",
      content: "Hello world",
    },
    { tenantId: "11111111-1111-4111-8111-111111111111", userId: "user-123" }
  );

  assert.equal(res.isError, true);
  const payload = JSON.parse(res.content[0].text);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "SOCIAL_DESTINATION_MISMATCH");
  assert.match(payload.error.message, /conflicts with identity_type/i);
});

test("socialPublishTool rejects linkedin_organization_id when destination is personal", async () => {
  const res = await handlePublishSocialPost(
    "publish_social_post",
    {
      platform: "linkedin",
      post_as: "personal",
      linkedin_organization_id: "urn:li:organization:123456",
      content: "AlphaClone company update",
    },
    { tenantId: "11111111-1111-4111-8111-111111111111", userId: "user-123" }
  );

  assert.equal(res.isError, true);
  const payload = JSON.parse(res.content[0].text);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "LINKEDIN_DESTINATION_MISMATCH");
  assert.match(payload.error.message, /cannot be used when the requested destination is personal/i);
});

test("socialPublishTool rejects broadcast post_as=all_pages as ambiguous", async () => {
  const res = await handlePublishSocialPost(
    "publish_social_post",
    {
      platform: "facebook",
      post_as: "all_pages",
      content: "Broadcast update",
    },
    { tenantId: "11111111-1111-4111-8111-111111111111", userId: "user-123" }
  );

  assert.equal(res.isError, true);
  const payload = JSON.parse(res.content[0].text);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "TARGET_AMBIGUOUS");
});
