-- Railway is the single scheduler for application HTTP cron routes. Remove the
-- legacy pg_cron copies, whose commands also retained a bearer credential.
DO $migration$
DECLARE
  cron_job record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR cron_job IN
      SELECT jobid
      FROM cron.job
      WHERE command LIKE '%alphaclonesystems.com/api/cron/social-publish%'
         OR command LIKE '%alphaclonesystems.com/api/cron/publish-scheduled-posts%'
    LOOP
      PERFORM cron.unschedule(cron_job.jobid);
    END LOOP;

    -- Remove historical command copies so the retired credential is not kept
    -- in pg_cron's run log.
    DELETE FROM cron.job_run_details
    WHERE command LIKE '%alphaclonesystems.com/api/cron/social-publish%'
       OR command LIKE '%alphaclonesystems.com/api/cron/publish-scheduled-posts%';
  END IF;
END
$migration$;

-- Keep template metadata derived from the actual subject/body placeholders.
-- This covers both platform templates and tenant-created templates.
WITH extracted AS (
  SELECT
    template.id,
    COALESCE(
      jsonb_agg(DISTINCT match.placeholder ORDER BY match.placeholder)
        FILTER (WHERE match.placeholder IS NOT NULL),
      '[]'::jsonb
    ) AS actual_variables
  FROM public.email_templates AS template
  LEFT JOIN LATERAL (
    SELECT captures[1] AS placeholder
    FROM regexp_matches(
      concat_ws(E'\n', template.subject, template.body_html, template.body_text),
      '\{\{([A-Za-z0-9_.]+)\}\}',
      'g'
    ) AS captures
  ) AS match ON true
  GROUP BY template.id
)
UPDATE public.email_templates AS template
SET variables = extracted.actual_variables,
    updated_at = now()
FROM extracted
WHERE template.id = extracted.id
  AND template.variables IS DISTINCT FROM extracted.actual_variables;
