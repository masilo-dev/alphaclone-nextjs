-- Close exposed PostgREST tables while preserving intended tenant access.

REVOKE ALL ON TABLE public.document_themes FROM anon;
REVOKE ALL ON TABLE public.document_templates FROM anon;
REVOKE ALL ON TABLE public.durable_jobs FROM anon;
REVOKE ALL ON TABLE public.domain_events FROM anon;
REVOKE ALL ON TABLE public.business_goals FROM anon;
REVOKE ALL ON TABLE public.autonomy_policies FROM anon;
REVOKE ALL ON TABLE public.commercial_services FROM anon;
REVOKE ALL ON TABLE public.lead_generation_targets FROM anon;
REVOKE ALL ON TABLE public.activity_feed FROM anon;
REVOKE ALL ON TABLE public.worker_heartbeats FROM anon;

ALTER TABLE public.document_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.durable_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomy_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_generation_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_templates_select_scope ON public.document_templates
FOR SELECT TO authenticated
USING (
  tenant_id IS NULL
  OR public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = document_templates.tenant_id
      AND tu.user_id = auth.uid()
  )
);

CREATE POLICY document_templates_mutate_scope ON public.document_templates
FOR ALL TO authenticated
USING (
  tenant_id IS NOT NULL AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = document_templates.tenant_id
        AND tu.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  tenant_id IS NOT NULL AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = document_templates.tenant_id
        AND tu.user_id = auth.uid()
    )
  )
);

CREATE POLICY document_themes_tenant_scope ON public.document_themes
FOR ALL TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = document_themes.tenant_id
      AND tu.user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = document_themes.tenant_id
      AND tu.user_id = auth.uid()
  )
);

CREATE POLICY business_goals_tenant_scope ON public.business_goals
FOR ALL TO authenticated
USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = business_goals.tenant_id AND tu.user_id = auth.uid()))
WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = business_goals.tenant_id AND tu.user_id = auth.uid()));

CREATE POLICY autonomy_policies_tenant_scope ON public.autonomy_policies
FOR ALL TO authenticated
USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = autonomy_policies.tenant_id AND tu.user_id = auth.uid()))
WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = autonomy_policies.tenant_id AND tu.user_id = auth.uid()));

CREATE POLICY commercial_services_tenant_scope ON public.commercial_services
FOR ALL TO authenticated
USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = commercial_services.tenant_id AND tu.user_id = auth.uid()))
WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = commercial_services.tenant_id AND tu.user_id = auth.uid()));

CREATE POLICY lead_generation_targets_tenant_scope ON public.lead_generation_targets
FOR ALL TO authenticated
USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = lead_generation_targets.tenant_id AND tu.user_id = auth.uid()))
WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = lead_generation_targets.tenant_id AND tu.user_id = auth.uid()));

CREATE POLICY domain_events_tenant_read ON public.domain_events
FOR SELECT TO authenticated
USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = domain_events.tenant_id AND tu.user_id = auth.uid()));

CREATE POLICY activity_feed_tenant_read ON public.activity_feed
FOR SELECT TO authenticated
USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = activity_feed.tenant_id AND tu.user_id = auth.uid()));

-- Internal runtime infrastructure: service-role access bypasses RLS.
REVOKE ALL ON TABLE public.durable_jobs FROM authenticated;
REVOKE ALL ON TABLE public.worker_heartbeats FROM authenticated;
