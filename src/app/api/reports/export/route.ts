import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseServer';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable'; // Note: This might need a separate import if not bundled

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || 'pdf'; // pdf or xlsx
        const category = searchParams.get('category') || 'revenue'; // revenue, clients, activity
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient();
        let data: any[] = [];
        let fileName = `report_${category}_${new Date().toISOString().split('T')[0]}`;

        // 1. Fetch data based on category
        if (category === 'revenue') {
            const { data: invoices, error } = await supabaseAdmin
                .from('business_invoices')
                .select('invoice_number, client_id, total, status, issue_date, due_date')
                .eq('tenant_id', tenantId)
                .order('issue_date', { ascending: false });

            if (error) throw error;
            data = invoices || [];
        } else if (category === 'clients') {
            const { data: clients, error } = await supabaseAdmin
                .from('business_clients')
                .select('name, email, phone, company, stage, value, created_at')
                .eq('tenant_id', tenantId)
                .order('name', { ascending: true });

            if (error) throw error;
            data = clients || [];
        } else if (category === 'activity') {
            const { data: activities, error } = await supabaseAdmin
                .from('activity_logs')
                .select('action, metadata, created_at')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(1000);

            if (error) throw error;
            data = activities.map(a => ({
                action: a.action,
                timestamp: a.created_at,
                details: JSON.stringify(a.metadata)
            }));
        }

        if (data.length === 0) {
            return NextResponse.json({ error: 'No data to export' }, { status: 404 });
        }

        // 2. Generate Export
        if (type === 'xlsx') {
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, category.charAt(0).toUpperCase() + category.slice(1));

            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename=${fileName}.xlsx`,
                },
            });
        } else {
            // PDF generation
            const doc = new jsPDF() as any;
            doc.setFontSize(18);
            doc.text(`${category.toUpperCase()} REPORT`, 14, 22);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
            doc.text(`Tenant ID: ${tenantId}`, 14, 35);

            const headers = Object.keys(data[0]);
            const body = data.map(row => Object.values(row));

            (doc as any).autoTable({
                head: [headers],
                body: body,
                startY: 45,
                theme: 'striped',
                headStyles: { fillColor: [45, 212, 191] }, // Teal-400
            });

            const pdfOutput = doc.output('arraybuffer');

            return new NextResponse(pdfOutput, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename=${fileName}.pdf`,
                },
            });
        }

    } catch (error: any) {
        console.error('Export Error:', error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
