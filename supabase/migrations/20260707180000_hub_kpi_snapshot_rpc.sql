-- Fast single-RPC KPI snapshots for dashboard hub overviews (overview + crm)

BEGIN;

CREATE OR REPLACE FUNCTION public.get_hub_kpi_snapshot(p_tenant_id uuid, p_hub text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_metrics jsonb := '[]'::jsonb;
  v_chart jsonb := '[]'::jsonb;
  v_month_start timestamptz := date_trunc('month', now());
  v_active_deals int := 0;
  v_open_tasks int := 0;
  v_invoiced_month numeric := 0;
  v_emails_30d int := 0;
  v_scheduled_posts int := 0;
  v_overdue_invoices int := 0;
  v_contacts int := 0;
  v_pipeline numeric := 0;
  v_conversion numeric := 0;
BEGIN
  IF p_hub = 'overview' THEN
    IF to_regclass('public.business_invoices') IS NOT NULL THEN
      SELECT COALESCE(SUM(total), 0), COUNT(*) FILTER (WHERE status = 'overdue')
      INTO v_invoiced_month, v_overdue_invoices
      FROM business_invoices
      WHERE tenant_id = p_tenant_id AND created_at >= v_month_start;
    END IF;

    IF to_regclass('public.business_deals') IS NOT NULL THEN
      SELECT COUNT(*) INTO v_active_deals
      FROM business_deals
      WHERE tenant_id = p_tenant_id
        AND COALESCE(stage::text, '') NOT IN ('closed_won', 'closed_lost');
    END IF;

    IF to_regclass('public.tasks') IS NOT NULL THEN
      SELECT COUNT(*) INTO v_open_tasks
      FROM tasks
      WHERE tenant_id = p_tenant_id
        AND COALESCE(status::text, '') NOT IN ('completed', 'done', 'cancelled');
    END IF;

    IF to_regclass('public.lead_outreach_log') IS NOT NULL THEN
      SELECT COUNT(*) INTO v_emails_30d
      FROM lead_outreach_log
      WHERE tenant_id = p_tenant_id
        AND created_at >= now() - interval '30 days';
    END IF;

    IF to_regclass('public.social_posts') IS NOT NULL THEN
      SELECT COUNT(*) INTO v_scheduled_posts
      FROM social_posts
      WHERE tenant_id = p_tenant_id
        AND COALESCE(status::text, '') IN ('scheduled', 'queued', 'draft');
    END IF;

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Invoiced (MTD)', 'value', v_invoiced_month),
      jsonb_build_object('label', 'Active deals', 'value', v_active_deals),
      jsonb_build_object('label', 'Open tasks', 'value', v_open_tasks),
      jsonb_build_object('label', 'Emails (30d)', 'value', v_emails_30d)
    );

    IF to_regclass('public.business_invoices') IS NOT NULL THEN
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'label', to_char(m.month_start, 'Mon'),
          'value', COALESCE(t.total, 0)
        ) ORDER BY m.month_start
      ), '[]'::jsonb)
      INTO v_chart
      FROM (
        SELECT generate_series(
          date_trunc('month', now()) - interval '5 months',
          date_trunc('month', now()),
          interval '1 month'
        ) AS month_start
      ) m
      LEFT JOIN (
        SELECT date_trunc('month', created_at) AS month_start, SUM(total) AS total
        FROM business_invoices
        WHERE tenant_id = p_tenant_id
          AND created_at >= date_trunc('month', now()) - interval '5 months'
        GROUP BY 1
      ) t ON t.month_start = m.month_start;
    END IF;

  ELSIF p_hub = 'crm' THEN
    IF to_regclass('public.business_clients') IS NOT NULL THEN
      SELECT COUNT(*) INTO v_contacts
      FROM business_clients
      WHERE tenant_id = p_tenant_id AND COALESCE(is_active, true) = true;
    END IF;

    IF to_regclass('public.business_deals') IS NOT NULL THEN
      SELECT COUNT(*), COALESCE(SUM(value), 0)
      INTO v_active_deals, v_pipeline
      FROM business_deals
      WHERE tenant_id = p_tenant_id
        AND COALESCE(stage::text, '') NOT IN ('closed_won', 'closed_lost');

      SELECT CASE WHEN COUNT(*) = 0 THEN 0
                  ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE COALESCE(stage::text, '') = 'closed_won') / COUNT(*), 0)
             END
      INTO v_conversion
      FROM business_deals
      WHERE tenant_id = p_tenant_id
        AND created_at >= v_month_start;
    END IF;

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Contacts', 'value', v_contacts),
      jsonb_build_object('label', 'Active deals', 'value', v_active_deals),
      jsonb_build_object('label', 'Pipeline', 'value', v_pipeline),
      jsonb_build_object('label', 'Win rate (MTD)', 'value', v_conversion || '%')
    );

    IF to_regclass('public.business_deals') IS NOT NULL THEN
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'label', to_char(m.month_start, 'Mon'),
          'value', COALESCE(t.won, 0)
        ) ORDER BY m.month_start
      ), '[]'::jsonb)
      INTO v_chart
      FROM (
        SELECT generate_series(
          date_trunc('month', now()) - interval '5 months',
          date_trunc('month', now()),
          interval '1 month'
        ) AS month_start
      ) m
      LEFT JOIN (
        SELECT date_trunc('month', COALESCE(actual_close_date, created_at)) AS month_start,
               COUNT(*) AS won
        FROM business_deals
        WHERE tenant_id = p_tenant_id
          AND COALESCE(stage::text, '') = 'closed_won'
          AND COALESCE(actual_close_date, created_at) >= date_trunc('month', now()) - interval '5 months'
        GROUP BY 1
      ) t ON t.month_start = m.month_start;
    END IF;

  ELSE
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object('metrics', v_metrics, 'mainChart', COALESCE(v_chart, '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.get_hub_kpi_snapshot(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hub_kpi_snapshot(uuid, text) TO service_role;

COMMIT;
