---
name: lead-qualification
description: Find, qualify, and nurture leads with user-defined criteria. Use on leads/sales-agent module.
allowed-tools: get_leads create_lead update_lead_status run_playbook recommend_next_steps search_facebook_leads find_and_qualify_leads parse_lead_criteria qualify_crm_leads get_scraper_leads start_lead_campaign nexus_lead_enrichment generate_outreach_draft get_account_overview
---

# Lead Qualification Skill

## When to use
- User asks about leads, qualification, discovery, or inbound prospects
- User describes ideal customer profile ("I only want SMB plumbers in Texas")
- User is on leads module

## Workflow
1. `get_account_overview` or `get_leads` for current pipeline state
2. `parse_lead_criteria` when user describes how they want leads qualified — saves to `nexus_memory`
3. `find_and_qualify_leads` for discovery (niche + location + min_score + tiers)
4. `qualify_crm_leads` to re-score existing pipeline leads
5. `get_scraper_leads` for campaign inventory
6. `update_lead_status` when qualification decision is clear
7. `generate_outreach_draft` or `run_playbook` with `inbound_lead_qualification`
8. `start_lead_campaign` for durable scrape → enrich → score → inject workflow

## Qualification tiers
- **Hot** (75+): strong contact signals — prioritize outreach
- **Warm** (50–74): viable with follow-up
- **Cold** (25–49): low priority
- **Skip** (<25): exclude unless user asks otherwise

## Rules
- Apply saved criteria from `parse_lead_criteria` on every search unless user overrides
- Use industry-aware scoring (phone-heavy for trades, email-heavy for professional services)
- Playbook sends may require approval
- Create tasks for human follow-up when confidence is low
