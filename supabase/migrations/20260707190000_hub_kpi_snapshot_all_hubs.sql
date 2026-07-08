-- Extend get_hub_kpi_snapshot to all dashboard hubs (single fast RPC per hub)

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

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Invoiced (MTD)', 'value', v_invoiced_month),
      jsonb_build_object('label', 'Active deals', 'value', v_active_deals),
      jsonb_build_object('label', 'Open tasks', 'value', v_open_tasks),
      jsonb_build_object('label', 'Emails (30d)', 'value', v_emails_30d)
    );

    IF to_regclass('public.business_invoices') IS NOT NULL THEN
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
      WHERE tenant_id = p_tenant_id AND created_at >= v_month_start;
    END IF;

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Contacts', 'value', v_contacts),
      jsonb_build_object('label', 'Active deals', 'value', v_active_deals),
      jsonb_build_object('label', 'Pipeline', 'value', v_pipeline),
      jsonb_build_object('label', 'Win rate (MTD)', 'value', v_conversion::text || '%')
    );

    IF to_regclass('public.business_deals') IS NOT NULL THEN
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
        FROM business_deals
        WHERE tenant_id = p_tenant_id
          AND COALESCE(stage::text, '') = 'closed_won'
          AND COALESCE(actual_close_date, created_at) >= date_trunc('month', now()) - interval '5 months'
        GROUP BY 1
      ) t ON t.month_start = m.month_start;
    END IF;

  ELSIF p_hub = 'outreach' THEN
    IF to_regclass('public.lead_outreach_log') IS NOT NULL THEN
      SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL OR COALESCE(status::text, '') = 'opened'),
        COUNT(*) FILTER (WHERE COALESCE(status::text, '') IN ('replied', 'reply'))
      INTO v_emails_30d, v_opened, v_replied
      FROM lead_outreach_log
      WHERE tenant_id = p_tenant_id
        AND created_at >= now() - interval '30 days';

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('label', to_char(d.day_start, 'Mon DD'), 'value', COALESCE(t.cnt, 0))
        ORDER BY d.day_start
      ), '[]'::jsonb)
      INTO v_chart
      FROM (
        SELECT generate_series(
          date_trunc('day', now()) - interval '13 days',
          date_trunc('day', now()),
          interval '1 day'
        ) AS day_start
      ) d
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day_start, COUNT(*) AS cnt
        FROM lead_outreach_log
        WHERE tenant_id = p_tenant_id
          AND created_at >= now() - interval '14 days'
        GROUP BY 1
      ) t ON t.day_start = d.day_start;
    END IF;

    IF to_regclass('public.calendar_events') IS NOT NULL THEN
      SELECT COUNT(*) INTO v_meetings
      FROM calendar_events
      WHERE tenant_id = p_tenant_id;
    END IF;

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
    IF to_regclass('public.business_invoices') IS NOT NULL THEN
      SELECT
        COALESCE(SUM(total) FILTER (WHERE created_at >= v_month_start), 0),
        COALESCE(SUM(total) FILTER (WHERE COALESCE(status::text, '') = 'paid'), 0),
        COALESCE(SUM(total) FILTER (WHERE COALESCE(status::text, '') IN ('sent', 'overdue', 'draft')), 0),
        COUNT(*) FILTER (WHERE COALESCE(status::text, '') = 'overdue')
      INTO v_invoiced_month, v_collected, v_outstanding, v_overdue_invoices
      FROM business_invoices
      WHERE tenant_id = p_tenant_id;

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'label', to_char(m.month_start, 'Mon'),
          'value', COALESCE(i.total, 0),
          'value2', COALESCE(c.total, 0)
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
      ) i ON i.month_start = m.month_start
      LEFT JOIN (
        SELECT date_trunc('month', COALESCE(paid_at, created_at)) AS month_start, SUM(total) AS total
        FROM business_invoices
        WHERE tenant_id = p_tenant_id
          AND COALESCE(status::text, '') = 'paid'
          AND COALESCE(paid_at, created_at) >= date_trunc('month', now()) - interval '5 months'
        GROUP BY 1
      ) c ON c.month_start = m.month_start;
    END IF;

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Total invoiced', 'value', v_invoiced_month),
      jsonb_build_object('label', 'Collected', 'value', v_collected),
      jsonb_build_object('label', 'Outstanding', 'value', v_outstanding),
      jsonb_build_object('label', 'Overdue count', 'value', v_overdue_invoices)
    );

  ELSIF p_hub = 'contracts' THEN
    IF to_regclass('public.contracts') IS NOT NULL THEN
      SELECT
        COUNT(*) FILTER (WHERE COALESCE(status::text, '') IN ('fully_signed', 'client_signed', 'sent', 'active', 'signed')),
        COUNT(*) FILTER (
          WHERE end_date IS NOT NULL
            AND end_date >= now()
            AND end_date <= now() + interval '30 days'
        ),
        COALESCE(SUM(COALESCE(total_value, contract_value, value, 0)), 0),
        COUNT(*) FILTER (
          WHERE COALESCE(status::text, '') IN ('fully_signed', 'client_signed')
            AND COALESCE(signed_at, created_at) >= v_month_start
        )
      INTO v_active_contracts, v_expiring, v_contract_value, v_signed_mtd
      FROM contracts
      WHERE tenant_id = p_tenant_id;

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('label', to_char(m.month_start, 'Mon'), 'value', COALESCE(t.cnt, 0))
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
        SELECT date_trunc('month', COALESCE(signed_at, created_at)) AS month_start, COUNT(*) AS cnt
        FROM contracts
        WHERE tenant_id = p_tenant_id
          AND COALESCE(status::text, '') IN ('fully_signed', 'client_signed')
          AND COALESCE(signed_at, created_at) >= date_trunc('month', now()) - interval '5 months'
        GROUP BY 1
      ) t ON t.month_start = m.month_start;
    END IF;

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Active contracts', 'value', v_active_contracts),
      jsonb_build_object('label', 'Expiring soon', 'value', v_expiring),
      jsonb_build_object('label', 'Total value', 'value', v_contract_value),
      jsonb_build_object('label', 'Signed (MTD)', 'value', v_signed_mtd)
    );

  ELSIF p_hub = 'projects' THEN
    IF to_regclass('public.projects') IS NOT NULL THEN
      SELECT COUNT(*) INTO v_active_projects
      FROM projects
      WHERE tenant_id = p_tenant_id
        AND COALESCE(status::text, '') NOT IN ('completed', 'cancelled', 'done');
    END IF;

    IF to_regclass('public.tasks') IS NOT NULL THEN
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(status::text, '') = 'completed'
            AND COALESCE(completed_at, updated_at, created_at) >= now() - interval '7 days'
        ),
        COUNT(*) FILTER (
          WHERE COALESCE(status::text, '') NOT IN ('completed', 'done', 'cancelled')
            AND due_date IS NOT NULL
            AND due_date::date < CURRENT_DATE
        ),
        CASE WHEN COUNT(*) = 0 THEN 0
             ELSE ROUND(
               100.0 * COUNT(*) FILTER (
                 WHERE assigned_to IS NOT NULL
                   AND COALESCE(status::text, '') NOT IN ('completed', 'done', 'cancelled')
               ) / COUNT(*), 0)
        END
      INTO v_completed_week, v_overdue_tasks, v_utilisation
      FROM tasks
      WHERE tenant_id = p_tenant_id;

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('label', 'W' || w.idx::text, 'value', COALESCE(t.cnt, 0))
        ORDER BY w.week_start
      ), '[]'::jsonb)
      INTO v_chart
      FROM (
        SELECT week_start, ROW_NUMBER() OVER (ORDER BY week_start) AS idx
        FROM (
          SELECT generate_series(
            date_trunc('week', now()) - interval '7 weeks',
            date_trunc('week', now()),
            interval '1 week'
          ) AS week_start
        ) weeks
      ) w
      LEFT JOIN (
        SELECT date_trunc('week', COALESCE(completed_at, updated_at, created_at)) AS week_start, COUNT(*) AS cnt
        FROM tasks
        WHERE tenant_id = p_tenant_id
          AND COALESCE(status::text, '') = 'completed'
          AND COALESCE(completed_at, updated_at, created_at) >= date_trunc('week', now()) - interval '7 weeks'
        GROUP BY 1
      ) t ON t.week_start = w.week_start;
    END IF;

    v_metrics := jsonb_build_array(
      jsonb_build_object('label', 'Active projects', 'value', v_active_projects),
      jsonb_build_object('label', 'Tasks completed', 'value', v_completed_week),
      jsonb_build_object('label', 'Overdue tasks', 'value', v_overdue_tasks),
      jsonb_build_object('label', 'Team utilisation', 'value', v_utilisation::text || '%')
    );

  ELSIF p_hub = 'social' THEN
    IF to_regclass('public.social_posts') IS NOT NULL THEN
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

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('label', to_char(d.day_start, 'Mon DD'), 'value', COALESCE(t.cnt, 0))
        ORDER BY d.day_start
      ), '[]'::jsonb)
      INTO v_chart
      FROM (
        SELECT generate_series(
          date_trunc('day', now()) - interval '13 days',
          date_trunc('day', now()),
          interval '1 day'
        ) AS day_start
      ) d
      LEFT JOIN (
        SELECT date_trunc('day', COALESCE(published_at, created_at)) AS day_start, COUNT(*) AS cnt
        FROM social_posts
        WHERE tenant_id = p_tenant_id
          AND COALESCE(status::text, '') = 'published'
          AND COALESCE(published_at, created_at) >= now() - interval '14 days'
        GROUP BY 1
      ) t ON t.day_start = d.day_start;
    END IF;

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
GRANT EXECUTE ON FUNCTION public.get_hub_kpi_snapshot(uuid, text) TO service_role;

COMMIT;
