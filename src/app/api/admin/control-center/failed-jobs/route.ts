import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { logPlatformAdminAction } from '@/lib/security/adminAuditLog';

export const dynamic = 'force-dynamic';

const replaySchema = z.object({
  jobId: z.string().uuid(),
  tenantId: z.string().uuid().optional(),
});

/**
 * GET /api/admin/control-center/failed-jobs
 * Lists permanently failed durable jobs and Bonnie tasks across tenants.
 */
export async function GET(req: NextRequest) {
  try {
    await requirePlatformSuperAdmin();
    const admin = createSupabaseAdminClient();
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 100);

    let jobsQuery = admin
      .from('durable_jobs')
      .select('id, tenant_id, job_type, status, attempts, max_attempts, last_error, idempotency_key, created_at, updated_at')
      .in('status', ['failed', 'dead_letter', 'exhausted'])
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (tenantId) {
      jobsQuery = jobsQuery.eq('tenant_id', tenantId);
    }

    const { data: failedJobs, error: jobsError } = await jobsQuery;
    if (jobsError) throw jobsError;

    return NextResponse.json({
      success: true,
      failedJobs: failedJobs || [],
      count: (failedJobs || []).length,
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}

/**
 * POST /api/admin/control-center/failed-jobs
 * Safely replays an individual failed durable job, resetting it to 'pending'
 * while preserving its idempotency_key and lineage.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requirePlatformSuperAdmin();
    const parsed = replaySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { jobId, tenantId } = parsed.data;

    let targetQuery = admin
      .from('durable_jobs')
      .select('id, tenant_id, job_type, status, idempotency_key, attempts, max_attempts')
      .eq('id', jobId);

    if (tenantId) {
      targetQuery = targetQuery.eq('tenant_id', tenantId);
    }

    const { data: job, error: fetchError } = await targetQuery.maybeSingle();
    if (fetchError) throw fetchError;
    if (!job) {
      return NextResponse.json({ error: 'Failed job not found' }, { status: 404 });
    }

    // Guard: Only permanently failed jobs can be safely replayed
    const replayableStatuses = ['failed', 'dead_letter', 'exhausted'];
    if (!replayableStatuses.includes(String(job.status || '').toLowerCase())) {
      return NextResponse.json(
        {
          error: `Cannot replay job with status '${job.status}'. Only failed/dead_letter jobs can be replayed.`,
        },
        { status: 409 }
      );
    }

    // Reset status to pending and schedule execution immediately
    const { error: updateError } = await admin
      .from('durable_jobs')
      .update({
        status: 'pending',
        next_retry_at: new Date().toISOString(),
        last_error: `Replayed by super admin at ${new Date().toISOString()}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateError) throw updateError;

    await logPlatformAdminAction({
      adminUserId: user.id,
      tenantId: job.tenant_id,
      eventType: 'DURABLE_JOB_REPLAY',
      severity: 'info',
      eventDetails: {
        jobId: job.id,
        jobType: job.job_type,
        idempotencyKey: job.idempotency_key,
        priorStatus: job.status,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      newStatus: 'pending',
      replayedAt: new Date().toISOString(),
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
