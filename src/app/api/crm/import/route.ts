import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { ImportJobService, type RawImportRecord } from '@/services/importJobService';

function splitCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            const next = line[i + 1];
            if (inQuotes && next === '"') {
                current += '"';
                i++;
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }
        if (ch === ',' && !inQuotes) {
            cells.push(current);
            current = '';
            continue;
        }
        current += ch;
    }

    cells.push(current);
    return cells.map((c) => c.trim());
}

function parseCsv(text: string): RawImportRecord[] {
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trimEnd())
        .filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const headers = splitCsvLine(lines[0] || '').map((h) => h.trim());
    const rows: RawImportRecord[] = [];
    for (const line of lines.slice(1)) {
        const cells = splitCsvLine(line);
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
            if (!header) return;
            row[header] = String(cells[index] || '').trim();
        });
        rows.push(row);
    }
    return rows;
}

/**
 * GET /api/crm/import?tenantId=...&jobId=...
 * Query background import job progress.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get('tenantId');
        const jobId = searchParams.get('jobId');

        if (!tenantId || !jobId) {
            return NextResponse.json({ error: 'tenantId and jobId are required' }, { status: 400 });
        }

        await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin', 'member'], req);

        const status = await ImportJobService.getJobStatus(jobId, tenantId);
        if (!status) {
            return NextResponse.json({ error: 'Import job not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, job: status });
    } catch (error: any) {
        return routeErrorResponse(error, 'Failed to fetch import job status');
    }
}

/**
 * POST /api/crm/import
 * Durable, asynchronous background execution for CRM imports.
 * Returns HTTP 202 with job_id immediately to prevent timeout.
 */
export async function POST(req: NextRequest) {
    try {
        const contentType = req.headers.get('content-type') || '';
        let tenantId = '';
        let fileName = 'upload.csv';
        let records: RawImportRecord[] = [];
        let idempotencyKey: string | undefined;

        if (contentType.includes('application/json')) {
            const body = await req.json();
            tenantId = body.tenantId || body.tenant_id;
            fileName = body.fileName || body.file_name || 'import.json';
            records = Array.isArray(body.records) ? body.records : [];
            idempotencyKey = body.idempotencyKey || body.idempotency_key;
        } else {
            const formData = await req.formData();
            tenantId = formData.get('tenantId') as string;
            idempotencyKey = (formData.get('idempotencyKey') as string) || undefined;
            const file = formData.get('file') as File;

            if (!file) {
                return NextResponse.json({ error: 'No file provided' }, { status: 400 });
            }

            const isCsv = file.type.includes('csv') || file.name.toLowerCase().endsWith('.csv');
            if (!isCsv) {
                return NextResponse.json(
                    { error: 'Only CSV imports are supported. Please export as CSV and re-upload.' },
                    { status: 400 }
                );
            }

            fileName = file.name;
            records = parseCsv(await file.text());
        }

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        // Security check: verify user belongs to tenant with authorized role
        const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);

        if (records.length === 0) {
            return NextResponse.json({ error: 'File is empty or contains no valid rows' }, { status: 400 });
        }

        // Create durable background job
        const job = await ImportJobService.createJob({
            tenantId,
            userId: user?.id,
            importType: 'csv',
            fileName,
            records,
            idempotencyKey,
        });

        const { searchParams } = new URL(req.url);
        const isSync = searchParams.get('sync') === 'true' && records.length <= 50;

        if (isSync) {
            const finished = await ImportJobService.processJob(job.id, tenantId);
            return NextResponse.json({
                success: true,
                job_id: finished.id,
                status: finished.status,
                total_records: finished.total_records,
                created_count: finished.created_count,
                duplicate_count: finished.duplicate_count,
                failed_count: finished.failed_count,
                message: `${finished.created_count} records processed successfully`,
            });
        }

        // Asynchronous background execution (fire and forget worker with monitoring)
        ImportJobService.processJob(job.id, tenantId).catch((err) => {
            console.error(`Background import job ${job.id} encountered error:`, err);
            Sentry.captureException(err, { tags: { service: 'crm_import', jobId: job.id } });
        });

        // Immediately respond with 202 Accepted and job tracking information
        return NextResponse.json(
            {
                success: true,
                job_id: job.id,
                status: job.status,
                total_records: job.total_records,
                message: `Import job queued with ${job.total_records} records. Track progress via /api/crm/import/jobs/${job.id}`,
            },
            { status: 202 }
        );
    } catch (error: any) {
        console.error('CRM import fatal error:', error);
        Sentry.captureException(error, { tags: { service: 'crm_import', op: 'fatal' } });
        return routeErrorResponse(error, 'Import failed');
    }
}
