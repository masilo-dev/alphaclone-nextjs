---
name: campaign-diagnose
description: Diagnose email campaign health and recommend fixes. Use for marketing campaigns, deliverability, or send issues.
allowed-tools: campaign_brief campaign_diagnose create_bulk_email_campaign queue_email_campaign_send get_automation_health
---

# Campaign Diagnose Skill

## When to use
- User asks to diagnose, fix, or publish email campaigns
- User is on campaigns/marketing module

## Workflow
1. `campaign_diagnose` with campaign_id if provided
2. `campaign_brief` for strategy context
3. Fix issues with `create_bulk_email_campaign` or edits
4. Publish with `queue_email_campaign_send` when ready (approval may be required)
5. Check `get_automation_health` for systemic issues

## Rules
- Always diagnose before bulk send
- Bulk sends may require approval — state this clearly
- Never publish without campaign_id from prior tool results
