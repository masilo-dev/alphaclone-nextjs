---
name: campaign-diagnose
description: Diagnose email campaign health and recommend fixes. Use for marketing campaigns, deliverability, or send issues.
allowed-tools: campaign_brief campaign_diagnose create_bulk_email_campaign queue_email_campaign_send get_automation_health get_mailbox_health_status get_outbound_overview
---

# Campaign Diagnose Skill

## When to use
- User asks to diagnose, fix, or publish email campaigns
- User asks about sender deliverability, SPF, DKIM, DMARC, or mailbox health
- User is on campaigns/marketing module

## Workflow
1. `get_mailbox_health_status` with `check_dns: true` to ensure sending domain records (SPF, DMARC, MX) are intact
2. `campaign_diagnose` with campaign_id if provided
3. `campaign_brief` for strategy context
4. Fix issues with `create_bulk_email_campaign` or edits
5. Publish with `queue_email_campaign_send` when ready (approval may be required)
6. Check `get_automation_health` and `get_outbound_overview` for systemic issues

## Rules
- Always diagnose before bulk send
- Verify mailbox SPF and DMARC status; alert if sending from a primary business domain
- Bulk sends may require approval — state this clearly
- Never publish without campaign_id from prior tool results
