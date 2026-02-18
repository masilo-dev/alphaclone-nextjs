-- Migration: Fix Deal Activities RLS and Trigger

-- 1. Update log_deal_stage_change function to include tenant_id
CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        INSERT INTO public.deal_activities (deal_id, user_id, activity_type, title, description, metadata, tenant_id)
        VALUES (
            NEW.id,
            auth.uid(),
            'stage_change',
            'Deal stage changed',
            'Stage changed from ' || OLD.stage || ' to ' || NEW.stage,
            jsonb_build_object('old_stage', OLD.stage, 'new_stage', NEW.stage),
            NEW.tenant_id -- Include tenant_id from the deal
        );
    END IF;
    RETURN NEW;
END;
$function$;

-- 2. Backfill tenant_id for existing deal_activities (including the 3 nulls)
UPDATE deal_activities da
SET tenant_id = d.tenant_id
FROM deals d
WHERE da.deal_id = d.id
AND da.tenant_id IS NULL;

-- 3. Add RLS policy for deal_activities
-- Allow users to view/insert/update/delete activities for their tenant
CREATE POLICY "tenant_isolation_policy" ON "public"."deal_activities"
AS PERMISSIVE FOR ALL
TO public
USING (
  (is_super_admin() OR (tenant_id IN ( SELECT get_user_tenant_ids.tenant_id
   FROM get_user_tenant_ids() get_user_tenant_ids(tenant_id))))
)
WITH CHECK (
  (is_super_admin() OR (tenant_id IN ( SELECT get_user_tenant_ids.tenant_id
   FROM get_user_tenant_ids() get_user_tenant_ids(tenant_id))))
);
