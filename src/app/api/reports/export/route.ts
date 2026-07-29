import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
<<<<<<< HEAD
=======
import ExcelJS from 'exceljs';
>>>>>>> origin/main
import { jsPDF } from 'jspdf';
import 'jspdf-autotable'; // Note: This might need a separate import if not bundled

function toCsvValue(value: unknown): string {
    const raw = value == null ? '' : String(value);
    const escaped = raw.replace(/"/g, '""');
    if (/[",\r\n]/.test(escaped)) return `"${escaped}"`;
    return escaped;
}

function toCsv(rows: any[]): string {
    if (!rows || rows.length === 0) return '';
    const headers = Object.keys(rows[0] || {});
    const lines: string[] = [];
    lines.push(headers.map((h) => toCsvValue(h)).join(','));
    for (const row of rows) {
        lines.push(headers.map((h) => toCsvValue(row?.[h])).join(','));
    }
    return lines.join('\n');
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || 'pdf'; // pdf or csv
        const category = searchParams.get('category') || 'revenue'; // revenue, clients, activity
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        const { supabase } = await requireTenantAccess(tenantId);
        let data: any[] = [];
        let fileName = `report_${category}_${new Date().toISOString().split('T')[0]}`;

        // 1. Fetch data based on category
        if (category === 'revenue') {
            const { data: invoices, error } = await supabase
                .from('business_invoices')
                .select('invoice_number, client_id, total, status, issue_date, due_date')
                .eq('tenant_id', tenantId)
                .order('issue_date', { ascending: false });

            if (error) throw error;
            data = invoices || [];
        } else if (category === 'clients') {
            const { data: clients, error } = await supabase
                .from('business_clients')
                .select('name, email, phone, company, stage, value, created_at')
                .eq('tenant_id', tenantId)
                .order('name', { ascending: true });

            if (error) throw error;
            data = clients || [];
        } else if (category === 'activity') {
            const { data: deals, error } = await supabase
                .from('activity_logs')
                .select('action, metadata, created_at')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(1000);

            if (error) throw error;
            data = deals.map((a: any) => ({
                action: a.action,
                timestamp: a.created_at,
                metadata: JSON.stringify(a.metadata),
            }));
        }

        if (data.length === 0) {
            return NextResponse.json({ error: 'No data to export' }, { status: 404 });
        }

        // 2. Generate Export
<<<<<<< HEAD
        if (type === 'csv' || type === 'xlsx') {
            const csv = toCsv(data);
            return new NextResponse(csv, {
=======
        if (type === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet(category.charAt(0).toUpperCase() + category.slice(1));

            const headers = Object.keys(data[0] || {});
            sheet.columns = headers.map((key) => ({ header: key, key }));
            for (const row of data) {
                sheet.addRow(row);
            }

            sheet.getRow(1).font = { bold: true };

            const buffer = await workbook.xlsx.writeBuffer();

            return new NextResponse(Buffer.from(buffer), {
>>>>>>> origin/main
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename=${fileName}.csv`,
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

            const headers = Object.keys(data[0]);
            const body = data.map(row => Object.values(row));

            (doc as any).autoTable({
                head: [headers],
                body: body,
                startY: 40,
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
        return routeErrorResponse(error, 'Failed to export report', req);
    }
}
