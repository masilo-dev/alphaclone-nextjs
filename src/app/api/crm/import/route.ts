import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as Sentry from '@sentry/nextjs';
import { requireTenantAccess, routeErrorResponse, createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';

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
        await requireTenantAccess(tenantId);
        
        // Use the admin client for cross-RLS import operations
        const supabaseAdmin = createAdminSupabaseClientOrThrow();

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

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
            return NextResponse.json({ error: 'Failed to import clients', details: error.message }, { status: 500 });
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
