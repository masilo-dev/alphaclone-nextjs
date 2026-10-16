# ALPHACLONE SYSTEMS — EMAIL DELIVERY EVIDENCE
**Deliverability Validation, Attachment Handling & Provider Protocol Verification**

---

## 1. Deliverability Hardening & Protocol Evidence

This document establishes engineering proof of deliverability verification across provider adapters, payload formats, and persistence schemas.

### 1.1 Zoho Mail Raw Binary Attachment Protocol
- **Endpoint**: `https://mail.zoho.com/api/accounts/{accountId}/messages/attachments?fileName={fileName}`
- **Defect Identified**: Previously, `ZohoMailService.ts` line 506 overrode headers with `fallbackHeaders['Content-Type'] = contentType` (e.g. `application/pdf`), triggering HTTP 415 (Unsupported Media Type).
- **Remediation Evidence**:
  ```typescript
  // src/services/zoho/ZohoMailService.ts
  const fallbackHeaders: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${token}`,
    'Content-Type': 'application/octet-stream',
  };
  // Explicitly removed: fallbackHeaders['Content-Type'] = contentType;
  ```
- **Automated Test Verification**: `tests/unit/outreach-campaign-repairs.test.mjs` verifies that `'Content-Type': 'application/octet-stream'` is strictly enforced and no override exists.

### 1.2 Universal Inbox Schema Reflection
- **Defect Identified**: Mailbox IMAP sync previously ingested messages only into `email_messages`/`email_threads`, leaving `unified_messages` empty and causing `AlphaCloneEmailWorkspace.tsx` to render empty states.
- **Remediation Evidence**:
  ```typescript
  // src/lib/email/mailboxService.ts
  await admin.from('unified_messages').upsert({
    tenant_id: tenantId,
    external_id: messageId,
    channel: 'email',
    direction: folder === 'sent' ? 'outbound' : 'inbound',
    from: fromAddress,
    to: toAddress,
    subject: subject,
    text: bodyText,
    html: bodyHtml,
    sent_at: date.toISOString(),
  }, { onConflict: 'tenant_id,channel,external_id' });
  ```
- Additionally, `GET /api/tenant/[tenantId]/inbox/messages` route was implemented with full search and folder support.

### 1.3 Provider Acceptance vs. Delivery Separation
- **Protocol Rule**: No email is marked as `delivered` upon provider HTTP 200.
- **Evidence**: `sendScheduledCampaignServer.ts` sets `status: 'sent'` with `verified_provider_receipt: true`. Status is only upgraded to `delivered` when incoming delivery webhooks (SendGrid `delivered`, Resend `email.delivered`) arrive with matching `provider_message_id`.

### 1.4 Bounded Concurrency & Idempotency
- **Worker Configuration**: Parallel pool capped at 5 concurrent worker promises.
- **Idempotency Key**: Every call to `sendEmailServer` sends `campaign:${tenantId}:${campaignId}:recipient:${recipient.id}` ensuring that even network retries cannot execute double sends.
