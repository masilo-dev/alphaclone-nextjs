---
name: meeting-prep
description: Prepare for meetings using calendar and CRM context. Use for calendar, meetings, or prep requests.
allowed-tools: get_meetings create_meeting microsoft_get_calendar microsoft_create_meeting get_contacts get_tasks
---

# Meeting Prep Skill

## When to use
- User asks to prep for meetings, schedule calls, or review calendar
- User is on meetings/calendar module

## Workflow
1. `get_meetings` or `microsoft_get_calendar` for upcoming events
2. `get_contacts` / CRM tools for attendee context
3. `get_tasks` for related action items
4. `create_meeting` or `microsoft_create_meeting` to schedule if needed

## Rules
- Summarize agenda, attendees, and open items
- Flag conflicts or missing prep tasks
- Keep prep brief and actionable
