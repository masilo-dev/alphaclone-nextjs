---
name: stale-deal-follow-up
description: Identify and advance stale deals in the pipeline. Use for deal reviews, pipeline health, or stage moves.
allowed-tools: get_deals move_deal_stage score_deal get_pipeline_summary create_task recommend_next_steps
---

# Stale Deal Follow-Up Skill

## When to use
- User asks about stale deals, pipeline health, or deal follow-ups
- User is on deals module

## Workflow
1. Call `get_deals` to list pipeline deals
2. Use `get_pipeline_summary` for stage distribution
3. `score_deal` on high-value stale opportunities
4. `move_deal_stage` when user confirms stage change
5. `create_task` for follow-up reminders

## Rules
- Highlight deals with no recent activity first
- Do not move stages without clear user intent
- Tie recommendations to deal value and stage
