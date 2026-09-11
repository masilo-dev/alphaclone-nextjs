import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { invoiceEmailTemplates } from '@/lib/email/invoiceEmailTemplates';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { getPublicInvoicePaymentUrl } from '@/lib/invoices/publicInvoiceAccess';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';

/** Returns base64url-encoded token for tracking pixel */
function trackingToken(invoiceId: string): string {
    return Buffer.from(invoiceId).toString('base64url');
}

async function processInvoiceOverdueReminders() {
        const admin = createSupabaseAdminClient();
        const now = new Date();
        const nowIso = now.toISOString();
        const todayIso = now.toISOString().split('T')[0];
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        let markedOverdue = 0;
        let remindersSent = 0;

        // ============================================================
        // PHASE 1: Mark overdue invoices
        // ============================================================
        const { data: sentInvoices, error: sentError } = await admin
            .from('business_invoices')
            .select('id, tenant_id, client_id, invoice_number, status, due_date, sent_at, auto_followup_enabled')
            .lt('due_date', todayIso)
            .in('status', ['sent', 'viewed']);
        if (sentError) throw sentError;

        for (const invoice of sentInvoices || []) {
            await admin
                .from('business_invoices')
                .update({ status: 'overdue', updated_at: nowIso })
                .eq('id', invoice.id);
            await logInvoiceEvent({
                invoiceId: invoice.id,
                tenantId: invoice.tenant_id,
                eventType: 'status_changed',
                eventData: { from: invoice.status, to: 'overdue', reason: 'past_due_date' },
                performedBy: 'system',
            });
            markedOverdue += 1;
        }

        // ============================================================
        // PHASE 2: Behaviour-triggered reminders
        // ============================================================
        const { data: activeInvoices, error: activeError } = await admin
            .from('business_invoices')
            .select('id, tenant_id, client_id, invoice_number, status, due_date, sent_at, viewed_at, reminder_count, last_reminder_at, total_amount, currency, auto_followup_enabled')
            .in('status', ['sent', 'viewed', 'overdue'])
            .neq('auto_followup_enabled', false);
        if (activeError) throw activeError;

        for (const invoice of activeInvoices || []) {
            const daysOverdue = invoice.due_date
                ? Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000)
                : 0;
            const hoursSinceSent = invoice.sent_at
                ? Math.floor((Date.now() - new Date(invoice.sent_at).getTime()) / 3600000)
                : 0;
            const hoursSinceViewed = invoice.viewed_at
                ? Math.floor((Date.now() - new Date(invoice.viewed_at).getTime()) / 3600000)
                : null;

            // Determine which reminder to send
            let reminderType: string | null = null;
            let emailVariant: 'viewed' | 'not_opened' | 'overdue' | null = null;
            let emailSubject = '';

            if (invoice.status === 'viewed' && hoursSinceViewed !== null && hoursSinceViewed >= 48) {
                // Viewed but not paid within 48 hours
                reminderType = 'viewed_no_payment';
                emailVariant = 'viewed';
                emailSubject = `Following Up: Invoice ${invoice.invoice_number}`;
            } else if (invoice.status === 'sent' && hoursSinceSent >= 72) {
                // Sent 3 days ago and not opened
                reminderType = 'sent_not_opened';
                emailVariant = 'not_opened';
                emailSubject = `Re: Invoice ${invoice.invoice_number} — Did you receive this?`;
            } else if (daysOverdue >= 14) {
                reminderType = 'overdue_14';
                emailVariant = 'overdue';
                emailSubject = `Final Notice: Invoice ${invoice.invoice_number} Is Overdue`;
            } else if (daysOverdue >= 7) {
                reminderType = 'overdue_7';
                emailVariant = 'overdue';
                emailSubject = `Urgent: Invoice ${invoice.invoice_number} — Payment Required`;
            } else if (daysOverdue >= 3) {
                reminderType = 'overdue_3';
                emailVariant = 'overdue';
                emailSubject = `Overdue Notice: Invoice ${invoice.invoice_number}`;
            } else if (daysOverdue >= 1) {
                reminderType = 'overdue_1';
                emailVariant = 'overdue';
                emailSubject = `Invoice ${invoice.invoice_number} is Past Due`;
            }

            if (!reminderType || !emailVariant) continue;

            // Check if this reminder type was already sent
            const { data: existingReminder } = await admin
                .from('invoice_reminders')
                .select('id')
                .eq('invoice_id', invoice.id)
                .eq('reminder_type', reminderType)
                .maybeSingle();
            if (existingReminder?.id) continue;

            // Get client details
            const { data: client } = await admin
                .from('business_clients')
                .select('email,name')
                .eq('id', invoice.client_id)
                .maybeSingle();
            const recipientEmail = String(client?.email || '').trim();

            if (recipientEmail) {
                try {
                    const { data: tenant } = await admin.from('tenants').select('name').eq('id', invoice.tenant_id).single();
                    const actionUrl = await getPublicInvoicePaymentUrl(admin, invoice.id, invoice.tenant_id, appUrl);
                    const pixelUrl = `${appUrl}/api/invoices/track/${trackingToken(invoice.id)}`;

                    const emailData = {
                        recipientName: client?.name || 'Valued Client',
                        recipientEmail,
                        tenantId: invoice.tenant_id,
                        invoiceNumber: invoice.invoice_number,
                        amount: invoice.total_amount || 0,
                        currency: invoice.currency || 'USD',
                        dueDate: invoice.due_date,
                        actionUrl,
                        workspaceName: tenant?.name || 'Our Company',
                        trackingPixelUrl: pixelUrl,
                    };

                    let htmlContent: string;
                    if (emailVariant === 'viewed') {
                        htmlContent = invoiceEmailTemplates.invoiceViewedReminder(emailData);
                    } else if (emailVariant === 'not_opened') {
                        htmlContent = invoiceEmailTemplates.invoiceNotOpenedReminder(emailData);
                    } else {
                        htmlContent = invoiceEmailTemplates.invoiceOverdue(emailData);
                    }

                    const sendResult = await sendEmailServer({
                        tenantId: invoice.tenant_id,
                        to: recipientEmail,
                        subject: emailSubject,
                        templateName: 'invoiceOverdue',
                        html: htmlContent,
                        skipFooter: true,
                    });

                    if (!sendResult.success) throw new Error(sendResult.error || 'Reminder email failed');

                    await admin.from('invoice_reminders').insert({
                        tenant_id: invoice.tenant_id,
                        invoice_id: invoice.id,
                        reminder_type: reminderType,
                        sent_to: recipientEmail,
                        status: 'sent',
                        metadata: {
                            invoiceNumber: invoice.invoice_number,
                            clientName: client?.name || null,
                            emailVariant,
                            generatedAt: nowIso,
                            provider: sendResult.provider,
                            emailId: sendResult.emailId,
                        },
                    });

                    await logInvoiceEvent({
                        invoiceId: invoice.id,
                        tenantId: invoice.tenant_id,
                        eventType: 'reminder_sent',
                        eventData: {
                            reminderType,
                            emailVariant,
                            sentTo: recipientEmail,
                            daysOverdue,
                            hoursSinceSent,
                            hoursSinceViewed,
                        },
                        performedBy: 'system',
                    });

                } catch (err) {
                    console.error('Failed to send reminder:', err);
                    await admin.from('invoice_reminders').insert({
                        tenant_id: invoice.tenant_id,
                        invoice_id: invoice.id,
                        reminder_type: reminderType,
                        sent_to: recipientEmail,
                        status: 'failed',
                        metadata: { error: err instanceof Error ? err.message : 'Unknown send error', generatedAt: nowIso },
                    });
                    continue;
                }
            } else {
                await admin.from('invoice_reminders').insert({
                    tenant_id: invoice.tenant_id,
                    invoice_id: invoice.id,
                    reminder_type: reminderType,
                    sent_to: null,
                    status: 'skipped',
                    metadata: { reason: 'no_email', invoiceNumber: invoice.invoice_number, generatedAt: nowIso },
                });
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

        return NextResponse.json({ success: true, markedOverdue, remindersSent });
}

export async function GET(req: NextRequest) {
    const denied = denyIfCronUnauthorized(req);
    if (denied) return denied;

    try {
        return await processInvoiceOverdueReminders();
    } catch (error) {
        console.error('[cron/process-invoice-overdue-reminders] failed:', error);
        return NextResponse.json({ error: 'Failed to process invoice reminders', code: 'CRON_FAILED' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const denied = denyIfCronUnauthorized(req);
    if (denied) return denied;

    try {
        return await processInvoiceOverdueReminders();
    } catch (error) {
        console.error('[cron/process-invoice-overdue-reminders] failed:', error);
        return NextResponse.json({ error: 'Failed to process invoice reminders', code: 'CRON_FAILED' }, { status: 500 });
    }
}
