# ALPHACLONE SYSTEMS — LEAD FINDER AUDIT
**Module Assessment, Reverse Engineering & Production Readiness Report**
*Architecture: Next.js 15, TypeScript, Supabase PostgreSQL, Apify, Open-Source Scraping & MCP Execution*

---

## 1. Executive Summary

AlphaClone Systems' Lead Finder module empowers agency owners and B2B enterprises to discover, qualify, verify, and ingest high-intent business leads. This audit reviews the end-to-end lead discovery architecture across data acquisition, enrichment engines, database models, deduplication mechanisms, and CRM synchronization.

All findings have been benchmarked against industry-standard sales intelligence platforms (**Apollo.io**, **Clay.com**, **Instantly.ai**, **Smartlead.ai**, and **HubSpot Sales Hub**).

---

## 2. Competitive Feature Matrix: Lead Finder

| Feature / Capability | Apollo.io | Clay.com | Instantly | AlphaClone Systems (Remediated) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Geographic / Industry Search** | Global B2B directory | Waterfall scraping | Domain-only search | Multi-source (Google Maps, OpenStreetMap, Apify, Web) | **PARITY+** |
| **Domain & Website Deduplication** | Account-level dedupe | Custom formula dedupe | Global blocklist | Multi-layer (in-memory batch, DB website, company, contacts) | **PRODUCTION READY** |
| **Intelligence Scoring** | Proprietary buyer intent | Custom AI formulas | Verification score only | `intelligenceScoringService` + behavioral intent profile | **PARITY** |
| **Waterfall Enrichment** | Built-in email waterfall | Multi-vendor waterfall | Basic MX check | DNS, MX verification, LinkedIn URL extraction, custom fields | **PRODUCTION READY** |
| **Legacy & Modern Schema Parity** | Single CRM schema | Data grid schema | Flat recipient list | `insertLeadCompat` handling full/minimal DB layouts | **ZERO-REGRESSION** |
| **Operational vs Test Isolation** | Workspace tag | Workspace tag | N/A | Strict `is_test_data: false` gating across CRM views | **VERIFIED** |

---

## 3. Audited Components & Code Paths

1. **Discovery & Scraping**:
   - `src/services/leadService.ts`: Core lead query, pagination, keyset cursors, and local caching.
   - `src/lib/leads/insertLeadCompat.ts`: Schema-tolerant insert payload generator preventing schema mismatch failures across staging and production.
   - `src/lib/research/deduplication.ts`: Intra-batch and persistent CRM deduplication against `leads`, `contacts`, `companies`, and `lead_research_results`.
2. **CRM Identity Ingestion**:
   - `src/lib/crm/resolveOrCreateCRMIdentity.ts`: Deterministic identity resolution matching external ID, platform account, verified email, normalized phone, and domain identity.
   - `src/app/api/tenant/[tenantId]/leads/route.ts`: Keyset-paginated REST route supporting filtering by stage, status, search terms, and explicit test-data segregation.
3. **Recipient Import Engine**:
   - `src/app/api/email/campaigns/import-recipients/route.ts`: Multiformat ingestion pipeline supporting both standard `.csv` and Excel `.xlsx` spreadsheets via `ExcelJS`.

---

## 4. Key Remediation Summary

- **Defect 10 (Lead Count Inconsistencies)**: Previously, `leadService.getLeads()` filtered out terminal stages in memory while `/api/tenant/[tenantId]/leads` hardcoded `.neq('stage', 'converted')`, causing discrepancies against `canonicalWorkspaceStats`. Added explicit `includeConverted` and `is_test_data` query parameters and aligned operational filtering.
- **Defect 11 (Excel Upload Rejection)**: File upload endpoint previously rejected `.xlsx` files with HTTP 400. Integrated `readRecipientWorkbook` to parse `.xlsx` files seamlessly.
- **Defect 12 (Domain-Based Deduplication Blindspot)**: `checkCrmDuplicate` only checked leads by email and phone, omitting `leads.website`. Extended deduplication engine to match domain against `leads.website`, eliminating duplicate company entries.
