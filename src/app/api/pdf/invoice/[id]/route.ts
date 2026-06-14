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
                client_name,
                client_email,
                issue_date,
                due_date,
                status,
                subtotal,
                tax,
                total,
                notes,
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
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const brand = '#0f172a';
        const accent = '#14b8a6';

        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 34, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE', 20, 16);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`#${invoice.invoice_number}`, 20, 24);
        doc.setFontSize(12);
        doc.text(String(invoice.tenant?.name || 'AlphaClone Systems'), pageWidth - 20, 16, { align: 'right' });
        doc.setFontSize(9);
        doc.text('Invoice & Payment Document', pageWidth - 20, 24, { align: 'right' });

        const clientDisplayName = invoice.client_name || resolveRelatedName(invoice.client, 'Unknown Client');
        const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
        let cursorY = 46;

        const chip = (label: string, value: string, x: number, y: number, width: number) => {
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(x, y, width, 18, 3, 3);
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(label.toUpperCase(), x + 3, y + 6);
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.text(value, x + 3, y + 13);
            doc.setFont('helvetica', 'normal');
        };

        chip('Issue date', String(invoice.issue_date || '-'), 20, cursorY, 58);
        chip('Due date', String(invoice.due_date || '-'), 80, cursorY, 50);
        chip('Status', String(invoice.status || '-'), 132, cursorY, 58);
        cursorY += 26;

        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text('Bill To', 20, cursorY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(clientDisplayName, 20, cursorY + 6);
        if (invoice.client_email) {
            doc.text(String(invoice.client_email), 20, cursorY + 12);
        }

        const tableStart = cursorY + 22;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(209, 213, 219);
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.rect(20, tableStart, 170, 8, 'F');
        doc.text('Description', 23, tableStart + 5.5);
        doc.text('Qty', 120, tableStart + 5.5);
        doc.text('Rate', 145, tableStart + 5.5);
        doc.text('Amount', 183, tableStart + 5.5, { align: 'right' });

        let rowY = tableStart + 12;
        doc.setFont('helvetica', 'normal');
        for (const item of items as Array<{ description?: string; quantity?: number; rate?: number; amount?: number }>) {
            if (rowY > 260) {
                doc.addPage();
                rowY = 20;
            }
            doc.setDrawColor(226, 232, 240);
            doc.line(20, rowY + 4, 190, rowY + 4);
            doc.text(String(item.description || ''), 23, rowY);
            doc.text(String(item.quantity || 0), 120, rowY);
            doc.text(Number(item.rate || 0).toFixed(2), 145, rowY);
            doc.text(Number(item.amount || 0).toFixed(2), 183, rowY, { align: 'right' });
            rowY += 8;
        }

        const totalsY = rowY + 8;
        doc.setDrawColor(226, 232, 240);
        doc.line(120, totalsY, 190, totalsY);
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text('Subtotal', 120, totalsY + 7);
        doc.text(Number(invoice.subtotal || 0).toFixed(2), 190, totalsY + 7, { align: 'right' });
        doc.text('Tax', 120, totalsY + 13);
        doc.text(Number(invoice.tax || 0).toFixed(2), 190, totalsY + 13, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Total', 120, totalsY + 22);
        doc.setTextColor(accent);
        doc.text(Number(invoice.total || 0).toFixed(2), 190, totalsY + 22, { align: 'right' });

        if (invoice.notes) {
            const noteText = doc.splitTextToSize(`Notes: ${String(invoice.notes)}`, 170);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text(noteText, 20, Math.min(totalsY + 35, 268));
        }

        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('Generated via AlphaClone Systems', pageWidth / 2, pageHeight - 8, { align: 'center' });
        doc.text(`Page 1 of 1`, pageWidth - 20, pageHeight - 8, { align: 'right' });

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
