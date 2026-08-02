import { NextRequest, NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '');
    const { admin } = await requireTenantAccess(tenantId, request);
    const [{ data: invoice, error }, { data: payments, error: paymentError }] = await Promise.all([
      admin.from('business_invoices').select('id,invoice_number,status,total,amount_paid,balance_due,currency,paid_at,client_id').eq('tenant_id', tenantId).eq('id', id).maybeSingle(),
      admin.from('business_invoice_payments').select('id,amount,currency,source,external_reference,created_at').eq('tenant_id', tenantId).eq('invoice_id', id).order('created_at'),
    ]);
    if (error) throw error;
    if (paymentError) throw paymentError;
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (!payments?.length) return NextResponse.json({ error: 'No payment has been recorded for this invoice' }, { status: 409 });
    const { data: client } = invoice.client_id ? await admin.from('business_clients').select('name,email').eq('tenant_id', tenantId).eq('id', invoice.client_id).maybeSingle() : { data: null };
    const currency = invoice.currency || payments[0].currency || 'USD';
    const paid = payments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20); pdf.text('PAYMENT RECEIPT', 20, 24);
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
    const rows = [
      ['Invoice', invoice.invoice_number || invoice.id], ['Customer', client?.name || client?.email || '—'],
      ['Total paid', `${currency} ${paid.toFixed(2)}`], ['Remaining balance', `${currency} ${Number(invoice.balance_due ?? Math.max(0, Number(invoice.total || 0) - paid)).toFixed(2)}`],
      ['Status', String(invoice.status || '').replaceAll('_', ' ').toUpperCase()], ['Generated', `${new Date().toISOString()} UTC`],
    ];
    let y = 38; for (const [label, value] of rows) { pdf.setFont('helvetica', 'bold'); pdf.text(label, 20, y); pdf.setFont('helvetica', 'normal'); pdf.text(String(value), 70, y); y += 9; }
    y += 5; pdf.setFont('helvetica', 'bold'); pdf.text('PAYMENTS', 20, y); y += 8; pdf.setFont('helvetica', 'normal');
    for (const payment of payments) { pdf.text(`${new Date(payment.created_at).toLocaleDateString('en-GB')}  ${currency} ${Number(payment.amount).toFixed(2)}  ${payment.source}${payment.external_reference ? `  ${payment.external_reference}` : ''}`, 20, y); y += 7; }
    const bytes = pdf.output('arraybuffer');
    return new NextResponse(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Receipt_${invoice.invoice_number || id}.pdf"`, 'Cache-Control': 'no-store' } });
  } catch (error) { return routeErrorResponse(error, 'Receipt could not be generated', request); }
}
