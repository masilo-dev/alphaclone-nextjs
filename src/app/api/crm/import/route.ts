import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { ENV } from '@/config/env';

export async function POST(req: NextRequest) {
    try {
        const supabaseAdmin = createClient(
            ENV.VITE_SUPABASE_URL,
            ENV.SUPABASE_SERVICE_ROLE_KEY
        );

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const tenantId = formData.get('tenantId') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
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
            stage: item.Stage || item.stage || 'lead',
            value: parseFloat(item.Value || item.value || '0'),
            notes: item.Notes || item.notes || null,
            updated_at: new Date().toISOString()
        })).filter(client => client.name); // Ensure name is present

        if (clients.length === 0) {
            return NextResponse.json({ error: 'No valid client data found' }, { status: 400 });
        }

        // Upsert into business_clients
        const { error } = await supabaseAdmin
            .from('business_clients')
            .upsert(clients, { onConflict: 'tenant_id, email' });

        if (error) {
            console.error('Import error:', error);
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
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
