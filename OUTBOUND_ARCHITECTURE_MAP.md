# ALPHACLONE SYSTEMS — OUTBOUND ARCHITECTURE MAP
**End-to-End System Topology, Data Flow & Interaction Architecture**

---

## 1. System Topology Overview

AlphaClone Systems' sales engagement architecture is built on a unified event-driven engine connecting data discovery pipelines with customer relationship management and multichannel delivery providers.

```mermaid
flowchart TD
    subgraph LeadAcquisition ["1. Lead Acquisition & Enrichment"]
        A1["Apify / Google Maps Scraper"] --> A2["Intra-Batch Deduplication"]
        A2 --> A3["checkCrmDuplicate (Email / Phone / Domain)"]
        A3 --> A4["intelligenceScoringService"]
        A4 --> A5["insertLeadCompat ('leads' table)"]
    end

    subgraph CampaignEngine ["2. Campaign Orchestration"]
        B1["Email / Multichannel Campaign"] --> B2["Preflight & Safety Checks"]
        B2 --> B3["Quiet Hours & 7-Day Frequency Cap"]
        B3 --> B4["Provider Daily Limit Allocator"]
        B4 --> B5["Worker Pool (Concurrency = 5)"]
        B5 --> B6["Atomic Claim (status = 'sending')"]
    end

    subgraph MultichannelDelivery ["3. Multichannel Dispatch"]
        B6 --> C1{"Channel"}
        C1 -->|"Email"| C2["SendGrid / Resend / Brevo / Zoho"]
        C1 -->|"WhatsApp"| C3["WhatsApp Cloud API (phone resolve)"]
        C2 --> C4["idempotencyKey + provider_accepted"]
        C3 --> C4
        C4 --> C5["contacts & leads (last_contacted_at)"]
        C4 --> C6["captureUnifiedMessageFromWebhook ('unified_messages')"]
    end

    subgraph InboundIntelligence ["4. Inbound Engagement & Conversion"]
        D1["Inbound Webhook / IMAP Sync"] --> D2["recordInboundOutreachReply"]
        D2 --> D3{"Sequence / Campaign / Log Match"}
        D3 -->|"Unsubscribe"| D4["outreach_suppressions"]
        D3 -->|"Stop-on-Reply"| D5["Halt Sequence Enrollments"]
        D3 -->|"Positive Reply"| D6["Automatic 'deals' Creation"]
        D6 --> D7["revenue_lifecycle_links ('converted_to')"]
    end

    A5 --> B1
    C5 --> D1
```

---

## 2. Execution Sequence: Campaign Send to Opportunity Creation

```mermaid
sequenceDiagram
    autonumber
    participant Worker as Scheduled Campaign Server
    participant DB as Supabase PostgreSQL
    participant Provider as Email Provider (SendGrid/Resend/Zoho)
    participant Recipient as Lead / Prospect
    participant ReplyEngine as Inbound Reply Engine
    participant CRM as CRM / Deals Pipeline

    Worker->>DB: Preflight delivery check & load pending recipients
    Worker->>DB: Atomic claim: UPDATE campaign_recipients status='sending'
    Worker->>DB: Check suppressions, marketing consent & 7-day cap
    Worker->>Provider: sendEmailServer(idempotencyKey, preferredProvider)
    Provider-->>Worker: HTTP 200 { success: true, emailId: "prov_msg_123" }
    Worker->>DB: UPDATE campaign_recipients status='sent', sent_at=now()
    Worker->>DB: UPDATE contacts & leads last_contacted_at=now(), status='contacted'
    Worker->>DB: INSERT outreach_events (event_type='sent')
    Worker->>DB: UPSERT unified_messages (Universal Inbox reflection)

    Recipient-->>ReplyEngine: Inbound Reply: "I am interested, let's talk next week"
    ReplyEngine->>DB: Match recipient via campaign_recipients fallback
    ReplyEngine->>DB: classifyOutreachReply -> 'positive'
    ReplyEngine->>DB: UPDATE campaign_recipients status='replied'
    ReplyEngine->>DB: UPDATE leads outreach_status='replied', status='qualified'
    ReplyEngine->>CRM: INSERT deals (stage='qualification', source='outreach')
    ReplyEngine->>CRM: INSERT revenue_lifecycle_links (relationship='converted_to')
```

---

## 3. Database Schema Interconnections

1. **`leads`**:
   - Stores prospective companies, websites, phones, emails, intelligence scores, and `outreach_status`.
   - Linked to `contacts` via `contact_id` and `business_clients` via `client_id`.
2. **`campaign_recipients`**:
   - Represents individualized delivery units. Holds `status` (`pending`, `sending`, `sent`, `failed`, `replied`), `metadata.abVariant`, and `provider_message_id`.
3. **`unified_messages`**:
   - Canonical real-time omnichannel message storage powering `AlphaCloneEmailWorkspace.tsx`.
4. **`outreach_events`**:
   - Immutable audit trail of dispatch events, webhook receipts, open pixels, click redirects, and classification outcomes.
5. **`deals` & `revenue_lifecycle_links`**:
   - Connects qualified outbound interest directly into the revenue conversion engine.
