import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
<<<<<<< HEAD
=======
import ExcelJS from 'exceljs';
>>>>>>> origin/main
import * as Sentry from '@sentry/nextjs';
import { requireTenantRole, routeErrorResponse, createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';

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

function parseCsv(text: string): Array<Record<string, string>> {
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trimEnd())
        .filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const headers = splitCsvLine(lines[0] || '').map((h) => h.trim());
    const rows: Array<Record<string, string>> = [];
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

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const tenantId = formData.get('tenantId') as string;

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        // "?"? SECURITY CHECK "?"?
        // Verifies user is authenticated and belongs to the requested tenant
        await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
        
        // Use the admin client for cross-RLS import operations
        const supabaseAdmin = createAdminSupabaseClientOrThrow();

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

<<<<<<< HEAD
        const isCsv = file.type.includes('csv') || file.name.toLowerCase().endsWith('.csv');
        if (!isCsv) {
            return NextResponse.json({ error: 'Only CSV imports are supported. Please export as CSV and re-upload.' }, { status: 400 });
        }

        const data = parseCsv(await file.text());
=======
        const buffer = new Uint8Array(await file.arrayBuffer());
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            return NextResponse.json({ error: 'Workbook has no sheets' }, { status: 400 });
        }

        const normalizeCell = (value: unknown) => {
            if (value == null) return '';
            if (typeof value === 'string') return value;
            if (typeof value === 'number') return value;
            if (typeof value === 'boolean') return value ? 'true' : 'false';
            if (value instanceof Date) return value.toISOString();
            if (typeof value === 'object' && value && 'text' in (value as any)) return String((value as any).text || '');
            if (typeof value === 'object' && value && 'result' in (value as any)) return String((value as any).result || '');
            return String(value);
        };

        const headerRow = worksheet.getRow(1);
        const headers = (headerRow.values as any[]).slice(1).map((h) => String(normalizeCell(h)).trim());
        const data: Record<string, unknown>[] = [];
        for (let r = 2; r <= worksheet.rowCount; r++) {
            const row = worksheet.getRow(r);
            const obj: Record<string, unknown> = {};
            let hasAny = false;
            for (let c = 0; c < headers.length; c++) {
                const key = headers[c] || `Column${c + 1}`;
                const raw = row.getCell(c + 1).value;
                const cellValue = normalizeCell(raw);
                if (cellValue !== '' && cellValue !== null && cellValue !== undefined) hasAny = true;
                obj[key] = cellValue;
            }
            if (hasAny) data.push(obj);
        }
>>>>>>> origin/main

        if (data.length === 0) {
            return NextResponse.json({ error: 'File is empty' }, { status: 400 });
        }

        // Map data to business_clients schema
        const clients = data.map((item: any) => ({
            tenant_id: tenantId,
            name: item.Name || item.name || '',
            email: item.Email || item.email || null,
            phone: item.Phone || item.phone || null,
            company: item.Company || item.company || null,
            sales_stage: item.Stage || item.stage || 'lead',
            value: parseFloat(String(item.Value || item.value || '0').replace(/[^0-9.]/g, '')),
            description: item.Notes || item.notes || item.Description || item.description || null,
            updated_at: new Date().toISOString()
        })).filter(client => client.name); // Ensure name is present

        if (clients.length === 0) {
            return NextResponse.json({ error: 'No valid client data found' }, { status: 400 });
        }

        // Upsert into business_clients using privileged client
        const { error } = await supabaseAdmin
            .from('business_clients')
            .upsert(clients, { onConflict: 'tenant_id, email' });

        if (error) {
            console.error('Import error:', error);
            Sentry.captureException(error, { tags: { service: 'crm_import', op: 'upsert' } });
            return clientErrorResponse(error, { request: req, scope: 'crm/import' });
        }

        // Log activity
        await supabaseAdmin.from('activity_logs').insert({
            tenant_id: tenantId,
            action: 'crm_client_import',
            metadata: {
                file_name: file.name,
                count: clients.length
            }
        });

        return NextResponse.json({
            success: true,
            count: clients.length,
            message: `${clients.length} clients imported successfully`
        });

    } catch (error: any) {
        console.error('CRM import fatal error:', error);
        Sentry.captureException(error, { tags: { service: 'crm_import', op: 'fatal' } });
        return routeErrorResponse(error, 'Import failed');
    }
}
