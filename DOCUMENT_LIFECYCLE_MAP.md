# AlphaClone Systems — Document & Contract Lifecycle Map

**Document Classification:** Architecture & State Transition Specification  
**System:** AlphaClone Systems Document & E-Signature Operating System  

---

## 1. Lifecycle State Machine Diagram

```
       ┌────────────────┐
       │     DRAFT      │◄──────────────────────────┐
       │ (No Signatures)│                           │
       └───────┬────────┘                           │
               │ Variables Validated & Prepared     │
               ▼                                    │
       ┌────────────────┐                           │
       │    PREPARED    │                           │
       └───────┬────────┘                           │
               │ Sent to Signatory (Token Created)  │
               ▼                                    │
       ┌────────────────┐                           │
       │      SENT      │                           │
       └───────┬────────┘                           │
               │ Recipient Opens Portal             │
               ▼                                    │
       ┌────────────────┐                           │
       │     VIEWED     │                           │
       └───────┬────────┘                           │
               ├─────────────────────────┐          │
               │ Multiple Signatories    │ Declined │
               ▼                         ▼          │
       ┌────────────────┐         ┌──────────┐      │
       │PARTIALLY_SIGNED│         │ DECLINED │──────┘ (New draft)
       └───────┬────────┘         └──────────┘
               │ All Parties Signed
               ▼
       ┌────────────────┐
       │  FULLY_SIGNED  │
       │  (COMPLETED)   │
       └───────┬────────┘
               │
               ▼
       ┌────────────────┐
       │ TAMPER SEALED  │
       │ & ARCHIVED PDF │
       └────────────────┘
```

---

## 2. Transition Guard Rules

1. **Draft -> Prepared / Sent:**
   - Content cannot contain unresolved `{{namespace.key}}` tokens or mandatory legacy placeholders (`[Client Name]`, `[Total Amount]`).
   - Tenant branding (Legal name, registered office address) must be resolved.
2. **Sent -> Viewed:**
   - Triggered when client visits `/contract/[signingToken]`.
   - Records `viewed` event in `contract_signature_events` with timestamp, client IP address, and browser user-agent.
3. **Viewed -> Signed:**
   - Mandatory acceptance of Electronic Signature Disclosure.
   - Requires valid non-empty signature payload (base64 image, SVG, or typed signature).
   - Rejection/Decline transitions agreement to `declined` state with optional decline note.
4. **Signed -> Fully Signed / Completed:**
   - Evaluated by verifying all `contract_parties` where `signature_required = true` have `signature_status = 'signed'`.
   - Generates authoritative completed PDF with cryptographic certificate and tamper seal.
   - Marks token as used (`used_at = now()`) and locks contract record against edits (`SIGNED_DOCUMENT_IMMUTABLE`).
