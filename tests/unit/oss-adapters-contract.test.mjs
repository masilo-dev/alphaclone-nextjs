/**
 * Specialist Open-Source Integrations Unit Tests (Phases 6–9).
 * Tests isolated adapters for Paperless-ngx, Documenso, Chatwoot, and Mautic.
 * Confirms disabled-by-default behavior, suppression safety, and cryptographic signature validation.
 */
import test from "node:test";
import assert from "node:assert/strict";

const { getPaperlessConfig, searchPaperlessDocuments } = await import(
  "../../src/lib/integrations/paperless/paperlessAdapter.ts"
);

const { getDocumensoConfig, verifyDocumensoSignature } = await import(
  "../../src/lib/integrations/documenso/documensoAdapter.ts"
);

const { getChatwootConfig, fetchContactConversations } = await import(
  "../../src/lib/integrations/chatwoot/chatwootAdapter.ts"
);

const { getMauticConfig, syncContactToMautic } = await import(
  "../../src/lib/integrations/mautic/mauticAdapter.ts"
);

test("Paperless adapter is safely disabled when env variables are absent", async () => {
  const config = getPaperlessConfig();
  assert.equal(config.enabled, false);

  const res = await searchPaperlessDocuments("11111111-1111-4111-8111-111111111111", "invoice");
  assert.equal(res.documents.length, 0);
  assert.match(res.error || "", /not enabled/i);
});

test("Documenso signature verification validates correct HMAC SHA-256 signatures", async () => {
  const secret = "test_webhook_secret_key_12345";
  const payload = JSON.stringify({ event: "document.completed", documentId: "doc_999" });

  const crypto = await import("node:crypto");
  const validSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  assert.equal(verifyDocumensoSignature(payload, validSignature, secret), true);
  assert.equal(verifyDocumensoSignature(payload, "invalid_tampered_signature", secret), false);
  assert.equal(verifyDocumensoSignature(payload, null, secret), false);
});

test("Chatwoot adapter is safely disabled when env variables are absent", async () => {
  const config = getChatwootConfig();
  assert.equal(config.enabled, false);

  const res = await fetchContactConversations("11111111-1111-4111-8111-111111111111", "client@example.com");
  assert.equal(res.conversations.length, 0);
  assert.match(res.error || "", /not enabled/i);
});

test("Mautic adapter strictly respects contact suppression flags", async () => {
  const res = await syncContactToMautic({
    tenantId: "11111111-1111-4111-8111-111111111111",
    email: "unsubscribed@example.com",
    isSuppressed: true,
  });

  // Must skip sync and not make outbound calls for suppressed contacts
  assert.equal(res.success, true);
  assert.match(res.error || "", /suppressed/i);
});
