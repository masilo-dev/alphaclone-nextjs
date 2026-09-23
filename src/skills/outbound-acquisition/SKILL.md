---
name: outbound-acquisition
description: End-to-end B2B outbound acquisition engine. Discover prospects, score against ICP, verify email deliverability, check mailbox health, personalize outreach, and monitor replies.
allowed-tools: get_outbound_overview list_outbound_icps qualify_outbound_lead verify_outbound_email get_mailbox_health_status find_and_qualify_leads get_leads create_lead generate_outreach_draft create_email_sequence enroll_contact_in_sequence campaign_diagnose delegate_to_hermes
---

# Outbound Acquisition Skill

## When to use
- User asks about outbound campaigns, B2B acquisition, lead prospecting, or cold email
- User wants to qualify leads against an Ideal Customer Profile (ICP)
- User wants to verify email deliverability before sending
- User asks about mailbox health, SPF/DKIM/DMARC, or sending quotas
- User is on the outbound or outreach module

## Acquisition Lifecycle Workflow
1. **Health Check**: Call `get_outbound_overview` and `get_mailbox_health_status` to ensure sender infrastructure (SPF, DMARC, MX) is healthy and daily limits are not exceeded.
2. **ICP Alignment**: Call `list_outbound_icps` to load the active Ideal Customer Profile.
3. **Prospect Discovery**: Run `find_and_qualify_leads` or `get_leads` to pull prospect records.
4. **AI Qualification**: Run `qualify_outbound_lead` against the target ICP. Filter out disqualified or low-fit leads.
5. **Email Verification**: Call `verify_outbound_email` for every prospect. Block invalid, disposable, or unverified emails.
6. **Personalized Copy**: Use `generate_outreach_draft` to craft highly targeted, relevant copy without hallucinations or fabricated claims.
7. **Sequence Staging**: Use `create_email_sequence` and `enroll_contact_in_sequence`. If sending requires external action, stage for human approval.
8. **Long-Running Delegation**: For large-scale batch prospecting across multiple days, call `delegate_to_hermes` with policy `CREATE` or `EXTERNAL_ACTION`.

## Execution Rules
- NEVER send to unverified or invalid email addresses. Deliverability and domain reputation take precedence.
- If sending from a primary domain, alert the user about domain reputation risks.
- Positive replies require speed-to-lead follow-up: draft a personalized response and recommend booking a demo.
- Unsubscribe requests must be respected immediately and added to the suppression list.
