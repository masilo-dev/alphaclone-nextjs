-- Migration for Strategic Decision Engine & Playbook Swarms
-- Date: 2026-05-20

-- 1. Create custom_playbooks table if it does not exist
CREATE TABLE IF NOT EXISTS custom_playbooks (
  id text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  steps jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for custom_playbooks
ALTER TABLE custom_playbooks ENABLE ROW LEVEL SECURITY;

<<<<<<< HEAD
DROP POLICY IF EXISTS "Enable read access for custom_playbooks by tenant_id" ON custom_playbooks;
=======
>>>>>>> origin/main
CREATE POLICY "Enable read access for custom_playbooks by tenant_id"
  ON custom_playbooks FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

<<<<<<< HEAD
DROP POLICY IF EXISTS "Enable write access for custom_playbooks by tenant_id" ON custom_playbooks;
=======
>>>>>>> origin/main
CREATE POLICY "Enable write access for custom_playbooks by tenant_id"
  ON custom_playbooks FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 2. Create outreach_campaign_stats table if it does not exist
CREATE TABLE IF NOT EXISTS outreach_campaign_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  strategy text NOT NULL,
  sent_count integer DEFAULT 0,
  response_count integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for outreach_campaign_stats
ALTER TABLE outreach_campaign_stats ENABLE ROW LEVEL SECURITY;

<<<<<<< HEAD
DROP POLICY IF EXISTS "Enable read access for outreach_campaign_stats by tenant_id" ON outreach_campaign_stats;
=======
>>>>>>> origin/main
CREATE POLICY "Enable read access for outreach_campaign_stats by tenant_id"
  ON outreach_campaign_stats FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

<<<<<<< HEAD
DROP POLICY IF EXISTS "Enable write access for outreach_campaign_stats by tenant_id" ON outreach_campaign_stats;
=======
>>>>>>> origin/main
CREATE POLICY "Enable write access for outreach_campaign_stats by tenant_id"
  ON outreach_campaign_stats FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 3. Create secure read-only SQL querying RPC
CREATE OR REPLACE FUNCTION secure_read_only_query(query_string text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Strict Postgres guard against write and diagnostic sequences
  IF query_string ILIKE '%insert%' OR
     query_string ILIKE '%update%' OR
     query_string ILIKE '%delete%' OR
     query_string ILIKE '%drop%' OR
     query_string ILIKE '%truncate%' OR
     query_string ILIKE '%alter%' OR
     query_string ILIKE '%create%' OR
     query_string ILIKE '%grant%' OR
     query_string ILIKE '%revoke%' OR
     query_string ILIKE '%pg_%' OR
     query_string ILIKE '%information_schema%' THEN
    RAISE EXCEPTION 'Action rejected: Secure read-only queries only support SELECT operations.';
  END IF;

  -- Dynamic execution returning a single cohesive JSON array
  EXECUTE 'SELECT coalesce(json_agg(t), ''[]''::jsonb) FROM (' || query_string || ') t' INTO result;

  RETURN result;
END;
$$;
