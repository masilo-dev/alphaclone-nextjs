# Supabase schema drift report

Production project: `ehekzoioqvtweugemktn`
Production latest recorded migration: `20260724200000_mcp_connector_media_email_actions`

Pending canonical migrations:

1. `20260724210000_fix_claude_mcp_oauth_redirects.sql`
2. `20260724223000_uploads_storage_tenant_rls.sql`
3. `20260724230000_fix_tenant_status_and_uploads_rls.sql`
4. `20260724230001_uploads_storage_policies_dashboard.sql`
5. `20260724240000_scraper_leads_geo_reach.sql`
6. `20260726120000_lead_finder_rebuild.sql`
7. `20260726150000_marketing_module_foundation.sql`
8. `20260726180000_documents_contracts_shared_platform.sql`
9. `20260726200000_projects_tasks_operating_system.sql`
10. `20260726220000_canonical_finance_foundation.sql`
11. `20260726230000_unified_email_foundation.sql`
12. `20260727090000_client_centric_support.sql`
13. `20260727120000_communication_compliance_governance.sql`
14. `20260727150000_mcp_oauth_grants_multiclient_hardening.sql`
15. `20260727160000_close_public_compliance_and_quarantine_tables.sql`
16. `20260727161000_security_invoker_public_views.sql`
17. `20260727162000_harden_security_definer_search_paths.sql`

The chain must be locally rebuilt and dry-run as a unit. Do not cherry-pick later migrations unless their dependencies are proven.
