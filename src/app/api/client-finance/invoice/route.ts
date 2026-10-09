import { NextRequest, NextResponse } from 'next/server';
import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireClientPortalAccessDoubleGuarded } from '@/lib/auth/clientPortalAuth';
import { resolveClientByPortalToken } from '@/services/finance/clientFinancePortalService';
import { portalInvoiceBilling } from '@/lib/clientPortal/billing';
import { escapeHtml } from '@/lib/email/escapeHtml';
import { extractTenantBranding } from '@/lib/tenantBranding';
import { generateThemedInvoicePdfBuffer } from '@/lib/documents/themedDocumentPdf';
import { isUuid } from '@/lib/tenant/platformTenant';

export const dynamic = 'force-dynamic';
const headers = {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const id = req.nextUrl.searchParams.get('invoiceId') || '';
  if (!isUuid(token) || !isUuid(id)) return NextResponse.json({error:'A valid portal and invoice reference are required'},{status:400,headers});
  try {
    const admin = await resolveSupabaseAdminClient();
    const access = await requireClientPortalAccessDoubleGuarded(admin,token,resolveClientByPortalToken);
    if (!access.ok) return NextResponse.json({error:'Sign in to your client workspace to view this invoice',code:access.error.code},{status:access.error.http,headers});
    const client = access.resolvedClient;
    const {data:invoice,error} = await admin.from('business_invoices').select('*').eq('tenant_id',client.tenant_id).eq('client_id',client.id).eq('id',id).in('status',['sent','viewed','partially_paid','overdue','paid','completed']).maybeSingle();
    if (error) throw error;
    if (!invoice) return NextResponse.json({error:'Invoice not found'},{status:404,headers});
    const [tenantResult,itemsResult,clientResult] = await Promise.all([
      admin.from('tenants').select('*').eq('id',client.tenant_id).maybeSingle(),
      admin.from('invoice_line_items').select('*').eq('invoice_id',id).order('created_at'),
      admin.from('business_clients').select('name,email').eq('tenant_id',client.tenant_id).eq('id',client.id).maybeSingle(),
    ]);
    for (const result of [tenantResult,itemsResult,clientResult]) if (result.error) throw result.error;
    const items = itemsResult.data?.length ? itemsResult.data : invoice.line_items || [];
    if (req.nextUrl.searchParams.get('download') === '1' || req.nextUrl.searchParams.get('pdf') === '1') {
      const pdf = await generateThemedInvoicePdfBuffer(invoice,items,tenantResult.data,clientResult.data || undefined);
      const filename = String(invoice.invoice_number || id).replace(/[^a-zA-Z0-9._-]/g,'_');
      return new NextResponse(Uint8Array.from(pdf).buffer,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="Invoice_${filename}.pdf"`}});
    }
    const billing = portalInvoiceBilling(invoice);
    const branding = extractTenantBranding(tenantResult.data);
    const amount = (value:number) => escapeHtml(new Intl.NumberFormat('en',{style:'currency',currency:billing.currency}).format(value));
    const payment = billing.reviewReason ? `<p role="alert">${escapeHtml(billing.reviewReason)}</p>` : billing.paymentUrl ? `<a href="${escapeHtml(billing.paymentUrl)}" rel="noreferrer noopener" target="_blank">Continue to configured payment provider</a>` : billing.paymentDetails ? `<h2>Configured payment instructions</h2><pre>${escapeHtml(typeof billing.paymentDetails === 'string' ? billing.paymentDetails : JSON.stringify(billing.paymentDetails,null,2))}</pre><p>Use invoice ${escapeHtml(invoice.invoice_number)} as the reference. Payments appear after the business reconciles them.</p>` : billing.balanceDue > 0 ? '<p>The business has not configured payment instructions for this invoice. Message the business before making any payment.</p>' : '<p>No remaining balance is recorded.</p>';
    const download = new URL(req.url); download.searchParams.set('download','1');
    const back = `/portal/${encodeURIComponent(token)}#invoices`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${escapeHtml(invoice.invoice_number)}</title><style>body{font:16px system-ui;line-height:1.5;max-width:850px;margin:auto;padding:24px;color:#17212b;background:#fafafa}a{display:inline-block;margin:8px 16px 8px 0;color:#075b66}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #ddd}pre{white-space:pre-wrap;overflow-wrap:anywhere} [role=alert]{padding:16px;border:1px solid #a54b00;border-radius:8px} @media(max-width:400px){body{padding:12px}}</style></head><body><nav><a href="${back}">Back to workspace</a><a href="${escapeHtml(download.pathname+download.search)}">Download invoice PDF</a></nav><p>${escapeHtml(branding.name)}</p><h1>Invoice ${escapeHtml(invoice.invoice_number)}</h1><p>Client: ${escapeHtml(clientResult.data?.name || '')}</p><p>Status: ${escapeHtml(billing.status)} · Due: ${escapeHtml(String(invoice.due_date || 'Not specified'))}</p><table><thead><tr><th scope="col">Description</th><th scope="col">Amount</th></tr></thead><tbody>${items.map((item:any)=>`<tr><td>${escapeHtml(String(item.description || item.name || 'Item'))}</td><td>${amount(Number(item.amount ?? item.line_total ?? Number(item.quantity || 1)*Number(item.unit_price || 0)))}</td></tr>`).join('')}</tbody></table><p>Total: ${amount(billing.total)}</p><p>Recorded paid: ${amount(billing.amountPaid)}</p><p><strong>Recorded balance: ${amount(billing.balanceDue)}</strong></p><section aria-label="Payment">${payment}</section></body></html>`;
    return new NextResponse(html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"}});
  } catch(error) { console.error('[client-finance/invoice]',error); return NextResponse.json({error:'Invoice could not be loaded. Retry or contact the business.'},{status:500,headers}); }
}
