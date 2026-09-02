# AlphaClone MCP Full Execution Audit

Generated: 2026-09-02T10:01:09.149Z

## Summary

| Metric | Value |
| --- | ---: |
| Expected baseline | 518 |
| Discovered (runtime) | 530 |
| Implemented (registry) | 530 |
| Passed | 198 |
| Failed | 0 |
| Blocked (safety) | 332 |
| Blocked (credentials/DB) | 0 |
| Blocked (provider) | 0 |
| Pass % | 37.4% |

## Count reconciliation

Runtime catalog has 530 tools; baseline 518 reflects chatgpt-app-submission.json (530 entries). Delta: none.

## Failures by root cause


## Per-tool results

| # | Tool | Module | Risk | Test performed | Result | Duration | Evidence ID | Root cause | Repair | Retest |
| - | ---- | ------ | ---- | -------------- | ------ | -------: | ----------- | ---------- | ------ | ------ |
| 1 | accept_document | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-3f0c2a3659bf | write_tool_blocked_by_audit_policy |  | pending |
| 2 | accounting_snapshot | integrations | low | static_contract_registry_parity | PASS | 0 | ev-ee395dd6ea39 |  |  | pending |
| 3 | activate_skill_for_session | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-7fdfc9208ae8 | write_tool_blocked_by_audit_policy |  | pending |
| 4 | add_note | contacts | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-98aba73d41fb | write_tool_blocked_by_audit_policy |  | pending |
| 5 | add_task_dependency | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-63e3fc85020e | write_tool_blocked_by_audit_policy |  | pending |
| 6 | ai_business_readiness_score | health | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-0b33278bcfdf | write_tool_blocked_by_audit_policy |  | pending |
| 7 | AI_usage_report | reporting | low | static_contract_registry_parity | PASS | 0 | ev-255503246012 |  |  | pending |
| 8 | amend_document | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-673becb1efff | write_tool_blocked_by_audit_policy |  | pending |
| 9 | analytics | reporting | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-78f1ea36a3fe | write_tool_blocked_by_audit_policy |  | pending |
| 10 | analyze_document | documents | low | static_contract_registry_parity | PASS | 0 | ev-0b156c312f7d |  |  | pending |
| 11 | analyze_document_intelligence | documents | low | static_contract_registry_parity | PASS | 0 | ev-c147d9e8b2e9 |  |  | pending |
| 12 | analyze_workspace_document_url | documents | low | static_contract_registry_parity | PASS | 0 | ev-ac1b69127dab |  |  | pending |
| 13 | appointments | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-42808e8d4651 | write_tool_blocked_by_audit_policy |  | pending |
| 14 | approve_document | approvals | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-a8a926b575a2 | write_tool_requires_approval_and_--execute-write |  | pending |
| 15 | approve_dream_update | approvals | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e8dd56734346 | write_tool_requires_approval_and_--execute-write |  | pending |
| 16 | approve_pending_action | approvals | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-2dd679cead71 | write_tool_requires_approval_and_--execute-write |  | pending |
| 17 | approve_workflow_step | approvals | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-7a3e1f3eca0c | write_tool_requires_approval_and_--execute-write |  | pending |
| 18 | archive_document | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-94bef1ba2ecd | write_tool_blocked_by_audit_policy |  | pending |
| 19 | ask_bonnie_operations | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-0ef8f724ed00 | write_tool_blocked_by_audit_policy |  | pending |
| 20 | audit_platform | admin | low | static_contract_registry_parity | PASS | 0 | ev-4edcfb863989 |  |  | pending |
| 21 | auto_create_lead_from_message | leads | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-ec7c680ca6bd | write_tool_blocked_by_audit_policy |  | pending |
| 22 | automate_expense_entry | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-01531b0ae7d7 | write_tool_blocked_by_audit_policy |  | pending |
| 23 | autonomous_reply | email | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-d673a53cb5b9 | write_tool_blocked_by_audit_policy |  | pending |
| 24 | award_points | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-619195005242 | write_tool_blocked_by_audit_policy |  | pending |
| 25 | backfill_contact_phone_country_codes | contacts | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-08097da5e629 | write_tool_blocked_by_audit_policy |  | pending |
| 26 | book_calendar_meeting | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-4a761a601a0a | write_tool_blocked_by_audit_policy |  | pending |
| 27 | bulk_add_to_segment | workspace | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-120ae8eb5c2a | write_tool_requires_approval_and_--execute-write |  | pending |
| 28 | bulk_archive_leads | leads | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-a56782697227 | write_tool_requires_approval_and_--execute-write |  | pending |
| 29 | bulk_assign_campaign | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-7cbdfe442ec4 | write_tool_requires_approval_and_--execute-write |  | pending |
| 30 | bulk_create_leads | leads | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-499a4be765af | write_tool_requires_approval_and_--execute-write |  | pending |
| 31 | bulk_update_leads | leads | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-0001b47b1632 | write_tool_requires_approval_and_--execute-write |  | pending |
| 32 | bulk_update_records | workspace | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-f27570851685 | write_tool_requires_approval_and_--execute-write |  | pending |
| 33 | bulk_upload_media | media | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-26d472b4c257 | write_tool_requires_approval_and_--execute-write |  | pending |
| 34 | bulk_upsert_contacts | contacts | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-921445c9146c | write_tool_requires_approval_and_--execute-write |  | pending |
| 35 | business_memory_graph | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-ca5be32defe9 | write_tool_blocked_by_audit_policy |  | pending |
| 36 | calcom_health | health | low | static_contract_registry_parity | PASS | 0 | ev-c2ff334eaa18 |  |  | pending |
| 37 | calendly_health | health | low | static_contract_registry_parity | PASS | 0 | ev-f9d6dce605a3 |  |  | pending |
| 38 | campaign_brief | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-a5099780b439 | write_tool_requires_approval_and_--execute-write |  | pending |
| 39 | campaign_diagnose | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1014d239ad03 | write_tool_requires_approval_and_--execute-write |  | pending |
| 40 | campaign_metrics | reporting | high | static_contract_registry_parity | PASS | 0 | ev-22feed2be989 |  |  | pending |
| 41 | campaigns | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-10a7da5567e7 | write_tool_requires_approval_and_--execute-write |  | pending |
| 42 | cancel_meeting | calendar | critical | static_contract_destructive_blocked | BLOCKED_BY_SAFETY | 0 | ev-a356a745bc91 | destructive_tool_requires_--execute-write_in_staging |  | pending |
| 43 | cancel_run | workspace | critical | static_contract_destructive_blocked | BLOCKED_BY_SAFETY | 0 | ev-5237b4f7ebc2 | destructive_tool_requires_--execute-write_in_staging |  | pending |
| 44 | capture_linkedin_comment_leads | leads | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-7dc7faa40e3d | write_tool_blocked_by_audit_policy |  | pending |
| 45 | change_pipeline_stage | crm | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-ca0ab05ac824 | write_tool_blocked_by_audit_policy |  | pending |
| 46 | chase_contract_signature | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-50f8641a3c7f | write_tool_blocked_by_audit_policy |  | pending |
| 47 | check_mcp_execution_readiness | health | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-c0b41116a06a | write_tool_blocked_by_audit_policy |  | pending |
| 48 | classify_outreach_reply | email | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-487b9b0ab315 | write_tool_blocked_by_audit_policy |  | pending |
| 49 | client_pulse | contacts | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-5b74e074ff24 | write_tool_blocked_by_audit_policy |  | pending |
| 50 | compare_contract_versions | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-0f2f35d2d32f | write_tool_blocked_by_audit_policy |  | pending |
| 51 | compare_document_versions | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-be851dd97ff9 | write_tool_blocked_by_audit_policy |  | pending |
| 52 | compare_versions | health | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-8c50628683e8 | write_tool_blocked_by_audit_policy |  | pending |
| 53 | connected_accounts | integrations | low | static_contract_registry_parity | PASS | 0 | ev-03e45aee2173 |  |  | pending |
| 54 | conversions | health | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-6577bc00478b | write_tool_blocked_by_audit_policy |  | pending |
| 55 | convert_quote_to_invoice | invoices | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-a9388a769294 | write_tool_requires_approval_and_--execute-write |  | pending |
| 56 | create_bank_account | integrations | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-cab037fdc167 | write_tool_blocked_by_audit_policy |  | pending |
| 57 | create_bulk_email_batch | email | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-dd3fe9e92e1a | write_tool_requires_approval_and_--execute-write |  | pending |
| 58 | create_bulk_email_campaign | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-7986644840ac | write_tool_requires_approval_and_--execute-write |  | pending |
| 59 | create_business_event | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e10a7d822fdf | write_tool_blocked_by_audit_policy |  | pending |
| 60 | create_client | contacts | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-a82c10a2849f | write_tool_blocked_by_audit_policy |  | pending |
| 61 | create_client_portal_event | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1aca72ed3b99 | write_tool_blocked_by_audit_policy |  | pending |
| 62 | create_contact | contacts | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-3d2f68bb7e7c | write_tool_blocked_by_audit_policy |  | pending |
| 63 | create_contract | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-86fcf6cbafc0 | write_tool_blocked_by_audit_policy |  | pending |
| 64 | create_contract_template | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-f844f9ca46ec | write_tool_blocked_by_audit_policy |  | pending |
| 65 | create_contract_version | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-97b6487a760d | write_tool_blocked_by_audit_policy |  | pending |
| 66 | create_deal | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e11b249ee263 | write_tool_blocked_by_audit_policy |  | pending |
| 67 | create_document | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-a454d597313a | write_tool_blocked_by_audit_policy |  | pending |
| 68 | create_document_version | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-6aed33f8aef7 | write_tool_blocked_by_audit_policy |  | pending |
| 69 | create_email_draft | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-ebfb6e95e313 | write_tool_blocked_by_audit_policy |  | pending |
| 70 | create_email_sequence | email | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e31e2fd89f56 | write_tool_blocked_by_audit_policy |  | pending |
| 71 | create_expense | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e191a8298993 | write_tool_blocked_by_audit_policy |  | pending |
| 72 | create_follow_up | contacts | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-22a3145707d4 | write_tool_blocked_by_audit_policy |  | pending |
| 73 | create_in_app_notification | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-015750638878 | write_tool_blocked_by_audit_policy |  | pending |
| 74 | create_invoice | invoices | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-3198e68c6bdb | write_tool_requires_approval_and_--execute-write |  | pending |
| 75 | create_invoice_collection_mission | invoices | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b370baac566b | write_tool_requires_approval_and_--execute-write |  | pending |
| 76 | create_journal_entry | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-cb1ec9e26033 | write_tool_blocked_by_audit_policy |  | pending |
| 77 | create_lead | leads | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-bfb0e93ca28b | write_tool_blocked_by_audit_policy |  | pending |
| 78 | create_leads | leads | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1f8550207e54 | write_tool_blocked_by_audit_policy |  | pending |
| 79 | create_linkedin_comment | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-26a86784995c | write_tool_blocked_by_audit_policy |  | pending |
| 80 | create_linkedin_event | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-a22460d9565b | write_tool_blocked_by_audit_policy |  | pending |
| 81 | create_linkedin_post | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-fac5ae9a0173 | write_tool_blocked_by_audit_policy |  | pending |
| 82 | create_linkedin_reaction | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-170f36f0becc | write_tool_blocked_by_audit_policy |  | pending |
| 83 | create_meeting | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-7c46bb630940 | write_tool_blocked_by_audit_policy |  | pending |
| 84 | create_post | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-cc6c441fd1f4 | write_tool_blocked_by_audit_policy |  | pending |
| 85 | create_post_with_ai_image | media | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1f7b8a415432 | write_tool_blocked_by_audit_policy |  | pending |
| 86 | create_project | projects | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-9d9523575aba | write_tool_blocked_by_audit_policy |  | pending |
| 87 | create_project_task | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-6d3f26e55de0 | write_tool_blocked_by_audit_policy |  | pending |
| 88 | create_quote | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-4f970761a61e | write_tool_blocked_by_audit_policy |  | pending |
| 89 | create_reconciliation_session | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-4cac6e42a7de | write_tool_blocked_by_audit_policy |  | pending |
| 90 | create_social_post | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-5674c5b09f5a | write_tool_blocked_by_audit_policy |  | pending |
| 91 | create_social_post_with_ai_image | media | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-c4ed7412c766 | write_tool_blocked_by_audit_policy |  | pending |
| 92 | create_social_post_with_media | media | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b840d63c8a01 | write_tool_blocked_by_audit_policy |  | pending |
| 93 | create_subscription_checkout | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-d3e8061bbab1 | write_tool_blocked_by_audit_policy |  | pending |
| 94 | create_task | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-8b8ea6af390a | write_tool_blocked_by_audit_policy |  | pending |
| 95 | create_tasks_batch | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-c01397bc5159 | write_tool_blocked_by_audit_policy |  | pending |
| 96 | create_ticket | support | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-82effad37f1e | write_tool_blocked_by_audit_policy |  | pending |
| 97 | create_vendor_bill | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-6d60b7385889 | write_tool_blocked_by_audit_policy |  | pending |
| 98 | customer_report | reporting | low | static_contract_registry_parity | PASS | 0 | ev-13b2ca226c8d |  |  | pending |
| 99 | dashboard_metrics | reporting | low | static_contract_registry_parity | PASS | 0 | ev-4b14f388042f |  |  | pending |
| 100 | deal_to_cash_flow | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-6f7a45e558b1 | write_tool_blocked_by_audit_policy |  | pending |
| 101 | decline_document | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-817d0f92c424 | write_tool_blocked_by_audit_policy |  | pending |
| 102 | deepseek_health | health | low | static_contract_registry_parity | PASS | 0 | ev-553579719d03 |  |  | pending |
| 103 | define_outcome | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-dd74d91422d4 | write_tool_blocked_by_audit_policy |  | pending |
| 104 | delete_contact | contacts | critical | static_contract_destructive_blocked | BLOCKED_BY_SAFETY | 0 | ev-ff2836cdda95 | destructive_tool_requires_--execute-write_in_staging |  | pending |
| 105 | delete_facebook_post | social | critical | static_contract_destructive_blocked | BLOCKED_BY_SAFETY | 0 | ev-1144d73d9497 | destructive_tool_requires_--execute-write_in_staging |  | pending |
| 106 | delete_lead | leads | critical | static_contract_destructive_blocked | BLOCKED_BY_SAFETY | 0 | ev-a2abc82d5b8e | destructive_tool_requires_--execute-write_in_staging |  | pending |
| 107 | delete_media | media | critical | static_contract_destructive_blocked | BLOCKED_BY_SAFETY | 0 | ev-c73cc128a4ba | destructive_tool_requires_--execute-write_in_staging |  | pending |
| 108 | delete_media_asset | media | critical | static_contract_destructive_blocked | BLOCKED_BY_SAFETY | 0 | ev-5a2cb314931c | destructive_tool_requires_--execute-write_in_staging |  | pending |
| 109 | delete_post | social | critical | static_contract_destructive_blocked | BLOCKED_BY_SAFETY | 0 | ev-1590e6568373 | destructive_tool_requires_--execute-write_in_staging |  | pending |
| 110 | delete_social_post | social | critical | static_contract_destructive_blocked | BLOCKED_BY_SAFETY | 0 | ev-b0896ab8a327 | destructive_tool_requires_--execute-write_in_staging |  | pending |
| 111 | disable_whatsapp_chatbot | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b68d0b9acd98 | write_tool_blocked_by_audit_policy |  | pending |
| 112 | dispatch_tool | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-dbf7265b4cae | write_tool_blocked_by_audit_policy |  | pending |
| 113 | document_qa | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e355bf873d7b | write_tool_blocked_by_audit_policy |  | pending |
| 114 | document_url_qa | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-ebe837623a35 | write_tool_blocked_by_audit_policy |  | pending |
| 115 | document_versions | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-ef2265038196 | write_tool_blocked_by_audit_policy |  | pending |
| 116 | draft_reply | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-3e45d5514858 | write_tool_blocked_by_audit_policy |  | pending |
| 117 | drafts | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1f9d4a5f74d6 | write_tool_blocked_by_audit_policy |  | pending |
| 118 | email_campaigns | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-789ed4484122 | write_tool_requires_approval_and_--execute-write |  | pending |
| 119 | enable_lead_auto_outreach | leads | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-9e56e0dd2ce4 | write_tool_blocked_by_audit_policy |  | pending |
| 120 | enable_whatsapp_chatbot | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b6a7e4979cab | write_tool_blocked_by_audit_policy |  | pending |
| 121 | engagement_report | reporting | low | static_contract_registry_parity | PASS | 0 | ev-6849ba7c6b9f |  |  | pending |
| 122 | enroll_contact_in_sequence | contacts | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b8aa35b1590f | write_tool_blocked_by_audit_policy |  | pending |
| 123 | escalate_ticket | support | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-a9e358ef4073 | write_tool_blocked_by_audit_policy |  | pending |
| 124 | evaluate_business_ai_readiness | health | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-5590aabc5db6 | write_tool_blocked_by_audit_policy |  | pending |
| 125 | events | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-edfbb28285fa | write_tool_blocked_by_audit_policy |  | pending |
| 126 | execute_action | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-039c0d9bc75b | write_tool_blocked_by_audit_policy |  | pending |
| 127 | execute_internal_tool | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-cf7781d76450 | write_tool_blocked_by_audit_policy |  | pending |
| 128 | execute_strategic_intelligence | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-c783f0b6d033 | write_tool_blocked_by_audit_policy |  | pending |
| 129 | export_document_record | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-de0c94216f8c | write_tool_blocked_by_audit_policy |  | pending |
| 130 | export_to_google_workspace | integrations | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b1e68a3b0ead | write_tool_blocked_by_audit_policy |  | pending |
| 131 | fetch | search | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-90061c2f3fb1 | write_tool_blocked_by_audit_policy |  | pending |
| 132 | find_and_qualify_leads | leads | low | static_contract_registry_parity | PASS | 0 | ev-5d1f144341b0 |  |  | pending |
| 133 | funnels | marketing | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-260c06de2e60 | write_tool_blocked_by_audit_policy |  | pending |
| 134 | generate_ai_image | media | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-94c91bd79f93 | write_tool_blocked_by_audit_policy |  | pending |
| 135 | generate_business_report | reporting | low | static_contract_registry_parity | PASS | 0 | ev-6c0b284edaad |  |  | pending |
| 136 | generate_contract_draft | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-9674044f49d5 | write_tool_blocked_by_audit_policy |  | pending |
| 137 | generate_contract_signing_token | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-729d5745a4ca | write_tool_blocked_by_audit_policy |  | pending |
| 138 | generate_expense_report | reporting | low | static_contract_registry_parity | PASS | 0 | ev-9279c03fc3cf |  |  | pending |
| 139 | generate_grok_video | media | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-3bc98426f9a9 | write_tool_blocked_by_audit_policy |  | pending |
| 140 | generate_image | media | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-9793d688906a | write_tool_blocked_by_audit_policy |  | pending |
| 141 | generate_market_authority_report | reporting | low | static_contract_registry_parity | PASS | 0 | ev-e88a148f5ba3 |  |  | pending |
| 142 | generate_outreach_draft | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e5ee606c1834 | write_tool_blocked_by_audit_policy |  | pending |
| 143 | generate_viral_video_script | media | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-86b8ea34a2aa | write_tool_blocked_by_audit_policy |  | pending |
| 144 | get_account_overview | integrations | low | static_contract_registry_parity | PASS | 0 | ev-34308a1d56fa |  |  | pending |
| 145 | get_accounts_payable_aging | integrations | low | static_contract_registry_parity | PASS | 0 | ev-bbcda8dcac94 |  |  | pending |
| 146 | get_accounts_receivable_aging | integrations | low | static_contract_registry_parity | PASS | 0 | ev-57fb36573edf |  |  | pending |
| 147 | get_action_status | health | low | static_contract_registry_parity | PASS | 0 | ev-122b658718d0 |  |  | pending |
| 148 | get_agentic_os_status | health | low | static_contract_registry_parity | PASS | 0 | ev-6fe87f7202b2 |  |  | pending |
| 149 | get_api_health | health | low | static_contract_registry_parity | PASS | 0 | ev-99e3850b8c42 |  |  | pending |
| 150 | get_audit_logs | admin | low | static_contract_registry_parity | PASS | 0 | ev-7d0e5803445f |  |  | pending |
| 151 | get_automation_health | workflows | low | static_contract_registry_parity | PASS | 0 | ev-5d9149fb9f36 |  |  | pending |
| 152 | get_balance_sheet | workspace | low | static_contract_registry_parity | PASS | 0 | ev-dfa4a1b2a682 |  |  | pending |
| 153 | get_bank_accounts | integrations | low | static_contract_registry_parity | PASS | 0 | ev-e123560b7f9a |  |  | pending |
| 154 | get_batch_job_status | health | low | static_contract_registry_parity | PASS | 0 | ev-1e61ccac624a |  |  | pending |
| 155 | get_business_ai_state | bonnie | low | static_contract_registry_parity | PASS | 0 | ev-3d8d55911034 |  |  | pending |
| 156 | get_business_digital_twin | bonnie | low | static_contract_registry_parity | PASS | 0 | ev-742df4e124c4 |  |  | pending |
| 157 | get_business_events | calendar | low | static_contract_registry_parity | PASS | 0 | ev-0c564f4844f4 |  |  | pending |
| 158 | get_business_health_summary | health | low | static_contract_registry_parity | PASS | 0 | ev-43bf597ff710 |  |  | pending |
| 159 | get_business_snapshot | workspace | low | static_contract_registry_parity | PASS | 0 | ev-8f8ae2168606 |  |  | pending |
| 160 | get_calendly_status | health | low | static_contract_registry_parity | PASS | 0 | ev-68019cd99469 |  |  | pending |
| 161 | get_cash_flow_statement | workspace | low | static_contract_registry_parity | PASS | 0 | ev-f37e6f232500 |  |  | pending |
| 162 | get_chatbot_conversations | workspace | low | static_contract_registry_parity | PASS | 0 | ev-d6175573fa57 |  |  | pending |
| 163 | get_chatbot_performance | workspace | low | static_contract_registry_parity | PASS | 0 | ev-cf7a4d7424b9 |  |  | pending |
| 164 | get_chatbot_persona | workspace | low | static_contract_registry_parity | PASS | 0 | ev-7eb4d18853c9 |  |  | pending |
| 165 | get_client_by_id | contacts | low | static_contract_registry_parity | PASS | 0 | ev-81e295349929 |  |  | pending |
| 166 | get_client_email_history | contacts | medium | static_contract_registry_parity | PASS | 0 | ev-d2d75dc3e037 |  |  | pending |
| 167 | get_client_history | contacts | low | static_contract_registry_parity | PASS | 0 | ev-074e8ebe565b |  |  | pending |
| 168 | get_clients | contacts | low | static_contract_registry_parity | PASS | 0 | ev-9e8082b54448 |  |  | pending |
| 169 | get_contact_activity | contacts | low | static_contract_registry_parity | PASS | 0 | ev-c15c1274b03a |  |  | pending |
| 170 | get_contacts | contacts | low | static_contract_registry_parity | PASS | 0 | ev-798c935394e8 |  |  | pending |
| 171 | get_contract_approvals | approvals | low | static_contract_registry_parity | PASS | 0 | ev-95afd15fb053 |  |  | pending |
| 172 | get_contract_templates | documents | low | static_contract_registry_parity | PASS | 0 | ev-c12b2b94482e |  |  | pending |
| 173 | get_contract_versions | documents | low | static_contract_registry_parity | PASS | 0 | ev-bb8765c82749 |  |  | pending |
| 174 | get_contracts | documents | low | static_contract_registry_parity | PASS | 0 | ev-e4cd2238d6f1 |  |  | pending |
| 175 | get_conversation | workspace | low | static_contract_registry_parity | PASS | 0 | ev-664868ea86c2 |  |  | pending |
| 176 | get_current_user | workspace | low | static_contract_registry_parity | PASS | 0 | ev-0a9a9d783490 |  |  | pending |
| 177 | get_dashboard_stats | reporting | low | static_contract_registry_parity | PASS | 0 | ev-2ace912ba3b9 |  |  | pending |
| 178 | get_deals | revenue | low | static_contract_registry_parity | PASS | 0 | ev-6c93eca66c20 |  |  | pending |
| 179 | get_delivery_status | health | low | static_contract_registry_parity | PASS | 0 | ev-dbb2026e35ee |  |  | pending |
| 180 | get_document | documents | low | static_contract_registry_parity | PASS | 0 | ev-3cc3ed5eb40c |  |  | pending |
| 181 | get_document_timeline | documents | low | static_contract_registry_parity | PASS | 0 | ev-0eb8ca2bf240 |  |  | pending |
| 182 | get_documents | documents | low | static_contract_registry_parity | PASS | 0 | ev-32375bd4d17e |  |  | pending |
| 183 | get_dream_sessions | bonnie | low | static_contract_registry_parity | PASS | 0 | ev-92bc21a23eea |  |  | pending |
| 184 | get_email_campaign_delivery_status | health | high | static_contract_registry_parity | PASS | 0 | ev-edcb7874196e |  |  | pending |
| 185 | get_email_campaign_stats | social | high | static_contract_registry_parity | PASS | 0 | ev-acc02a450d36 |  |  | pending |
| 186 | get_environment | health | low | static_contract_registry_parity | PASS | 0 | ev-c6c3474a465b |  |  | pending |
| 187 | get_execution_assurance_report | reporting | low | static_contract_registry_parity | PASS | 0 | ev-255ba39e4ef6 |  |  | pending |
| 188 | get_expenses | workspace | low | static_contract_registry_parity | PASS | 0 | ev-7a9b119f1e54 |  |  | pending |
| 189 | get_facebook_identities | social | low | static_contract_registry_parity | PASS | 0 | ev-34b9a4e57721 |  |  | pending |
| 190 | get_facebook_page_capabilities | search | low | static_contract_registry_parity | PASS | 0 | ev-1304e27edea6 |  |  | pending |
| 191 | get_facebook_post_insights | social | low | static_contract_registry_parity | PASS | 0 | ev-8b010bf9997c |  |  | pending |
| 192 | get_facebook_token | social | low | static_contract_registry_parity | PASS | 0 | ev-7967a8609a5e |  |  | pending |
| 193 | get_failure_report | reporting | low | static_contract_registry_parity | PASS | 0 | ev-7af88c4d65e8 |  |  | pending |
| 194 | get_feature_flags | health | low | static_contract_registry_parity | PASS | 0 | ev-a26c8051dc0d |  |  | pending |
| 195 | get_file_download_url | documents | low | static_contract_registry_parity | PASS | 0 | ev-7054e9ce0591 |  |  | pending |
| 196 | get_finance_snapshot | finance | low | static_contract_registry_parity | PASS | 0 | ev-02f66571cc45 |  |  | pending |
| 197 | get_gamification_leaderboard | leads | low | static_contract_registry_parity | PASS | 0 | ev-0117ad1519b2 |  |  | pending |
| 198 | get_inventory_items | finance | low | static_contract_registry_parity | PASS | 0 | ev-d676db508d04 |  |  | pending |
| 199 | get_invoice_line_items | invoices | high | static_contract_registry_parity | PASS | 0 | ev-90b20a1a403b |  |  | pending |
| 200 | get_invoices | invoices | high | static_contract_registry_parity | PASS | 0 | ev-d576c522effe |  |  | pending |
| 201 | get_leads | leads | low | static_contract_registry_parity | PASS | 0 | ev-5b271f98a50e |  |  | pending |
| 202 | get_linkedin_ad_accounts | integrations | low | static_contract_registry_parity | PASS | 0 | ev-898f684cd2a4 |  |  | pending |
| 203 | get_linkedin_ad_campaigns | social | high | static_contract_registry_parity | PASS | 0 | ev-68fc1fb17146 |  |  | pending |
| 204 | get_linkedin_identities | social | low | static_contract_registry_parity | PASS | 0 | ev-c93fc816559c |  |  | pending |
| 205 | get_linkedin_member_profile | documents | low | static_contract_registry_parity | PASS | 0 | ev-6b25db1aee13 |  |  | pending |
| 206 | get_linkedin_post_stats | social | low | static_contract_registry_parity | PASS | 0 | ev-3ff69bb769c9 |  |  | pending |
| 207 | get_linkedin_posts | social | low | static_contract_registry_parity | PASS | 0 | ev-fb19a326c78d |  |  | pending |
| 208 | get_media | media | low | static_contract_registry_parity | PASS | 0 | ev-f7e369009d95 |  |  | pending |
| 209 | get_media_asset | media | low | static_contract_registry_parity | PASS | 0 | ev-5fde22b614b5 |  |  | pending |
| 210 | get_meetings | calendar | low | static_contract_registry_parity | PASS | 0 | ev-51bc78dd5dd3 |  |  | pending |
| 211 | get_momentum_score | workspace | low | static_contract_registry_parity | PASS | 0 | ev-4c0c010f60a7 |  |  | pending |
| 212 | get_nexus_memory | bonnie | low | static_contract_registry_parity | PASS | 0 | ev-1aa525e93e6d |  |  | pending |
| 213 | get_orchestration_history | workflows | low | static_contract_registry_parity | PASS | 0 | ev-45aea7ffd48b |  |  | pending |
| 214 | get_outcome_status | health | low | static_contract_registry_parity | PASS | 0 | ev-7de0e1cd370f |  |  | pending |
| 215 | get_pipeline_summary | crm | low | static_contract_registry_parity | PASS | 0 | ev-4fcf7e526cb3 |  |  | pending |
| 216 | get_platform_status | health | low | static_contract_registry_parity | PASS | 0 | ev-dd9c4e1145d6 |  |  | pending |
| 217 | get_pnl_statement | workspace | low | static_contract_registry_parity | PASS | 0 | ev-6879d04c7631 |  |  | pending |
| 218 | get_post_analytics | reporting | low | static_contract_registry_parity | PASS | 0 | ev-ca8ed194fab9 |  |  | pending |
| 219 | get_post_status | health | low | static_contract_registry_parity | PASS | 0 | ev-1dc142e1cf7e |  |  | pending |
| 220 | get_project_details | projects | low | static_contract_registry_parity | PASS | 0 | ev-1b10c5a2b5d4 |  |  | pending |
| 221 | get_project_milestones | projects | low | static_contract_registry_parity | PASS | 0 | ev-21eac8bdb6f2 |  |  | pending |
| 222 | get_project_summary | projects | low | static_contract_registry_parity | PASS | 0 | ev-f0b97b897c74 |  |  | pending |
| 223 | get_project_tasks | tasks | low | static_contract_registry_parity | PASS | 0 | ev-1217ee078796 |  |  | pending |
| 224 | get_project_timeline | projects | low | static_contract_registry_parity | PASS | 0 | ev-9d50c20065e2 |  |  | pending |
| 225 | get_projects | projects | low | static_contract_registry_parity | PASS | 0 | ev-754ca6a4ac70 |  |  | pending |
| 226 | get_quotes | revenue | low | static_contract_registry_parity | PASS | 0 | ev-f2dd0fffe71d |  |  | pending |
| 227 | get_recent_errors | health | low | static_contract_registry_parity | PASS | 0 | ev-bee06a109554 |  |  | pending |
| 228 | get_recent_messages | email | low | static_contract_registry_parity | PASS | 0 | ev-5df28dfac81d |  |  | pending |
| 229 | get_reconciliation_sessions | workspace | low | static_contract_registry_parity | PASS | 0 | ev-bd6dd63ee9ad |  |  | pending |
| 230 | get_revenue_summary | revenue | low | static_contract_registry_parity | PASS | 0 | ev-322c624b4ad9 |  |  | pending |
| 231 | get_run_status | health | low | static_contract_registry_parity | PASS | 0 | ev-e03ced484135 |  |  | pending |
| 232 | get_scheduled_posts | social | low | static_contract_registry_parity | PASS | 0 | ev-93ae0f190bab |  |  | pending |
| 233 | get_scraper_leads | leads | low | static_contract_registry_parity | PASS | 0 | ev-a8be8c61982b |  |  | pending |
| 234 | get_sequence_stats | marketing | low | static_contract_registry_parity | PASS | 0 | ev-f4362dad5e9e |  |  | pending |
| 235 | get_signature_status | health | low | static_contract_registry_parity | PASS | 0 | ev-cf7f0f439eea |  |  | pending |
| 236 | get_social_accounts | integrations | medium | static_contract_registry_parity | PASS | 0 | ev-39072b17810f |  |  | pending |
| 237 | get_social_identities | social | medium | static_contract_registry_parity | PASS | 0 | ev-282a5dddbeb1 |  |  | pending |
| 238 | get_social_post | social | medium | static_contract_registry_parity | PASS | 0 | ev-0686f54ff242 |  |  | pending |
| 239 | get_social_post_insights | social | medium | static_contract_registry_parity | PASS | 0 | ev-36f48eba913a |  |  | pending |
| 240 | get_social_posts | social | medium | static_contract_registry_parity | PASS | 0 | ev-f2c6b10e333d |  |  | pending |
| 241 | get_strategic_plan | workspace | low | static_contract_registry_parity | PASS | 0 | ev-fc89675d7790 |  |  | pending |
| 242 | get_system_health | health | low | static_contract_registry_parity | PASS | 0 | ev-12233a40d771 |  |  | pending |
| 243 | get_tasks | tasks | low | static_contract_registry_parity | PASS | 0 | ev-57d15d9b0c7c |  |  | pending |
| 244 | get_tenant_messages | email | low | static_contract_registry_parity | PASS | 0 | ev-0191811c04a0 |  |  | pending |
| 245 | get_throughput_report | reporting | low | static_contract_registry_parity | PASS | 0 | ev-93a4f1b4e52f |  |  | pending |
| 246 | get_ticket_stats | support | low | static_contract_registry_parity | PASS | 0 | ev-5752d4c7f7ef |  |  | pending |
| 247 | get_tickets | support | low | static_contract_registry_parity | PASS | 0 | ev-66a46b10af1e |  |  | pending |
| 248 | get_today_operational_hud | workspace | low | static_contract_registry_parity | PASS | 0 | ev-077a959f7eb1 |  |  | pending |
| 249 | get_user_points | workspace | low | static_contract_registry_parity | PASS | 0 | ev-ee7b538a597c |  |  | pending |
| 250 | get_vendor_bills | workspace | low | static_contract_registry_parity | PASS | 0 | ev-ab68e0f221ab |  |  | pending |
| 251 | get_version | health | low | static_contract_registry_parity | PASS | 0 | ev-fd3937954b8b |  |  | pending |
| 252 | get_whatsapp_status | health | medium | static_contract_registry_parity | PASS | 0 | ev-a3d962653007 |  |  | pending |
| 253 | get_workflow | workflows | low | static_contract_registry_parity | PASS | 0 | ev-70e33bebce19 |  |  | pending |
| 254 | get_workflow_run | workflows | low | static_contract_registry_parity | PASS | 0 | ev-edfe3ef7529b |  |  | pending |
| 255 | get_workspace_widgets | workspace | low | static_contract_registry_parity | PASS | 0 | ev-26edd41e911b |  |  | pending |
| 256 | get_x_profile | documents | low | static_contract_registry_parity | PASS | 0 | ev-0d29c5eda692 |  |  | pending |
| 257 | get_x_timeline | social | low | static_contract_registry_parity | PASS | 0 | ev-4ed2401a83b0 |  |  | pending |
| 258 | get_zoho_mail_messages | integrations | medium | static_contract_registry_parity | PASS | 0 | ev-9506dafdbf9d |  |  | pending |
| 259 | get_zoho_mail_thread | integrations | medium | static_contract_registry_parity | PASS | 0 | ev-e077a010d706 |  |  | pending |
| 260 | github_health | health | low | static_contract_registry_parity | PASS | 0 | ev-d456935983b7 |  |  | pending |
| 261 | gmail_get_thread | integrations | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-f5d4eb05e67a | write_tool_blocked_by_audit_policy |  | pending |
| 262 | gmail_health | health | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-d163c707808b | write_tool_blocked_by_audit_policy |  | pending |
| 263 | gmail_list_threads | integrations | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-aec6743c4328 | write_tool_blocked_by_audit_policy |  | pending |
| 264 | gmail_send_email | integrations | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-6504ba5ac697 | write_tool_requires_approval_and_--execute-write |  | pending |
| 265 | google_calendar_health | calendar | low | static_contract_registry_parity | PASS | 0 | ev-31eb4a7394af |  |  | pending |
| 266 | growth_report | reporting | low | static_contract_registry_parity | PASS | 0 | ev-ebc97b9b2c5c |  |  | pending |
| 267 | ingest_document | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-5fa2885b8c4b | write_tool_blocked_by_audit_policy |  | pending |
| 268 | inspect_agent_reasoning | search | low | static_contract_registry_parity | PASS | 0 | ev-74471e3acf3f |  |  | pending |
| 269 | inspect_embeddings | search | low | static_contract_registry_parity | PASS | 0 | ev-afa139066ba3 |  |  | pending |
| 270 | inspect_executor | search | low | static_contract_registry_parity | PASS | 0 | ev-699bd065d04a |  |  | pending |
| 271 | inspect_memory | search | low | static_contract_registry_parity | PASS | 0 | ev-6c5b6a77ad28 |  |  | pending |
| 272 | inspect_planner | search | low | static_contract_registry_parity | PASS | 0 | ev-956d1126b4d1 |  |  | pending |
| 273 | inspect_prompts | search | low | static_contract_registry_parity | PASS | 0 | ev-4c4639c0f32e |  |  | pending |
| 274 | inspect_rag | search | low | static_contract_registry_parity | PASS | 0 | ev-7e717c7281a5 |  |  | pending |
| 275 | inspect_scheduler | search | low | static_contract_registry_parity | PASS | 0 | ev-3490a5d3f64b |  |  | pending |
| 276 | inspect_task_queue | tasks | low | static_contract_registry_parity | PASS | 0 | ev-7b8d46597b54 |  |  | pending |
| 277 | inspect_tools | search | low | static_contract_registry_parity | PASS | 0 | ev-10e2c7b9622a |  |  | pending |
| 278 | inspect_vector_store | search | low | static_contract_registry_parity | PASS | 0 | ev-f90debdc3e70 |  |  | pending |
| 279 | integrations_status | health | low | static_contract_registry_parity | PASS | 0 | ev-72eb117d1ec8 |  |  | pending |
| 280 | invoices | invoices | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-fe9ab078a1cc | write_tool_requires_approval_and_--execute-write |  | pending |
| 281 | kickoff_project_automation | workflows | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-00e1e0eeb4bd | write_tool_blocked_by_audit_policy |  | pending |
| 282 | landing_pages | marketing | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b7cfec76c99e | write_tool_blocked_by_audit_policy |  | pending |
| 283 | list_capabilities | search | low | static_contract_registry_parity | PASS | 0 | ev-d2ffd4403792 |  |  | pending |
| 284 | list_companies | companies | low | static_contract_registry_parity | PASS | 0 | ev-cd0669eddc28 |  |  | pending |
| 285 | list_contacts | contacts | low | static_contract_registry_parity | PASS | 0 | ev-9f2a6dfa8bd2 |  |  | pending |
| 286 | list_conversations | workspace | low | static_contract_registry_parity | PASS | 0 | ev-6476963d87fb |  |  | pending |
| 287 | list_department_agents | bonnie | low | static_contract_registry_parity | PASS | 0 | ev-218bb6a5ef64 |  |  | pending |
| 288 | list_document_versions | documents | low | static_contract_registry_parity | PASS | 0 | ev-8e42243088e9 |  |  | pending |
| 289 | list_email_accounts | integrations | medium | static_contract_registry_parity | PASS | 0 | ev-21fcc0c57801 |  |  | pending |
| 290 | list_event_subscriptions | revenue | low | static_contract_registry_parity | PASS | 0 | ev-cdc91dc20d02 |  |  | pending |
| 291 | list_files | documents | low | static_contract_registry_parity | PASS | 0 | ev-7cf196c489fc |  |  | pending |
| 292 | list_leads | leads | low | static_contract_registry_parity | PASS | 0 | ev-0cd8627c9edd |  |  | pending |
| 293 | list_media_assets | media | low | static_contract_registry_parity | PASS | 0 | ev-b5de9e860403 |  |  | pending |
| 294 | list_modules | workspace | low | static_contract_registry_parity | PASS | 0 | ev-c5239e579695 |  |  | pending |
| 295 | list_pending_approvals | approvals | low | static_contract_registry_parity | PASS | 0 | ev-22bdc80150a5 |  |  | pending |
| 296 | list_playbooks | workflows | low | static_contract_registry_parity | PASS | 0 | ev-b6c2342033c1 |  |  | pending |
| 297 | list_scheduled_social_posts | social | medium | static_contract_registry_parity | PASS | 0 | ev-4994cd6e2b40 |  |  | pending |
| 298 | list_skills | bonnie | low | static_contract_registry_parity | PASS | 0 | ev-f4e15cbd73b4 |  |  | pending |
| 299 | list_supported_outcomes | support | low | static_contract_registry_parity | PASS | 0 | ev-705694a31571 |  |  | pending |
| 300 | list_tools | search | low | static_contract_registry_parity | PASS | 0 | ev-eb35f1bad87b |  |  | pending |
| 301 | list_workflows | workflows | low | static_contract_registry_parity | PASS | 0 | ev-ecd9b5a4562b |  |  | pending |
| 302 | load_module_tools | search | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-921d3ab695f8 | write_tool_blocked_by_audit_policy |  | pending |
| 303 | load_skill | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-2685348c9989 | write_tool_blocked_by_audit_policy |  | pending |
| 304 | log_contact_activity | contacts | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-c48fb87a9365 | write_tool_blocked_by_audit_policy |  | pending |
| 305 | mark_invoice_paid | invoices | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-cf22dd49f21a | write_tool_requires_approval_and_--execute-write |  | pending |
| 306 | mark_message_read | email | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e546fb7c7a22 | write_tool_blocked_by_audit_policy |  | pending |
| 307 | microsoft_connection_diagnostic | integrations | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-9a24cbfef407 | write_tool_blocked_by_audit_policy |  | pending |
| 308 | microsoft_create_chat | integrations | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-30faac50b9e5 | write_tool_blocked_by_audit_policy |  | pending |
| 309 | microsoft_create_event | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-661bc5559661 | write_tool_blocked_by_audit_policy |  | pending |
| 310 | microsoft_create_meeting | integrations | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-5ab1275af2b6 | write_tool_blocked_by_audit_policy |  | pending |
| 311 | microsoft_create_task | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-c339c20e9bde | write_tool_blocked_by_audit_policy |  | pending |
| 312 | microsoft_get_calendar | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-c013b9158b05 | write_tool_blocked_by_audit_policy |  | pending |
| 313 | microsoft_get_chats | integrations | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b5936736cd20 | write_tool_blocked_by_audit_policy |  | pending |
| 314 | microsoft_get_contacts | contacts | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-f1273a62bdc7 | write_tool_blocked_by_audit_policy |  | pending |
| 315 | microsoft_get_emails | integrations | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-0a7a314caa7f | write_tool_blocked_by_audit_policy |  | pending |
| 316 | microsoft_get_joined_teams | integrations | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-91751b0d21d9 | write_tool_blocked_by_audit_policy |  | pending |
| 317 | microsoft_get_tasks | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-61d51f0367ec | write_tool_blocked_by_audit_policy |  | pending |
| 318 | microsoft_get_team_channels | integrations | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-4ee2e952af54 | write_tool_blocked_by_audit_policy |  | pending |
| 319 | microsoft_get_teams_messages | integrations | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-659530a1c512 | write_tool_blocked_by_audit_policy |  | pending |
| 320 | microsoft_send_channel_message | integrations | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-7d09c4fed725 | write_tool_requires_approval_and_--execute-write |  | pending |
| 321 | microsoft_send_chat_message | integrations | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-346894731ce8 | write_tool_requires_approval_and_--execute-write |  | pending |
| 322 | microsoft_send_email | integrations | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-cb010714b107 | write_tool_requires_approval_and_--execute-write |  | pending |
| 323 | microsoft_upload_file | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1170b1830312 | write_tool_blocked_by_audit_policy |  | pending |
| 324 | monitor_campaign_health | health | high | static_contract_registry_parity | PASS | 0 | ev-1f4aaf453779 |  |  | pending |
| 325 | move_deal_stage | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-cdbfa7258062 | write_tool_blocked_by_audit_policy |  | pending |
| 326 | negotiate_capabilities | search | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-603a3526822a | write_tool_blocked_by_audit_policy |  | pending |
| 327 | nexus_calendar_nexus | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-d39cba2140ef | write_tool_blocked_by_audit_policy |  | pending |
| 328 | nexus_content_synthesis | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-7305ccfa6635 | write_tool_blocked_by_audit_policy |  | pending |
| 329 | nexus_contract_drafter | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-724081c78175 | write_tool_blocked_by_audit_policy |  | pending |
| 330 | nexus_design_audit | admin | low | static_contract_registry_parity | PASS | 0 | ev-aa7601beca40 |  |  | pending |
| 331 | nexus_email_triage | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b27fcb80a8f1 | write_tool_blocked_by_audit_policy |  | pending |
| 332 | nexus_invoice_chasing | invoices | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-55e046b517f1 | write_tool_requires_approval_and_--execute-write |  | pending |
| 333 | nexus_lead_enrichment | leads | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-d24af83dc77e | write_tool_blocked_by_audit_policy |  | pending |
| 334 | nexus_market_pulse | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-2fee18cf4f69 | write_tool_blocked_by_audit_policy |  | pending |
| 335 | nexus_meeting_intelligence | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-81ab5526bee9 | write_tool_blocked_by_audit_policy |  | pending |
| 336 | nexus_month_end_close | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-c20b7a768fab | write_tool_blocked_by_audit_policy |  | pending |
| 337 | nexus_onboarding_flow | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-5fb977d8b7ff | write_tool_blocked_by_audit_policy |  | pending |
| 338 | nexus_payroll_sync | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1897ee3e77f4 | write_tool_blocked_by_audit_policy |  | pending |
| 339 | nexus_project_architect | projects | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-45d7ff2565bd | write_tool_blocked_by_audit_policy |  | pending |
| 340 | nexus_sales_campaign | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-cef2fe6f3d49 | write_tool_requires_approval_and_--execute-write |  | pending |
| 341 | nexus_strategic_orchestrator | workflows | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-8e1522c97d43 | write_tool_blocked_by_audit_policy |  | pending |
| 342 | nexus_support_triage | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-6bebb62932a3 | write_tool_blocked_by_audit_policy |  | pending |
| 343 | onboard_user_automation | workflows | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-846c50484da3 | write_tool_blocked_by_audit_policy |  | pending |
| 344 | openai_health | health | low | static_contract_registry_parity | PASS | 0 | ev-4f0aeab749f9 |  |  | pending |
| 345 | opportunities | finance | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-0c5a9b45842b | write_tool_blocked_by_audit_policy |  | pending |
| 346 | orchestrate_meeting_workflow | workflows | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-8d9fde6c567b | write_tool_blocked_by_audit_policy |  | pending |
| 347 | orchestrate_task | workflows | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-6cf38b800387 | write_tool_blocked_by_audit_policy |  | pending |
| 348 | owner_autopilot_queue | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-6581c9688c8b | write_tool_blocked_by_audit_policy |  | pending |
| 349 | parse_lead_criteria | leads | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-8291a2602520 | write_tool_blocked_by_audit_policy |  | pending |
| 350 | payments | payments | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-01b68227e6d4 | write_tool_requires_approval_and_--execute-write |  | pending |
| 351 | pipeline_status | health | low | static_contract_registry_parity | PASS | 0 | ev-4e1d1600d404 |  |  | pending |
| 352 | place_legal_hold | admin | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-9080924aba75 | write_tool_blocked_by_audit_policy |  | pending |
| 353 | plan_social_calendar | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-2605fc768e8e | write_tool_blocked_by_audit_policy |  | pending |
| 354 | post_x_tweet | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-57f0b3684c89 | write_tool_blocked_by_audit_policy |  | pending |
| 355 | predict_deal_win_probability | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-0e797e7a2c83 | write_tool_blocked_by_audit_policy |  | pending |
| 356 | preflight_social_publish | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-971ff4a9fdb0 | write_tool_requires_approval_and_--execute-write |  | pending |
| 357 | prepare_contract_renewal | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-dd960aebbe76 | write_tool_blocked_by_audit_policy |  | pending |
| 358 | preview_document | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e8c5597ae05c | write_tool_blocked_by_audit_policy |  | pending |
| 359 | publish_facebook_album | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-6dc9219aaa21 | write_tool_requires_approval_and_--execute-write |  | pending |
| 360 | publish_facebook_multi_photo | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-f07134be468d | write_tool_requires_approval_and_--execute-write |  | pending |
| 361 | publish_facebook_photo | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-459659c36742 | write_tool_requires_approval_and_--execute-write |  | pending |
| 362 | publish_facebook_reel | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-4004588c93e4 | write_tool_requires_approval_and_--execute-write |  | pending |
| 363 | publish_facebook_video | media | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-00ebf6e6ea8b | write_tool_requires_approval_and_--execute-write |  | pending |
| 364 | publish_instagram_carousel | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-d12eafbcf889 | write_tool_requires_approval_and_--execute-write |  | pending |
| 365 | publish_instagram_photo | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-8e7405282b48 | write_tool_requires_approval_and_--execute-write |  | pending |
| 366 | publish_instagram_reel | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-067da4fe7a24 | write_tool_requires_approval_and_--execute-write |  | pending |
| 367 | publish_linkedin_document | documents | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-05f8628b86d1 | write_tool_requires_approval_and_--execute-write |  | pending |
| 368 | publish_linkedin_image | media | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1df7921b1390 | write_tool_requires_approval_and_--execute-write |  | pending |
| 369 | publish_now | workspace | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-5a3dafe33545 | write_tool_requires_approval_and_--execute-write |  | pending |
| 370 | publish_post | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-7c096e04a6d4 | write_tool_requires_approval_and_--execute-write |  | pending |
| 371 | publish_social_post | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-9c886314f25b | write_tool_requires_approval_and_--execute-write |  | pending |
| 372 | publish_x_image | media | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-d45337bc9c32 | write_tool_requires_approval_and_--execute-write |  | pending |
| 373 | publish_x_video | media | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-38b09453a717 | write_tool_requires_approval_and_--execute-write |  | pending |
| 374 | qualify_crm_leads | leads | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-f58eb178f0e2 | write_tool_blocked_by_audit_policy |  | pending |
| 375 | queue_email_campaign_send | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-089be6a880a1 | write_tool_requires_approval_and_--execute-write |  | pending |
| 376 | quotes | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-3fe290a9e2e6 | write_tool_blocked_by_audit_policy |  | pending |
| 377 | railway_health | health | low | static_contract_registry_parity | PASS | 0 | ev-370d603db0c7 |  |  | pending |
| 378 | read_email_content | email | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-5980bf35e42e | write_tool_blocked_by_audit_policy |  | pending |
| 379 | read_emails | email | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-30bcf33384da | write_tool_blocked_by_audit_policy |  | pending |
| 380 | read_url_content | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1f17b3528fbe | write_tool_blocked_by_audit_policy |  | pending |
| 381 | recommend_next_steps | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-8367ea7c01c0 | write_tool_blocked_by_audit_policy |  | pending |
| 382 | reconcile_execution_receipts | payments | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1d78ca06dcf2 | write_tool_blocked_by_audit_policy |  | pending |
| 383 | reconcile_outreach_vs_logs | email | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-f6c8ae1979f0 | write_tool_blocked_by_audit_policy |  | pending |
| 384 | reconcile_payment | payments | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-4d9784b70dbf | write_tool_requires_approval_and_--execute-write |  | pending |
| 385 | record_document_view | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-23157fe188bf | write_tool_blocked_by_audit_policy |  | pending |
| 386 | refresh_business_digital_twin | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-7601d7cdb181 | write_tool_blocked_by_audit_policy |  | pending |
| 387 | reject_document | approvals | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-a3e28f2ba58e | write_tool_requires_approval_and_--execute-write |  | pending |
| 388 | reject_pending_action | approvals | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-32082291d0da | write_tool_requires_approval_and_--execute-write |  | pending |
| 389 | reject_workflow_step | approvals | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-63ba42b38c81 | write_tool_requires_approval_and_--execute-write |  | pending |
| 390 | release_legal_hold | admin | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e57859f7d4d9 | write_tool_blocked_by_audit_policy |  | pending |
| 391 | reminders | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-34428072d90b | write_tool_blocked_by_audit_policy |  | pending |
| 392 | render_document | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-a4dfefff5239 | write_tool_blocked_by_audit_policy |  | pending |
| 393 | reorder_widgets | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-6e309c928085 | write_tool_blocked_by_audit_policy |  | pending |
| 394 | reply_to_email | email | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-87f3ffb69971 | write_tool_blocked_by_audit_policy |  | pending |
| 395 | reply_to_x_tweet | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-27150fbd3f42 | write_tool_blocked_by_audit_policy |  | pending |
| 396 | reply_to_zoho_mail | integrations | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1b887c94d273 | write_tool_blocked_by_audit_policy |  | pending |
| 397 | request_changes | approvals | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-8bde098c25f9 | write_tool_blocked_by_audit_policy |  | pending |
| 398 | request_contract_approval | approvals | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-cae4657647ee | write_tool_blocked_by_audit_policy |  | pending |
| 399 | request_outcome | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-3a29fe804645 | write_tool_blocked_by_audit_policy |  | pending |
| 400 | restart_service | admin | critical | static_contract_destructive_blocked | BLOCKED_BY_SAFETY | 0 | ev-9868292f4cfc | destructive_tool_requires_--execute-write_in_staging |  | pending |
| 401 | restore_document | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-2bad576c119a | write_tool_blocked_by_audit_policy |  | pending |
| 402 | resume_workflow | workflows | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-5fb5cba99ac1 | write_tool_blocked_by_audit_policy |  | pending |
| 403 | retrieve_document | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-9fa5fe389799 | write_tool_blocked_by_audit_policy |  | pending |
| 404 | retry_run_step | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b417efe84922 | write_tool_blocked_by_audit_policy |  | pending |
| 405 | retry_social_post | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-d10b2cc07fd6 | write_tool_blocked_by_audit_policy |  | pending |
| 406 | revenue_dashboard | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-602f58580ff8 | write_tool_blocked_by_audit_policy |  | pending |
| 407 | revenue_recovery_agent | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-dae7350e8baa | write_tool_blocked_by_audit_policy |  | pending |
| 408 | revenue_report | revenue | low | static_contract_registry_parity | PASS | 0 | ev-5e0d73661c21 |  |  | pending |
| 409 | review_contract_approval | approvals | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-4cc53440a906 | write_tool_blocked_by_audit_policy |  | pending |
| 410 | run_autonomous_scan | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-7e1ef3324cfe | write_tool_blocked_by_audit_policy |  | pending |
| 411 | run_chief_of_staff_routine | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-9a3c23e006c3 | write_tool_blocked_by_audit_policy |  | pending |
| 412 | run_cognitive_loop | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-22da928d74ef | write_tool_blocked_by_audit_policy |  | pending |
| 413 | run_growth_lifecycle | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-a32c8688d024 | write_tool_blocked_by_audit_policy |  | pending |
| 414 | run_mcp_agent_workflow | workflows | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-5d80a3770a32 | write_tool_blocked_by_audit_policy |  | pending |
| 415 | run_playbook | workflows | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-29c562c5a901 | write_tool_blocked_by_audit_policy |  | pending |
| 416 | run_strategic_pnl_audit | admin | low | static_contract_registry_parity | PASS | 0 | ev-467486059757 |  |  | pending |
| 417 | run_workflow | workflows | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e25dc252aa14 | write_tool_blocked_by_audit_policy |  | pending |
| 418 | save_contract | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-ac2b8f0a42c0 | write_tool_blocked_by_audit_policy |  | pending |
| 419 | schedule_post | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-2017dea5e65f | write_tool_blocked_by_audit_policy |  | pending |
| 420 | schedule_social_automation | workflows | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-dcb7efad1838 | write_tool_blocked_by_audit_policy |  | pending |
| 421 | schedule_social_post | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-2f0e959a2001 | write_tool_blocked_by_audit_policy |  | pending |
| 422 | scheduled_posts | social | low | static_contract_registry_parity | PASS | 0 | ev-dae775b92532 |  |  | pending |
| 423 | score_deal | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1ac54c3de619 | write_tool_blocked_by_audit_policy |  | pending |
| 424 | search | search | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-25ac39f0eea9 | write_tool_blocked_by_audit_policy |  | pending |
| 425 | search_clients | search | low | static_contract_registry_parity | PASS | 0 | ev-44babed93eb2 |  |  | pending |
| 426 | search_contacts | contacts | low | static_contract_registry_parity | PASS | 0 | ev-862bf264770f |  |  | pending |
| 427 | search_documents | documents | low | static_contract_registry_parity | PASS | 0 | ev-d0fcffa11412 |  |  | pending |
| 428 | search_documents_os | documents | low | static_contract_registry_parity | PASS | 0 | ev-6cfb5b57941b |  |  | pending |
| 429 | search_emails | search | medium | static_contract_registry_parity | PASS | 0 | ev-2f7efed1fd5c |  |  | pending |
| 430 | search_facebook_leads | leads | low | static_contract_registry_parity | PASS | 0 | ev-0f04ee89dcc0 |  |  | pending |
| 431 | search_leads | leads | low | static_contract_registry_parity | PASS | 0 | ev-dacfd105d195 |  |  | pending |
| 432 | search_tools | search | low | static_contract_registry_parity | PASS | 0 | ev-2a2d6e88913c |  |  | pending |
| 433 | search_x_tweets | search | medium | static_contract_registry_parity | PASS | 0 | ev-bdbba5afe575 |  |  | pending |
| 434 | search_x_users | search | low | static_contract_registry_parity | PASS | 0 | ev-a4ce6b029083 |  |  | pending |
| 435 | segment_clients_by_criteria | contacts | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-3545802150c4 | write_tool_blocked_by_audit_policy |  | pending |
| 436 | send_batch_outreach | email | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-90a3fdff0fd0 | write_tool_requires_approval_and_--execute-write |  | pending |
| 437 | send_bulk_email | email | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-38fb4328fd5c | write_tool_requires_approval_and_--execute-write |  | pending |
| 438 | send_bulk_email_campaign | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-9b9af07169f4 | write_tool_requires_approval_and_--execute-write |  | pending |
| 439 | send_contract | documents | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-c0dda1873056 | write_tool_requires_approval_and_--execute-write |  | pending |
| 440 | send_document | documents | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-688f73655bde | write_tool_requires_approval_and_--execute-write |  | pending |
| 441 | send_document_to_claude | documents | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-ddf3c0d3fe53 | write_tool_requires_approval_and_--execute-write |  | pending |
| 442 | send_email | email | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-01a9ca03a516 | write_tool_requires_approval_and_--execute-write |  | pending |
| 443 | send_for_signature | documents | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e29eb6a352a9 | write_tool_requires_approval_and_--execute-write |  | pending |
| 444 | send_invoice | invoices | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-afc394861fea | write_tool_requires_approval_and_--execute-write |  | pending |
| 445 | send_message | email | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-0cd3ec7f5a17 | write_tool_requires_approval_and_--execute-write |  | pending |
| 446 | send_project_email | projects | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-95f58d6e92e2 | write_tool_requires_approval_and_--execute-write |  | pending |
| 447 | send_quote | revenue | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-4eb02bbe9b62 | write_tool_requires_approval_and_--execute-write |  | pending |
| 448 | send_receipt | payments | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-85f7e099ce9a | write_tool_requires_approval_and_--execute-write |  | pending |
| 449 | send_task_email | tasks | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-a876d9b03669 | write_tool_requires_approval_and_--execute-write |  | pending |
| 450 | send_tenant_message | email | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-29cadc510880 | write_tool_requires_approval_and_--execute-write |  | pending |
| 451 | send_transactional_email | email | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-c66d6b5a78c7 | write_tool_requires_approval_and_--execute-write |  | pending |
| 452 | send_whatsapp_message | email | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-661fd6106929 | write_tool_requires_approval_and_--execute-write |  | pending |
| 453 | send_x_dm | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-49d9c038402a | write_tool_requires_approval_and_--execute-write |  | pending |
| 454 | set_chatbot_handoff_rules | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-6cab1e2aafb1 | write_tool_blocked_by_audit_policy |  | pending |
| 455 | set_outreach_limits | email | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b617652fff15 | write_tool_blocked_by_audit_policy |  | pending |
| 456 | set_task_recurrence | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-d9a3cfd80291 | write_tool_blocked_by_audit_policy |  | pending |
| 457 | show_related_records | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-f10a922fa755 | write_tool_blocked_by_audit_policy |  | pending |
| 458 | solo_owner_operator_brief | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-46a954d3d73f | write_tool_blocked_by_audit_policy |  | pending |
| 459 | solo_owner_time_savings_meter | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-f9859a914fb5 | write_tool_blocked_by_audit_policy |  | pending |
| 460 | solo_owner_value_map | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-70ffdedd497f | write_tool_blocked_by_audit_policy |  | pending |
| 461 | start_contract_lifecycle | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-27f09e9c0846 | write_tool_blocked_by_audit_policy |  | pending |
| 462 | start_email_campaign | social | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-ad1101072713 | write_tool_requires_approval_and_--execute-write |  | pending |
| 463 | start_invoice_lifecycle | invoices | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-f0238a74c6a0 | write_tool_requires_approval_and_--execute-write |  | pending |
| 464 | start_lead_campaign | leads | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b5031290740f | write_tool_requires_approval_and_--execute-write |  | pending |
| 465 | start_lead_nurture | leads | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-4a0cbba01b9c | write_tool_blocked_by_audit_policy |  | pending |
| 466 | stop_workflow | workflows | critical | static_contract_destructive_blocked | BLOCKED_BY_SAFETY | 0 | ev-dd6c70022675 | destructive_tool_requires_--execute-write_in_staging |  | pending |
| 467 | store_facebook_token | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-ae0d91da52c5 | write_tool_blocked_by_audit_policy |  | pending |
| 468 | stripe_health | health | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-57969f24d8b5 | write_tool_blocked_by_audit_policy |  | pending |
| 469 | submit_for_review | approvals | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b0bc87838500 | write_tool_blocked_by_audit_policy |  | pending |
| 470 | subscribe_events | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-ca4de87b444c | write_tool_blocked_by_audit_policy |  | pending |
| 471 | subscriptions | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-50bf673d893e | write_tool_blocked_by_audit_policy |  | pending |
| 472 | summarize_ticket | support | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-865f050a1960 | write_tool_blocked_by_audit_policy |  | pending |
| 473 | summarize_workspace | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-3b69711a0271 | write_tool_blocked_by_audit_policy |  | pending |
| 474 | supabase_health | health | low | static_contract_registry_parity | PASS | 0 | ev-9eb1a9cb4983 |  |  | pending |
| 475 | supersede_document | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-58acbb7b34d9 | write_tool_blocked_by_audit_policy |  | pending |
| 476 | supervise_task | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-7cc195ea5257 | write_tool_blocked_by_audit_policy |  | pending |
| 477 | sync_all_inboxes | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-dc0a23c8d713 | write_tool_blocked_by_audit_policy |  | pending |
| 478 | sync_calendly_events | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-49ee956225ae | write_tool_blocked_by_audit_policy |  | pending |
| 479 | sync_knowledge_graph | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-091d13c5f1d0 | write_tool_blocked_by_audit_policy |  | pending |
| 480 | task_create | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-b2051f10a2d8 | write_tool_blocked_by_audit_policy |  | pending |
| 481 | task_delete | tasks | critical | static_contract_destructive_blocked | BLOCKED_BY_SAFETY | 0 | ev-877637e63b73 | destructive_tool_requires_--execute-write_in_staging |  | pending |
| 482 | task_get_results | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-f985d9044a1e | write_tool_blocked_by_audit_policy |  | pending |
| 483 | task_list | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e7e0b299b8ac | write_tool_blocked_by_audit_policy |  | pending |
| 484 | task_pause | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-44a9be266198 | write_tool_blocked_by_audit_policy |  | pending |
| 485 | task_resume | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-03fe0676cab0 | write_tool_blocked_by_audit_policy |  | pending |
| 486 | tasks | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1e4c3e6b960f | write_tool_blocked_by_audit_policy |  | pending |
| 487 | toggle_widget_visibility | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-f62282d3a2cc | write_tool_blocked_by_audit_policy |  | pending |
| 488 | train_chatbot | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-d8386544b394 | write_tool_blocked_by_audit_policy |  | pending |
| 489 | trigger_bonnie_dream | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-955d442cc233 | write_tool_blocked_by_audit_policy |  | pending |
| 490 | trigger_deal_automation | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-7a9da0e7a6a2 | write_tool_blocked_by_audit_policy |  | pending |
| 491 | trust_ledger | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-16ffa21e0d0c | write_tool_blocked_by_audit_policy |  | pending |
| 492 | unsubscribe_event | calendar | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-1956cf41879b | write_tool_blocked_by_audit_policy |  | pending |
| 493 | update_business_ai_state | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-3f09b022bd47 | write_tool_blocked_by_audit_policy |  | pending |
| 494 | update_chatbot_persona | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-8661b4cb7d45 | write_tool_blocked_by_audit_policy |  | pending |
| 495 | update_client | contacts | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-0522592b029e | write_tool_blocked_by_audit_policy |  | pending |
| 496 | update_client_metadata | contacts | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-c81c9f0e93f2 | write_tool_blocked_by_audit_policy |  | pending |
| 497 | update_client_status_batch | health | low | static_contract_registry_parity | PASS | 0 | ev-e9e68c77e1ea |  |  | pending |
| 498 | update_company | companies | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-af6751043604 | write_tool_blocked_by_audit_policy |  | pending |
| 499 | update_contact | contacts | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-75094478b422 | write_tool_blocked_by_audit_policy |  | pending |
| 500 | update_contract_status | documents | low | static_contract_registry_parity | PASS | 0 | ev-ddf9b238ecef |  |  | pending |
| 501 | update_deal | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e3325883cbb9 | write_tool_blocked_by_audit_policy |  | pending |
| 502 | update_document | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-67835e365b93 | write_tool_blocked_by_audit_policy |  | pending |
| 503 | update_inventory_stock | finance | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-ae237e6de272 | write_tool_blocked_by_audit_policy |  | pending |
| 504 | update_invoice | invoices | high | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-8549bfcd5794 | write_tool_requires_approval_and_--execute-write |  | pending |
| 505 | update_invoice_status | invoices | high | static_contract_registry_parity | PASS | 0 | ev-a874439d650c |  |  | pending |
| 506 | update_lead | leads | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-6d297e9b4462 | write_tool_blocked_by_audit_policy |  | pending |
| 507 | update_lead_status | leads | low | static_contract_registry_parity | PASS | 0 | ev-7324ed87f096 |  |  | pending |
| 508 | update_project | projects | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-3a7d9282ae82 | write_tool_blocked_by_audit_policy |  | pending |
| 509 | update_project_status | projects | low | static_contract_registry_parity | PASS | 0 | ev-8d1656b257e9 |  |  | pending |
| 510 | update_project_task | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-4b663ffbff11 | write_tool_blocked_by_audit_policy |  | pending |
| 511 | update_quote | revenue | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-114be7d6790a | write_tool_blocked_by_audit_policy |  | pending |
| 512 | update_task | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-ab4e7462aa64 | write_tool_blocked_by_audit_policy |  | pending |
| 513 | update_ticket | support | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-c8e1f81d8bbd | write_tool_blocked_by_audit_policy |  | pending |
| 514 | upload_document | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-4f0294f6fa87 | write_tool_blocked_by_audit_policy |  | pending |
| 515 | upload_file | documents | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-520be74801b6 | write_tool_blocked_by_audit_policy |  | pending |
| 516 | upload_media | media | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-acae0240ac73 | write_tool_blocked_by_audit_policy |  | pending |
| 517 | upload_media_asset | media | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-a502149e1764 | write_tool_blocked_by_audit_policy |  | pending |
| 518 | upload_social_media | media | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-c2347c519a4f | write_tool_blocked_by_audit_policy |  | pending |
| 519 | upsert_nexus_memory | bonnie | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-f479127f95a5 | write_tool_blocked_by_audit_policy |  | pending |
| 520 | validate_document | documents | medium | static_contract_registry_parity | PASS | 0 | ev-2e4f335b2d70 |  |  | pending |
| 521 | verify_invoice_sent | invoices | high | static_contract_registry_parity | PASS | 0 | ev-e0525d6b0659 |  |  | pending |
| 522 | verify_lead_created | leads | medium | static_contract_registry_parity | PASS | 0 | ev-8ff007d50d7e |  |  | pending |
| 523 | verify_outreach_delivery | email | medium | static_contract_registry_parity | PASS | 0 | ev-cba7517cad05 |  |  | pending |
| 524 | verify_social_post_published | social | high | static_contract_registry_parity | PASS | 0 | ev-ef1cb5a41970 |  |  | pending |
| 525 | voice_action_router | workspace | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-3bf3b49aea42 | write_tool_blocked_by_audit_policy |  | pending |
| 526 | void_document | documents | critical | static_contract_destructive_blocked | BLOCKED_BY_SAFETY | 0 | ev-d471da5516fc | destructive_tool_requires_--execute-write_in_staging |  | pending |
| 527 | write_audit_log | admin | low | static_contract_registry_parity | PASS | 0 | ev-afa5ff4518e8 |  |  | pending |
| 528 | write_task_note | tasks | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-e2000d86d428 | write_tool_blocked_by_audit_policy |  | pending |
| 529 | x_connection_diagnostic | social | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-34b0eafe9748 | write_tool_blocked_by_audit_policy |  | pending |
| 530 | zoho_health | health | medium | static_contract_write_blocked | BLOCKED_BY_SAFETY | 0 | ev-d49205b8101b | write_tool_blocked_by_audit_policy |  | pending |
