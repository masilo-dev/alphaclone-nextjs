import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { taskEmailTemplates } from '@/lib/email/taskEmailTemplates';

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
        const todayStr = today.toISOString().split('T')[0];
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        // 1. Process "Due Soon" (Due Tomorrow)
        const { data: dueSoonTasks, error: dueSoonError } = await admin
            .from('tasks')
            .select('id,tenant_id,assigned_to,title,description,due_date,priority')
            .eq('due_date', tomorrowStr)
            .neq('status', 'completed')
            .neq('status', 'cancelled')
            .not('assigned_to', 'is', null);

        if (dueSoonError) throw dueSoonError;

        let dueSoonCount = 0;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        for (const task of dueSoonTasks || []) {
            const { data: assignee } = await admin.from('profiles').select('name, email').eq('id', task.assigned_to).single();
            if (assignee?.email) {
                const { data: tenant } = await admin.from('tenants').select('name').eq('id', task.tenant_id).single();
                
                await fetch(`${appUrl}/api/email/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-internal-api-key': process.env.INTERNAL_API_KEY || ''
                    },
                    body: JSON.stringify({
                        tenantId: task.tenant_id,
                        to: assignee.email,
                        subject: `Task Due Soon: ${task.title}`,
                        templateName: 'taskDueSoon',
                        html: taskEmailTemplates.taskDueSoon({
                            recipientName: assignee.name || 'Team Member',
                            taskTitle: task.title,
                            dueDate: task.due_date,
                            priority: task.priority,
                            actionUrl: `${appUrl}/dashboard/tasks/${task.id}`,
                            workspaceName: tenant?.name || 'Your Workspace'
                        })
                    })
                }).catch(e => console.error('Failed due soon email:', e));
                dueSoonCount++;
            }
        }

        // 2. Process "Overdue" (Due < Today, reminder_sent = false)
        const { data: overdueTasks, error: overdueError } = await admin
            .from('tasks')
            .select('id,tenant_id,assigned_to,title,description,due_date,priority')
            .lt('due_date', todayStr)
            .neq('status', 'completed')
            .neq('status', 'cancelled')
            .eq('reminder_sent', false)
            .not('assigned_to', 'is', null);

        if (overdueError) throw overdueError;

        let overdueCount = 0;

        for (const task of overdueTasks || []) {
            const { data: assignee } = await admin.from('profiles').select('name, email').eq('id', task.assigned_to).single();
            if (assignee?.email) {
                const { data: tenant } = await admin.from('tenants').select('name').eq('id', task.tenant_id).single();
                
                await fetch(`${appUrl}/api/email/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-internal-api-key': process.env.INTERNAL_API_KEY || ''
                    },
                    body: JSON.stringify({
                        tenantId: task.tenant_id,
                        to: assignee.email,
                        subject: `Task Overdue: ${task.title}`,
                        templateName: 'taskOverdue',
                        html: taskEmailTemplates.taskOverdue({
                            recipientName: assignee.name || 'Team Member',
                            taskTitle: task.title,
                            dueDate: task.due_date,
                            priority: task.priority,
                            actionUrl: `${appUrl}/dashboard/tasks/${task.id}`,
                            workspaceName: tenant?.name || 'Your Workspace'
                        })
                    })
                }).catch(e => console.error('Failed overdue email:', e));
                
                await admin.from('tasks').update({ reminder_sent: true, updated_at: nowIso }).eq('id', task.id);
                overdueCount++;
            }
        }

        return NextResponse.json({
            success: true,
            dueSoonCount,
            overdueCount,
        });
    } catch (error) {
        console.error('[cron/process-task-reminders] failed:', error);
        return NextResponse.json({ error: 'Failed to process task reminders', code: 'CRON_FAILED' }, { status: 500 });
    }
}
