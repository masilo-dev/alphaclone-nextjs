-- Hub KPI snapshot RPC (uses `deals` table — production has deals, not business_deals)

CREATE OR REPLACE FUNCTION public.get_hub_kpi_snapshot(p_tenant_id uuid, p_hub text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_metrics jsonb := '[]'::jsonb;
  v_chart jsonb := '[]'::jsonb;
  v_month_start timestamptz := date_trunc('month', now());
  v_active_deals int := 0;
  v_open_tasks int := 0;
  v_invoiced_month numeric := 0;
  v_emails_30d int := 0;
  v_overdue_invoices int := 0;
  v_contacts int := 0;
  v_pipeline numeric := 0;
  v_conversion numeric := 0;
  v_opened int := 0;
  v_replied int := 0;
  v_meetings int := 0;
  v_collected numeric := 0;
  v_outstanding numeric := 0;
  v_active_contracts int := 0;
  v_expiring int := 0;
  v_contract_value numeric := 0;
  v_signed_mtd int := 0;
  v_active_projects int := 0;
  v_completed_week int := 0;
  v_overdue_tasks int := 0;
  v_utilisation numeric := 0;
  v_published_30d int := 0;
  v_scheduled int := 0;
BEGIN
  IF NOT public.user_belongs_to_tenant(p_tenant_id) AND NOT public.is_super_admin() THEN
    RETURN NULL;
  END IF;

  IF p_hub = 'overview' THEN
    SELECT COALESCE(SUM(total), 0), COUNT(*) FILTER (WHERE status = 'overdue')
    INTO v_invoiced_month, v_overdue_invoices
    FROM business_invoices
    WHERE tenant_id = p_tenant_id AND created_at >= v_month_start;

    SELECT COUNT(*) INTO v_active_deals
    FROM deals
    WHERE tenant_id = p_tenant_id
      AND COALESCE(stage::text, '') NOT IN ('closed_won', 'closed_lost');

    SELECT COUNT(*) INTO v_open_tasks
    FROM tasks
    WHERE tenant_id = p_tenant_id
      AND COALESCE(status::text, '') NOT IN ('completed', 'done', 'cancelled');

    SELECT COUNT(*) INTO v_emails_30d
    FROM lead_outreach_log
    WHERE tenant_id = p_tenant_id
      AND created_at >= now() - interval '30 days';

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Invoiced (MTD)', 'value', v_invoiced_month),
      jsonb_build_object('label', 'Active deals', 'value', v_active_deals),
      jsonb_build_object('label', 'Open tasks', 'value', v_open_tasks),
      jsonb_build_object('label', 'Emails (30d)', 'value', v_emails_30d)
    );

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('label', to_char(m.month_start, 'Mon'), 'value', COALESCE(t.total, 0))
      ORDER BY m.month_start
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

  ELSIF p_hub = 'crm' THEN
    SELECT COUNT(*) INTO v_contacts
    FROM business_clients
    WHERE tenant_id = p_tenant_id AND COALESCE(is_active, true) = true;

    SELECT COUNT(*), COALESCE(SUM(value), 0)
    INTO v_active_deals, v_pipeline
    FROM deals
    WHERE tenant_id = p_tenant_id
      AND COALESCE(stage::text, '') NOT IN ('closed_won', 'closed_lost');

    SELECT CASE WHEN COUNT(*) = 0 THEN 0
                ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE COALESCE(stage::text, '') = 'closed_won') / COUNT(*), 0)
           END
    INTO v_conversion
    FROM deals
    WHERE tenant_id = p_tenant_id AND created_at >= v_month_start;

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Contacts', 'value', v_contacts),
      jsonb_build_object('label', 'Active deals', 'value', v_active_deals),
      jsonb_build_object('label', 'Pipeline', 'value', v_pipeline),
      jsonb_build_object('label', 'Win rate (MTD)', 'value', v_conversion::text || '%')
    );

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('label', to_char(m.month_start, 'Mon'), 'value', COALESCE(t.won, 0))
      ORDER BY m.month_start
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
      SELECT date_trunc('month', COALESCE(actual_close_date, created_at)) AS month_start, COUNT(*) AS won
      FROM deals
      WHERE tenant_id = p_tenant_id
        AND COALESCE(stage::text, '') = 'closed_won'
        AND COALESCE(actual_close_date, created_at) >= date_trunc('month', now()) - interval '5 months'
      GROUP BY 1
    ) t ON t.month_start = m.month_start;

  ELSIF p_hub = 'outreach' THEN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL OR COALESCE(status::text, '') = 'opened'),
      COUNT(*) FILTER (WHERE COALESCE(status::text, '') IN ('replied', 'reply'))
    INTO v_emails_30d, v_opened, v_replied
    FROM lead_outreach_log
    WHERE tenant_id = p_tenant_id
      AND created_at >= now() - interval '30 days';

    SELECT COUNT(*) INTO v_meetings FROM calendar_events WHERE tenant_id = p_tenant_id;

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Emails sent', 'value', v_emails_30d),
      jsonb_build_object(
        'label', 'Open rate',
        'value', CASE WHEN v_emails_30d = 0 THEN '0%' ELSE (ROUND(100.0 * v_opened / v_emails_30d, 0)::text || '%') END
      ),
      jsonb_build_object(
        'label', 'Reply rate',
        'value', CASE WHEN v_emails_30d = 0 THEN '0%' ELSE (ROUND(100.0 * v_replied / v_emails_30d, 0)::text || '%') END
      ),
      jsonb_build_object('label', 'Meetings booked', 'value', v_meetings)
    );

  ELSIF p_hub = 'invoicing' THEN
    SELECT
      COALESCE(SUM(total) FILTER (WHERE created_at >= v_month_start), 0),
      COALESCE(SUM(total) FILTER (WHERE COALESCE(status::text, '') = 'paid'), 0),
      COALESCE(SUM(total) FILTER (WHERE COALESCE(status::text, '') IN ('sent', 'overdue', 'draft')), 0),
      COUNT(*) FILTER (WHERE COALESCE(status::text, '') = 'overdue')
    INTO v_invoiced_month, v_collected, v_outstanding, v_overdue_invoices
    FROM business_invoices
    WHERE tenant_id = p_tenant_id;

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Total invoiced', 'value', v_invoiced_month),
      jsonb_build_object('label', 'Collected', 'value', v_collected),
      jsonb_build_object('label', 'Outstanding', 'value', v_outstanding),
      jsonb_build_object('label', 'Overdue count', 'value', v_overdue_invoices)
    );

  ELSIF p_hub = 'contracts' THEN
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(status::text, '') IN ('fully_signed', 'client_signed', 'sent', 'active', 'signed')),
      COUNT(*) FILTER (WHERE end_date IS NOT NULL AND end_date >= now() AND end_date <= now() + interval '30 days'),
      COALESCE(SUM(COALESCE(total_value, contract_value, value, 0)), 0),
      COUNT(*) FILTER (
        WHERE COALESCE(status::text, '') IN ('fully_signed', 'client_signed')
          AND COALESCE(signed_at, created_at) >= v_month_start
      )
    INTO v_active_contracts, v_expiring, v_contract_value, v_signed_mtd
    FROM contracts
    WHERE tenant_id = p_tenant_id;

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Active contracts', 'value', v_active_contracts),
      jsonb_build_object('label', 'Expiring soon', 'value', v_expiring),
      jsonb_build_object('label', 'Total value', 'value', v_contract_value),
      jsonb_build_object('label', 'Signed (MTD)', 'value', v_signed_mtd)
    );

  ELSIF p_hub = 'projects' THEN
    SELECT COUNT(*) INTO v_active_projects
    FROM projects
    WHERE tenant_id = p_tenant_id
      AND COALESCE(status::text, '') NOT IN ('completed', 'cancelled', 'done');

    SELECT
      COUNT(*) FILTER (
        WHERE COALESCE(status::text, '') = 'completed'
          AND COALESCE(completed_at, updated_at, created_at) >= now() - interval '7 days'
      ),
      COUNT(*) FILTER (
        WHERE COALESCE(status::text, '') NOT IN ('completed', 'done', 'cancelled')
          AND due_date IS NOT NULL AND due_date::date < CURRENT_DATE
      )
    INTO v_completed_week, v_overdue_tasks
    FROM tasks
    WHERE tenant_id = p_tenant_id;

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Active projects', 'value', v_active_projects),
      jsonb_build_object('label', 'Tasks completed', 'value', v_completed_week),
      jsonb_build_object('label', 'Overdue tasks', 'value', v_overdue_tasks),
      jsonb_build_object('label', 'Team utilisation', 'value', '0%')
    );

  ELSIF p_hub = 'social' THEN
    SELECT
      COUNT(*) FILTER (
        WHERE COALESCE(status::text, '') = 'published'
          AND COALESCE(published_at, created_at) >= now() - interval '30 days'
      ),
      COUNT(*) FILTER (
        WHERE COALESCE(status::text, '') IN ('scheduled', 'queued', 'draft')
          AND scheduled_at IS NOT NULL
      )
    INTO v_published_30d, v_scheduled
    FROM social_posts
    WHERE tenant_id = p_tenant_id;

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Posts published', 'value', v_published_30d),
      jsonb_build_object('label', 'Total reach', 'value', v_published_30d),
      jsonb_build_object('label', 'Engagement rate', 'value', '0%'),
      jsonb_build_object('label', 'Scheduled posts', 'value', v_scheduled)
    );

  ELSE
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object('metrics', v_metrics, 'mainChart', COALESCE(v_chart, '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.get_hub_kpi_snapshot(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hub_kpi_snapshot(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
