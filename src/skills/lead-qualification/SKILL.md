---
name: lead-qualification
description: Qualify inbound leads and start outreach playbooks. Use on leads/sales-agent module.
allowed-tools: get_leads create_lead update_lead_status run_playbook recommend_next_steps search_facebook_leads
---

# Lead Qualification Skill

## When to use
- User asks about leads, qualification, or inbound prospects
- User is on leads module

## Workflow
1. `get_leads` for current pipeline
2. `update_lead_status` when qualification decision is clear
3. `run_playbook` with `inbound_lead_qualification` for full automation
4. `search_facebook_leads` for social-sourced prospects
5. `recommend_next_steps` for prioritization

## Rules
- Score leads by buying signals in notes/description
- Playbook sends may require approval
- Create tasks for human follow-up when confidence is low
