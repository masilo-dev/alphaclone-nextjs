import { NextRequest, NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '');
    const { admin } = await requireTenantAccess(tenantId, request);
    const { data: selected, error } = await admin.from('business_invoices').select('client_id,invoice_number').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!selected) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (!selected.client_id) return NextResponse.json({ error: 'Invoice has no linked customer for a statement' }, { status: 409 });
    const [{ data: client }, { data: invoices, error: invoiceError }] = await Promise.all([
      admin.from('business_clients').select('name,email').eq('tenant_id', tenantId).eq('id', selected.client_id).maybeSingle(),
      admin.from('business_invoices').select('id,invoice_number,issue_date,due_date,status,total,amount_paid,balance_due,currency').eq('tenant_id', tenantId).eq('client_id', selected.client_id).order('issue_date'),
    ]);
    if (invoiceError) throw invoiceError;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20); pdf.text('CUSTOMER STATEMENT', 20, 24);
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.text(client?.name || client?.email || 'Customer', 20, 34); pdf.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, 20, 41);
    let y = 55;
    const totals = new Map<string, { invoiced: number; paid: number; outstanding: number }>();
    pdf.setFont('helvetica', 'bold'); pdf.text('Invoice', 20, y); pdf.text('Issue', 58, y); pdf.text('Status', 86, y); pdf.text('Total', 126, y); pdf.text('Balance', 160, y); y += 7; pdf.setFont('helvetica', 'normal');
    for (const invoice of invoices || []) { if (y > 275) { pdf.addPage(); y = 20; } const currency = invoice.currency || 'USD'; const rowTotal = Number(invoice.total || 0); const rowPaid = Number(invoice.amount_paid || 0); const rowBalance = Number(invoice.balance_due ?? Math.max(0, rowTotal - rowPaid)); const aggregate = totals.get(currency) || { invoiced: 0, paid: 0, outstanding: 0 }; aggregate.invoiced += rowTotal; aggregate.paid += rowPaid; aggregate.outstanding += rowBalance; totals.set(currency, aggregate); pdf.text(String(invoice.invoice_number || invoice.id).slice(0, 18), 20, y); pdf.text(String(invoice.issue_date || '—'), 58, y); pdf.text(String(invoice.status || '—').slice(0, 16), 86, y); pdf.text(`${currency} ${rowTotal.toFixed(2)}`, 126, y); pdf.text(`${currency} ${rowBalance.toFixed(2)}`, 160, y); y += 7; }
    y += 5; pdf.setFont('helvetica', 'bold');
    for (const [currency, aggregate] of totals) { if (y > 275) { pdf.addPage(); y = 20; } pdf.text(`${currency} — Invoiced: ${aggregate.invoiced.toFixed(2)}   Paid: ${aggregate.paid.toFixed(2)}   Outstanding: ${aggregate.outstanding.toFixed(2)}`, 20, y); y += 7; }
    const bytes = pdf.output('arraybuffer');
    return new NextResponse(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Statement_${String(client?.name || selected.client_id).replace(/[^a-z0-9_-]/gi, '_')}.pdf"`, 'Cache-Control': 'no-store' } });
  } catch (error) { return routeErrorResponse(error, 'Statement could not be generated', request); }
}
