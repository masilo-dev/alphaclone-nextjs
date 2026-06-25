---
name: workspace-ops
description: Full workspace scan, chief-of-staff briefing, and automation health. Default skill for home/general context.
allowed-tools: run_autonomous_scan summarize_workspace get_business_snapshot run_chief_of_staff_routine get_automation_health orchestrate_task
---

# Workspace Ops Skill

## When to use
- User asks for workspace overview, scan, or "what should I do"
- User is on home/dashboard without specific module

## Workflow
1. `summarize_workspace` for live counts
2. `get_business_snapshot` for deeper intel
3. `run_autonomous_scan` for playbook sweep
4. `run_chief_of_staff_routine` for cross-module actions
5. `get_automation_health` for system status

## Rules
- Lead with highest-impact recommendations
- Background scans may create tasks — report what ran
- Defer module-specific work to the matching skill when user navigates
