-- Seed standard Projects V2 task/dependency definitions for every existing template.
-- Uses canonical template rows and remains safe to re-run via unique constraints.

WITH template_rows AS (
  SELECT id, tenant_id, template_key FROM public.project_templates
  WHERE template_key IN (
    'website-development','consulting','software-development','marketing-campaign',
    'social-media-management','client-onboarding','custom'
  )
), task_seed(template_key, phase_name, task_key, title, description, priority, start_day, due_day, weight, requires_approval, order_index) AS (
  VALUES
    ('website-development','Discovery','requirements','Requirements gathering','Collect goals, content, access and acceptance criteria.','high',0,5,2,false,10),
    ('website-development','Design','design','Design and prototype','Prepare the agreed website design for client review.','high',6,12,3,true,20),
    ('website-development','Build','development','Website development','Implement the approved design and content.','high',13,23,4,false,30),
    ('website-development','QA','qa','Quality assurance','Validate functionality, content, responsiveness and launch readiness.','high',24,28,2,false,40),
    ('website-development','Launch','final-approval','Final client approval','Obtain final launch approval from the client.','high',28,29,1,true,50),
    ('website-development','Launch','launch','Launch and handover','Release the website and complete handover.','high',30,30,2,false,60),

    ('consulting','Discovery','discovery','Discovery session','Collect stakeholder goals, constraints and evidence.','high',0,5,2,false,10),
    ('consulting','Analysis','analysis','Analysis','Analyze findings and identify options.','high',6,12,3,false,20),
    ('consulting','Recommendations','recommendations','Prepare recommendations','Produce recommendations and decision support.','high',13,18,3,true,30),
    ('consulting','Handover','handover','Client handover','Review recommendations, decisions and next actions.','medium',19,21,2,false,40),

    ('software-development','Planning','scope','Scope and acceptance criteria','Confirm requirements, architecture and acceptance criteria.','high',0,6,2,true,10),
    ('software-development','Implementation','implementation','Implementation','Build the agreed software increment.','high',7,20,5,false,20),
    ('software-development','Validation','validation','Validation and QA','Test behavior, security and acceptance criteria.','high',21,27,3,false,30),
    ('software-development','Release','release-approval','Release approval','Obtain release approval.','high',27,28,1,true,40),
    ('software-development','Release','release','Release and handover','Deploy, observe and hand over.','high',28,30,2,false,50),

    ('marketing-campaign','Strategy','strategy','Campaign strategy','Define audience, offer, channels and success metrics.','high',0,4,2,true,10),
    ('marketing-campaign','Production','assets','Campaign production','Create campaign copy and assets.','high',5,11,3,true,20),
    ('marketing-campaign','Launch','launch','Campaign launch','Approve, schedule and launch the campaign.','high',12,13,2,false,30),
    ('marketing-campaign','Optimization','optimization','Optimize and report','Review results, optimize and summarize performance.','medium',14,21,2,false,40),

    ('social-media-management','Plan','content-plan','Content plan','Define content pillars, topics and publishing calendar.','high',0,4,2,true,10),
    ('social-media-management','Produce','content-production','Content production','Create and review planned content.','high',5,9,3,true,20),
    ('social-media-management','Publish','publishing','Publish approved content','Schedule and publish approved content.','medium',10,24,3,false,30),
    ('social-media-management','Report','reporting','Performance report','Summarize performance and next actions.','medium',25,28,2,false,40),

    ('client-onboarding','Intake','intake','Client intake','Collect required business, contact and delivery information.','high',0,1,2,false,10),
    ('client-onboarding','Access','access','Access and integrations','Provision required accounts, permissions and integrations.','high',1,3,2,false,20),
    ('client-onboarding','Kickoff','kickoff','Kickoff meeting','Confirm responsibilities, cadence and first deliverables.','high',4,5,2,false,30),
    ('client-onboarding','Activated','activation-check','Onboarding approval','Confirm onboarding is complete and ready for delivery.','medium',6,7,1,true,40),

    ('custom','Execution','plan','Plan project','Define scope, owners, deadlines and expected outcome.','medium',0,2,2,false,10),
    ('custom','Execution','execute','Execute project','Complete the agreed project work.','medium',3,14,3,false,20),
    ('custom','Execution','review','Review and approve','Review the outcome and capture approval.','medium',14,15,1,true,30)
)
INSERT INTO public.project_template_tasks (
  tenant_id, template_id, phase_id, task_key, title, description, priority,
  relative_start_days, relative_due_days, weight, requires_approval, order_index, metadata
)
SELECT
  t.tenant_id,
  t.id,
  p.id,
  s.task_key,
  s.title,
  s.description,
  s.priority,
  s.start_day,
  s.due_day,
  s.weight,
  s.requires_approval,
  s.order_index,
  jsonb_build_object('system', true, 'seed', 'projects-v2')
FROM template_rows t
JOIN task_seed s ON s.template_key = t.template_key
LEFT JOIN public.project_template_phases p
  ON p.template_id = t.id AND p.tenant_id = t.tenant_id AND p.name = s.phase_name
ON CONFLICT (template_id, task_key) DO UPDATE SET
  phase_id = EXCLUDED.phase_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  relative_start_days = EXCLUDED.relative_start_days,
  relative_due_days = EXCLUDED.relative_due_days,
  weight = EXCLUDED.weight,
  requires_approval = EXCLUDED.requires_approval,
  order_index = EXCLUDED.order_index,
  updated_at = now();

WITH template_rows AS (
  SELECT id, tenant_id, template_key FROM public.project_templates
  WHERE template_key IN (
    'website-development','consulting','software-development','marketing-campaign',
    'social-media-management','client-onboarding','custom'
  )
), dependency_seed(template_key, task_key, depends_on_task_key) AS (
  VALUES
    ('website-development','design','requirements'),
    ('website-development','development','design'),
    ('website-development','qa','development'),
    ('website-development','final-approval','qa'),
    ('website-development','launch','final-approval'),
    ('consulting','analysis','discovery'),
    ('consulting','recommendations','analysis'),
    ('consulting','handover','recommendations'),
    ('software-development','implementation','scope'),
    ('software-development','validation','implementation'),
    ('software-development','release-approval','validation'),
    ('software-development','release','release-approval'),
    ('marketing-campaign','assets','strategy'),
    ('marketing-campaign','launch','assets'),
    ('marketing-campaign','optimization','launch'),
    ('social-media-management','content-production','content-plan'),
    ('social-media-management','publishing','content-production'),
    ('social-media-management','reporting','publishing'),
    ('client-onboarding','access','intake'),
    ('client-onboarding','kickoff','access'),
    ('client-onboarding','activation-check','kickoff'),
    ('custom','execute','plan'),
    ('custom','review','execute')
)
INSERT INTO public.project_template_dependencies (
  tenant_id, template_id, task_key, depends_on_task_key, dependency_type, lag_minutes
)
SELECT t.tenant_id, t.id, d.task_key, d.depends_on_task_key, 'finish_to_start', 0
FROM template_rows t
JOIN dependency_seed d ON d.template_key = t.template_key
ON CONFLICT (template_id, task_key, depends_on_task_key, dependency_type) DO NOTHING;
