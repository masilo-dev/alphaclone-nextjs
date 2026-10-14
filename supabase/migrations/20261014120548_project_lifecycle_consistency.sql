-- No historical notification backfill or fabricated completion timestamps.
CREATE OR REPLACE FUNCTION public.recalculate_project_lifecycle(p_tenant_id uuid, p_project_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE p public.projects%ROWTYPE; v_progress numeric; m record; v_total numeric; v_done numeric;
BEGIN
 SELECT * INTO p FROM projects WHERE id=p_project_id AND tenant_id=p_tenant_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'project_not_found'; END IF;
 FOR m IN SELECT * FROM project_milestones WHERE tenant_id=p_tenant_id AND project_id=p_project_id AND deleted_at IS NULL ORDER BY order_index LOOP
  SELECT sum(greatest(weight,0)), sum(CASE WHEN status::text IN ('completed','done') THEN greatest(weight,0) ELSE 0 END)
  INTO v_total,v_done FROM tasks WHERE tenant_id=p_tenant_id AND coalesce(project_id,related_to_project)=p_project_id AND milestone_id=m.id AND deleted_at IS NULL AND status::text NOT IN ('cancelled','archived');
  IF coalesce(v_total,0)>0 THEN
   UPDATE project_milestones SET progress_percent=round(100*coalesce(v_done,0)/v_total,2),
    status=CASE WHEN v_done=v_total AND coalesce(metadata->>'requires_approval','false')<>'true' THEN 'completed' WHEN status='completed' AND v_done<v_total THEN 'pending' ELSE status END,
    updated_at=now() WHERE id=m.id AND tenant_id=p_tenant_id;
  END IF;
 END LOOP;
 IF p.progress_method='manual' THEN RETURN p.progress; END IF;
 IF p.progress_method IN ('milestones','milestone_based') THEN
  SELECT 100.0*count(*) FILTER(WHERE status IN ('completed','done'))/nullif(count(*),0) INTO v_progress
  FROM project_milestones WHERE tenant_id=p_tenant_id AND project_id=p_project_id AND deleted_at IS NULL AND status<>'cancelled';
 ELSE
  SELECT 100.0*sum(CASE WHEN status::text IN ('completed','done') THEN CASE WHEN p.progress_method='task_based' THEN 1 ELSE greatest(weight,0) END ELSE 0 END)
    /nullif(sum(CASE WHEN p.progress_method='task_based' THEN 1 ELSE greatest(weight,0) END),0)
  INTO v_progress FROM tasks WHERE tenant_id=p_tenant_id AND coalesce(project_id,related_to_project)=p_project_id AND deleted_at IS NULL AND status::text NOT IN ('cancelled','archived');
 END IF;
 v_progress:=round(coalesce(v_progress,0),2);
 UPDATE projects SET progress=v_progress,updated_at=now() WHERE id=p_project_id AND tenant_id=p_tenant_id AND progress IS DISTINCT FROM v_progress;
 -- Progress never changes authorization or final acceptance status.
 RETURN v_progress;
END $$;
REVOKE ALL ON FUNCTION public.recalculate_project_lifecycle(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_project_lifecycle(uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.synchronize_project_task() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_project uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN RAISE EXCEPTION 'task_tenant_is_immutable'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id AND NEW.related_to_project IS NOT DISTINCT FROM OLD.related_to_project THEN NEW.related_to_project:=NEW.project_id;
  ELSIF NEW.related_to_project IS DISTINCT FROM OLD.related_to_project AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id THEN NEW.project_id:=NEW.related_to_project;
  END IF;
 END IF;
 IF NEW.project_id IS NOT NULL AND NEW.related_to_project IS NOT NULL AND NEW.project_id<>NEW.related_to_project THEN RAISE EXCEPTION 'conflicting_task_project_links'; END IF;
 v_project:=coalesce(NEW.project_id,NEW.related_to_project);
 NEW.project_id:=v_project; NEW.related_to_project:=v_project;
 IF v_project IS NOT NULL AND NOT EXISTS(SELECT 1 FROM projects WHERE id=v_project AND tenant_id=NEW.tenant_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'project_not_found_in_tenant'; END IF;
 IF NEW.milestone_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM project_milestones WHERE id=NEW.milestone_id AND project_id=v_project AND tenant_id=NEW.tenant_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'milestone_not_found_in_project'; END IF;
 IF NEW.status::text IN ('completed','done') AND NEW.requires_approval AND NOT EXISTS(SELECT 1 FROM project_client_approvals WHERE tenant_id=NEW.tenant_id AND project_id=v_project AND task_id=NEW.id AND status='approved') THEN RAISE EXCEPTION 'task_client_approval_required'; END IF;
 IF NEW.status::text IN ('completed','done') THEN
  NEW.progress_percent:=100;
  IF TG_OP='INSERT' THEN NEW.completed_at:=coalesce(NEW.completed_at,now());
  ELSIF OLD.status::text NOT IN ('completed','done') THEN NEW.completed_at:=now(); END IF;
 ELSE NEW.progress_percent:=0; NEW.completed_at:=NULL;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.synchronize_project_task() FROM PUBLIC;
CREATE TRIGGER project_task_consistency BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.synchronize_project_task();

CREATE OR REPLACE FUNCTION public.record_project_task_change() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_project uuid; v_tenant uuid;
BEGIN
 IF TG_OP='DELETE' THEN v_project:=coalesce(OLD.project_id,OLD.related_to_project); v_tenant:=OLD.tenant_id;
 ELSE v_project:=NEW.project_id; v_tenant:=NEW.tenant_id; END IF;
 IF v_project IS NOT NULL THEN
  IF TG_OP='INSERT' OR TG_OP='DELETE' OR NEW.status IS DISTINCT FROM OLD.status THEN
   INSERT INTO project_activity(tenant_id,project_id,action,target_type,target_id,new_value,source)
    VALUES(v_tenant,v_project,CASE WHEN TG_OP='DELETE' THEN 'task_deleted' WHEN TG_OP='INSERT' THEN 'task_created' WHEN NEW.status::text IN ('completed','done') THEN 'task_completed' ELSE 'task_status_changed' END,'task',coalesce(NEW.id,OLD.id),CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE jsonb_build_object('title',NEW.title,'status',NEW.status) END,'database');
  END IF;
  PERFORM recalculate_project_lifecycle(v_tenant,v_project);
 END IF;
 IF TG_OP='UPDATE' AND coalesce(OLD.project_id,OLD.related_to_project) IS DISTINCT FROM v_project AND coalesce(OLD.project_id,OLD.related_to_project) IS NOT NULL THEN
  PERFORM recalculate_project_lifecycle(OLD.tenant_id,coalesce(OLD.project_id,OLD.related_to_project));
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.record_project_task_change() FROM PUBLIC;
CREATE TRIGGER project_task_lifecycle AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.record_project_task_change();

CREATE OR REPLACE FUNCTION public.record_project_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO project_activity(tenant_id,project_id,action,target_type,target_id,new_value,source) VALUES(NEW.tenant_id,NEW.id,'project_created','project',NEW.id,jsonb_build_object('name',NEW.name,'status',NEW.status),'database');
 ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.current_stage IS DISTINCT FROM OLD.current_stage OR NEW.metadata->>'execution_authorized' IS DISTINCT FROM OLD.metadata->>'execution_authorized' THEN
  INSERT INTO project_activity(tenant_id,project_id,action,target_type,target_id,previous_value,new_value,source) VALUES(NEW.tenant_id,NEW.id,CASE WHEN NEW.status IS DISTINCT FROM OLD.status OR NEW.metadata->>'execution_authorized' IS DISTINCT FROM OLD.metadata->>'execution_authorized' THEN 'project_status_changed' ELSE 'stage_changed' END,'project',NEW.id,jsonb_build_object('status',OLD.status,'stage',OLD.current_stage),jsonb_build_object('status',NEW.status,'stage',NEW.current_stage,'execution_authorized',NEW.metadata->>'execution_authorized'='true'),'database');
 END IF;
 IF TG_OP='UPDATE' AND NEW.due_date>OLD.due_date THEN
  INSERT INTO project_activity(tenant_id,project_id,action,target_type,target_id,new_value,source) VALUES(NEW.tenant_id,NEW.id,'project_delayed','project',NEW.id,jsonb_build_object('due_date',NEW.due_date,'previous_due_date',OLD.due_date),'database');
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.record_project_lifecycle() FROM PUBLIC;
CREATE TRIGGER project_lifecycle_activity AFTER INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.record_project_lifecycle();

CREATE OR REPLACE FUNCTION public.record_project_milestone_change() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE next_stage text;
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
  IF EXISTS(SELECT 1 FROM tasks WHERE tenant_id=NEW.tenant_id AND milestone_id=NEW.id AND deleted_at IS NULL AND status::text NOT IN ('completed','done','cancelled','archived')) THEN RAISE EXCEPTION 'milestone_requirements_incomplete'; END IF;
  NEW.metadata:=coalesce(NEW.metadata,'{}')||jsonb_build_object('completed_at',now());
  INSERT INTO project_activity(tenant_id,project_id,action,target_type,target_id,new_value,source) VALUES(NEW.tenant_id,NEW.project_id,'milestone_completed','milestone',NEW.id,jsonb_build_object('name',NEW.name),'database');
  next_stage:=NEW.metadata->>'next_stage';
  IF NEW.metadata->>'auto_advance'='true' AND next_stage IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM project_milestones WHERE tenant_id=NEW.tenant_id AND project_id=NEW.project_id AND deleted_at IS NULL AND order_index<NEW.order_index AND status<>'completed')
   AND NOT EXISTS(SELECT 1 FROM tasks WHERE tenant_id=NEW.tenant_id AND milestone_id=NEW.id AND deleted_at IS NULL AND status::text NOT IN ('completed','done','cancelled','archived')) THEN
   UPDATE projects SET current_stage=next_stage,updated_at=now() WHERE id=NEW.project_id AND tenant_id=NEW.tenant_id AND metadata->>'execution_authorized'='true';
  END IF;
 ELSIF NEW.status<>'completed' AND OLD.status='completed' THEN NEW.metadata:=NEW.metadata-'completed_at';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_project_milestone_change() FROM PUBLIC;
CREATE TRIGGER project_milestone_activity BEFORE UPDATE ON public.project_milestones FOR EACH ROW EXECUTE FUNCTION public.record_project_milestone_change();

-- One create transaction includes idempotency, relationship validation and template initialization.
CREATE OR REPLACE FUNCTION public.create_project_lifecycle(p_tenant_id uuid,p_row jsonb,p_key text,p_template_id uuid DEFAULT NULL,p_actor uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v public.projects%ROWTYPE; r public.projects%ROWTYPE; linked_client uuid; application jsonb;
BEGIN
 IF p_key IS NULL OR p_key='' THEN RAISE EXCEPTION 'idempotency_key_required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_key,0));
 r:=jsonb_populate_record(NULL::projects,p_row);
 IF r.contract_id IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':contract:'||r.contract_id::text,0));
  SELECT client_id INTO linked_client FROM contracts WHERE id=r.contract_id AND tenant_id=p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found_in_tenant'; END IF;
  IF r.client_id IS DISTINCT FROM linked_client THEN RAISE EXCEPTION 'contract_client_mismatch'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM unnest(coalesce(r.team,'{}')) member_id WHERE NOT EXISTS(SELECT 1 FROM tenant_users WHERE tenant_id=p_tenant_id AND user_id=member_id)) THEN RAISE EXCEPTION 'project_team_member_not_in_tenant'; END IF;
 IF r.owner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tenant_users WHERE tenant_id=p_tenant_id AND user_id=r.owner_id) THEN RAISE EXCEPTION 'project_owner_not_in_tenant'; END IF;
 IF r.deal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM deals WHERE id=r.deal_id AND tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'deal_not_found_in_tenant'; END IF;
 IF r.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM business_clients WHERE id=r.client_id AND tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'client_not_found_in_tenant'; END IF;
 SELECT * INTO v FROM projects WHERE tenant_id=p_tenant_id AND (metadata->>'creation_idempotency_key'=p_key OR (r.contract_id IS NOT NULL AND id=(SELECT project_id FROM contracts WHERE id=r.contract_id AND tenant_id=p_tenant_id)) OR (r.contract_id IS NOT NULL AND contract_id=r.contract_id) OR (r.deal_id IS NOT NULL AND deal_id=r.deal_id)) LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  IF v.client_id IS DISTINCT FROM r.client_id THEN RAISE EXCEPTION 'existing_project_client_mismatch'; END IF;
  IF r.contract_id IS NOT NULL AND v.contract_id IS NULL THEN UPDATE projects SET contract_id=r.contract_id WHERE id=v.id AND tenant_id=p_tenant_id RETURNING * INTO v; END IF;
  RETURN jsonb_build_object('project',to_jsonb(v),'created',false,'duplicate',true); END IF;
 INSERT INTO projects(tenant_id,owner_id,owner_name,name,category,status,current_stage,progress,description,due_date,client_id,deal_id,contract_id,team,resources,is_public,show_in_portfolio,portal_enabled,auto_invoice_enabled,contract_status,budget_used,metadata,created_by,owner_user_id,project_type,progress_method,start_date,portal_token,image,external_url,budget,budget_total,estimated_completion_date)
 VALUES(p_tenant_id,r.owner_id,r.owner_name,r.name,coalesce(r.category,'General'),coalesce(r.status,'Pending'),coalesce(r.current_stage,'Discovery'),0,r.description,r.due_date,r.client_id,r.deal_id,r.contract_id,coalesce(r.team,'{}'),coalesce(r.resources,'{}'),coalesce(r.is_public,false),coalesce(r.show_in_portfolio,false),coalesce(r.portal_enabled,false),coalesce(r.auto_invoice_enabled,false),coalesce(r.contract_status,'None'),coalesce(r.budget_used,0),coalesce(r.metadata,'{}')||jsonb_build_object('creation_idempotency_key',p_key),p_actor,r.owner_id,r.project_type,coalesce(r.progress_method,'weighted_tasks'),r.start_date,r.portal_token,r.image,r.external_url,r.budget,r.budget_total,r.estimated_completion_date) RETURNING * INTO v;
 IF p_template_id IS NOT NULL THEN
  application:=apply_project_template(p_tenant_id,v.id,p_template_id,coalesce(v.start_date::date,current_date),'project-template:'||v.id::text||':'||p_template_id::text,p_actor,'project-create:'||v.id::text);
 END IF;
 RETURN jsonb_build_object('project',to_jsonb(v),'created',true,'duplicate',false,'templateApplication',application);
END $$;
REVOKE ALL ON FUNCTION public.create_project_lifecycle(uuid,jsonb,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_lifecycle(uuid,jsonb,text,uuid,uuid) TO service_role;
CREATE INDEX IF NOT EXISTS tasks_tenant_legacy_project_active_idx ON public.tasks(tenant_id,related_to_project) WHERE deleted_at IS NULL;

CREATE TABLE public.project_notification_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL REFERENCES projects(id),
 event_id uuid NOT NULL UNIQUE REFERENCES project_activity(id), event_type text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','suppressed','provider_accepted','delivered','bounced','failed','needs_reconciliation')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz,
 canonical_message_id uuid, provider text, provider_reference text, last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_notification_outbox ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.project_notification_outbox TO authenticated;
GRANT ALL ON public.project_notification_outbox TO service_role;
CREATE POLICY project_outbox_tenant_read ON public.project_notification_outbox FOR SELECT TO authenticated USING(is_active_tenant_member(tenant_id));
CREATE INDEX project_notification_pending_idx ON public.project_notification_outbox(next_attempt_at) WHERE status='queued';
CREATE OR REPLACE FUNCTION public.enqueue_project_notification() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NEW.action IN ('project_created','milestone_completed','project_status_changed','client_approval_required','document_shared','project_delayed','client_message_received') THEN
  INSERT INTO project_notification_outbox(tenant_id,project_id,event_id,event_type) VALUES(NEW.tenant_id,NEW.project_id,NEW.id,NEW.action) ON CONFLICT(event_id) DO NOTHING;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_project_notification() FROM PUBLIC;
-- Trigger needs privileged insert while dashboard clients only receive read access.
-- Keep its definer function private and uncallable as an RPC.
CREATE SCHEMA IF NOT EXISTS project_internal;
ALTER FUNCTION public.enqueue_project_notification() SET SCHEMA project_internal;
ALTER FUNCTION project_internal.enqueue_project_notification() SECURITY DEFINER;
REVOKE ALL ON SCHEMA project_internal FROM PUBLIC;
CREATE TRIGGER project_notification_event AFTER INSERT ON public.project_activity FOR EACH ROW EXECUTE FUNCTION project_internal.enqueue_project_notification();

CREATE OR REPLACE FUNCTION public.recalculate_after_milestone_change() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF pg_trigger_depth()>1 THEN RETURN NULL; END IF;
 IF TG_OP='DELETE' THEN PERFORM recalculate_project_lifecycle(OLD.tenant_id,OLD.project_id);
 ELSE PERFORM recalculate_project_lifecycle(NEW.tenant_id,NEW.project_id); END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.recalculate_after_milestone_change() FROM PUBLIC;
CREATE TRIGGER milestone_project_progress AFTER INSERT OR UPDATE OR DELETE ON public.project_milestones FOR EACH ROW EXECUTE FUNCTION public.recalculate_after_milestone_change();

CREATE OR REPLACE FUNCTION public.record_project_approval_request() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NEW.status='pending' THEN
  INSERT INTO project_activity(tenant_id,project_id,action,target_type,target_id,new_value,source) VALUES(NEW.tenant_id,NEW.project_id,'client_approval_required','approval',NEW.id,jsonb_build_object('title',NEW.title),'database');
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.record_project_approval_request() FROM PUBLIC;
CREATE TRIGGER project_approval_notification AFTER INSERT ON public.project_client_approvals FOR EACH ROW EXECUTE FUNCTION public.record_project_approval_request();
CREATE OR REPLACE FUNCTION public.record_project_shared_relationship() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NEW.relationship_type='shared' AND NEW.target_type IN ('document','file') THEN
  INSERT INTO project_activity(tenant_id,project_id,action,target_type,target_id,new_value,source) VALUES(NEW.tenant_id,NEW.project_id,'document_shared',NEW.target_type,NEW.target_id,'{}','database');
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.record_project_shared_relationship() FROM PUBLIC;
CREATE TRIGGER project_shared_document_notification AFTER INSERT ON public.project_relationships FOR EACH ROW EXECUTE FUNCTION public.record_project_shared_relationship();
CREATE OR REPLACE FUNCTION public.record_project_client_message() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NEW.is_client=false THEN
  INSERT INTO project_activity(tenant_id,project_id,action,target_type,target_id,new_value,source) VALUES(NEW.tenant_id,NEW.project_id,'client_message_received','project_comment',NEW.id,jsonb_build_object('author_name',NEW.author_name),'database');
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.record_project_client_message() FROM PUBLIC;
CREATE TRIGGER project_message_notification AFTER INSERT ON public.project_comments FOR EACH ROW EXECUTE FUNCTION public.record_project_client_message();
CREATE OR REPLACE FUNCTION public.validate_project_activity_tenant() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM projects WHERE id=NEW.project_id AND tenant_id=NEW.tenant_id) THEN RAISE EXCEPTION 'activity_project_not_found_in_tenant'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_project_activity_tenant() FROM PUBLIC;
CREATE TRIGGER project_activity_tenant_guard BEFORE INSERT ON public.project_activity FOR EACH ROW EXECUTE FUNCTION public.validate_project_activity_tenant();
-- Default website rules apply only to system templates without an existing rule.
-- Custom tenant rules and all existing project milestones remain unchanged.
UPDATE public.project_template_phases phase
SET metadata=jsonb_build_object('auto_advance',true,'next_stage',CASE phase.name WHEN 'Discovery' THEN 'Design' WHEN 'Design' THEN 'Development' WHEN 'Build' THEN 'Testing' ELSE 'Review' END)||coalesce(phase.metadata,'{}')
FROM public.project_templates template
WHERE phase.template_id=template.id AND phase.tenant_id=template.tenant_id
 AND template.template_key='website-development' AND template.metadata->>'system'='true'
 AND phase.name IN ('Discovery','Design','Build','QA','Launch') AND NOT(coalesce(phase.metadata,'{}') ? 'auto_advance');
