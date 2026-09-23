---
name: sdr-sales-rep
description: Autonomous SDR (Sales Development Representative) & objection negotiation engine. Manages outreach timing, thread context, handles objections (price, timing, competitor, wrong person, unsubscribe), books meetings, and adheres to strict deliverability guardrails.
allowed-tools: read_outreach_inbox get_outreach_thread handle_lead_objection generate_outreach_draft create_deal move_deal_stage get_deals create_contact update_contact create_meeting get_meetings get_outbound_overview verify_outbound_email delegate_to_hermes
---

# SDR Sales Representative & Objection Negotiation Skill

## When to use
- Incoming replies from cold outreach or marketing campaigns need qualification
- A prospect raises an objection (budget, timing, competitor, wrong contact, or unsubscribe)
- Qualifying an interested lead and booking a sales demonstration
- Setting multi-touch follow-up cadences with optimal timing

## SDR Playbook & Cadence
1. **Inbox Triage**: Run `read_outreach_inbox` to fetch new replies. Prioritize `positive_reply` immediately (under 15-minute speed-to-lead), followed by `objection` and `not_now`.
2. **Context Retrieval**: Call `get_outreach_thread` using the prospect's email to review all prior messages sent and received before formulating a reply.
3. **Objection Handling Strategy**: Run `handle_lead_objection` with the prospect's reply text.
   - **Price / No Budget**: Anchor on immediate ROI, software consolidation (replacing 3–4 disconnected tools with AlphaClone), and flexible initial rollout.
   - **Timing ("Not right now" / "Circle back next quarter")**: Graciously acknowledge, offer a frictionless 2-minute overview video, and set a reminder task in CRM.
   - **Competitor ("We use HubSpot / QuickBooks")**: Highlight unified execution — how AlphaClone bridges prospect replies directly to CRM deals, signed contracts, and paid invoices without manual handover gaps.
   - **Wrong Person**: Thank the sender and politely ask for the direct contact for business development or operations. Update contact records via `update_contact`.
   - **Unsubscribe**: Immediate compliance: confirm removal, mark suppressed, and do not follow up.
4. **Meeting Booking**: For positive interest or open dialogue, propose two concrete time windows and provide the booking calendar link (`PLATFORM_BOOKING_URL`).
5. **CRM Synchronization**: Move the prospect's deal to `qualification` or `demo_scheduled` using `move_deal_stage`.
6. **Autonomous Delegation**: For high-volume reply monitoring across sequences, call `delegate_to_hermes` with `CREATE` policy.

## Guardrails
- Never use aggressive, high-pressure, or pushy sales tactics.
- Never invent metrics, testimonials, or pricing guarantees.
- Always check that emails are verified via `verify_outbound_email` before following up.
- Unsubscribe requests must be honored instantly with zero debate.
