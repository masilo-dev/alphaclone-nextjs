import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { invoiceEmailTemplates } from '@/lib/email/invoiceEmailTemplates';

function authorized(req: NextRequest): boolean {
    const headerSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
    const secret = process.env.CRON_SECRET;
    return Boolean(secret && headerSecret && headerSecret === secret);
}

export async function POST(req: NextRequest) {
    if (!authorized(req)) {
        return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    try {
        const admin = createSupabaseAdminClient();
        const nowIso = new Date().toISOString();
        const today = new Date();
        const todayIso = today.toISOString().split('T')[0];

        const { data: overdueInvoices, error: overdueError } = await admin
            .from('business_invoices')
            .select('id,tenant_id,client_id,invoice_number,status,due_date,reminder_count,last_reminder_at,total_amount,currency')
            .lt('due_date', todayIso)
            .in('status', ['sent', 'overdue']);
        if (overdueError) throw overdueError;

        let markedOverdue = 0;
        let remindersSent = 0;

        for (const invoice of overdueInvoices || []) {
            if (invoice.status !== 'overdue') {
                await admin
                    .from('business_invoices')
                    .update({ status: 'overdue', updated_at: nowIso })
                    .eq('id', invoice.id);
                markedOverdue += 1;
            }

            const daysOverdue = Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24));
            const reminderType =
                daysOverdue >= 14 ? 'overdue_14' :
                daysOverdue >= 7 ? 'overdue_7' :
                daysOverdue >= 1 ? 'overdue_1' :
                null;
            if (!reminderType) continue;

            const { data: existingReminder } = await admin
                .from('invoice_reminders')
                .select('id')
                .eq('invoice_id', invoice.id)
                .eq('reminder_type', reminderType)
                .maybeSingle();
            if (existingReminder?.id) continue;

            const { data: client } = await admin
                .from('business_clients')
                .select('email,name')
                .eq('id', invoice.client_id)
                .maybeSingle();
            const recipientEmail = String(client?.email || '').trim();

            await admin.from('invoice_reminders').insert({
                tenant_id: invoice.tenant_id,
                invoice_id: invoice.id,
                reminder_type: reminderType,
                sent_to: recipientEmail || null,
                status: recipientEmail ? 'sent' : 'skipped',
                metadata: {
                    invoiceNumber: invoice.invoice_number,
                    clientName: client?.name || null,
                    generatedAt: nowIso,
                },
            });

            if (recipientEmail) {
                try {
                    const { data: tenant } = await admin.from('tenants').select('name').eq('id', invoice.tenant_id).single();
                    const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/${invoice.tenant_id}/invoice/${invoice.id}`;

                    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/email/send`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-internal-api-key': process.env.INTERNAL_API_KEY || ''
                        },
                        body: JSON.stringify({
                            tenantId: invoice.tenant_id,
                            to: recipientEmail,
                            subject: `Invoice Overdue: ${invoice.invoice_number}`,
                            templateName: 'invoiceOverdue',
                            html: invoiceEmailTemplates.invoiceOverdue({
                                recipientName: client?.name || 'Valued Client',
                                invoiceNumber: invoice.invoice_number,
                                amount: invoice.total_amount || 0,
                                currency: invoice.currency || 'USD',
                                dueDate: invoice.due_date,
                                actionUrl,
                                workspaceName: tenant?.name || 'Our Company'
                            })
                        })
                    });
                } catch (err) {
                    console.error('Failed to send invoice overdue email:', err);
                }
            }

            await admin
                .from('business_invoices')
                .update({
                    reminder_count: Number(invoice.reminder_count || 0) + 1,
                    last_reminder_at: nowIso,
                    updated_at: nowIso,
                })
                .eq('id', invoice.id);

            remindersSent += 1;
        }

        return NextResponse.json({
            success: true,
            markedOverdue,
            remindersSent,
        });
    } catch (error) {
        console.error('[cron/process-invoice-overdue-reminders] failed:', error);
        return NextResponse.json({ error: 'Failed to process invoice reminders', code: 'CRON_FAILED' }, { status: 500 });
    }
}
