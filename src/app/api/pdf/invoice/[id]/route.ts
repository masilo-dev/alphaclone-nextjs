import { NextRequest, NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

function sanitizeFilename(input: string): string {
    return input.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveRelatedName(value: unknown, fallback: string): string {
    if (Array.isArray(value)) {
        const first = value[0] as { name?: unknown } | undefined;
        return typeof first?.name === 'string' && first.name.trim().length > 0 ? first.name : fallback;
    }
    if (value && typeof value === 'object') {
        const maybe = value as { name?: unknown };
        return typeof maybe.name === 'string' && maybe.name.trim().length > 0 ? maybe.name : fallback;
    }
    return fallback;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const admin = createSupabaseAdminClient();

        const { data: invoice, error } = await admin
            .from('business_invoices')
            .select(`
                id,
                invoice_number,
                issue_date,
                due_date,
                status,
                subtotal,
                tax,
                total,
                line_items,
                is_public,
                tenant:tenant_id (name),
                client:client_id (name)
            `)
            .eq('id', id)
            .single();

        if (error || !invoice || !invoice.is_public) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        doc.setFontSize(18);
        doc.text('INVOICE', 20, 20);
        doc.setFontSize(11);
        doc.text(`Invoice: ${invoice.invoice_number}`, 20, 30);
        doc.text(`Issue Date: ${invoice.issue_date}`, 20, 36);
        doc.text(`Due Date: ${invoice.due_date}`, 20, 42);
        doc.text(`Status: ${invoice.status}`, 20, 48);
        const clientDisplayName = resolveRelatedName(invoice.client, 'Unknown Client');
        doc.text(`Client: ${clientDisplayName}`, 20, 54);

        const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
        let cursorY = 66;
        doc.setFontSize(10);
        doc.text('Description', 20, cursorY);
        doc.text('Qty', 120, cursorY);
        doc.text('Rate', 145, cursorY);
        doc.text('Amount', 175, cursorY, { align: 'right' });
        cursorY += 6;
        doc.line(20, cursorY, 190, cursorY);
        cursorY += 6;

        for (const item of items as Array<{ description?: string; quantity?: number; rate?: number; amount?: number }>) {
            doc.text(String(item.description || ''), 20, cursorY);
            doc.text(String(item.quantity || 0), 120, cursorY);
            doc.text(Number(item.rate || 0).toFixed(2), 145, cursorY);
            doc.text(Number(item.amount || 0).toFixed(2), 175, cursorY, { align: 'right' });
            cursorY += 6;
            if (cursorY > 260) {
                doc.addPage();
                cursorY = 20;
            }
        }

        cursorY += 8;
        doc.line(120, cursorY, 190, cursorY);
        cursorY += 8;
        doc.text(`Subtotal: ${Number(invoice.subtotal || 0).toFixed(2)}`, 120, cursorY);
        cursorY += 6;
        doc.text(`Tax: ${Number(invoice.tax || 0).toFixed(2)}`, 120, cursorY);
        cursorY += 6;
        doc.setFontSize(12);
        doc.text(`Total: ${Number(invoice.total || 0).toFixed(2)}`, 120, cursorY);

        const invoiceNumber = sanitizeFilename(invoice.invoice_number || 'INVOICE');
        const clientName = sanitizeFilename(resolveRelatedName(invoice.client, 'Client'));
        const filename = `${invoiceNumber}_${clientName}.pdf`;
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error('[api/pdf/invoice] failed:', error);
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
}
