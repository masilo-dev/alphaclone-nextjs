-- Roll back new shared-module objects. Existing documents, uploads and contracts remain.
DROP TABLE IF EXISTS public.contract_milestones;
DROP TABLE IF EXISTS public.contract_obligations;
DROP TABLE IF EXISTS public.contract_parties;
DROP TABLE IF EXISTS public.document_shares;
DROP TABLE IF EXISTS public.document_requests;
DROP TABLE IF EXISTS public.document_activity;
DROP TABLE IF EXISTS public.document_relationships;
DROP FUNCTION IF EXISTS public.document_activity_append_only();

-- Columns are intentionally retained because they may contain production data.
-- A later, explicitly approved cleanup migration may remove empty columns.
