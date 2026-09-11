import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const scoreAction = (action: string) => {
  const value = action.toLowerCase();
  if (value.includes('deal') && (value.includes('closed') || value.includes('won'))) return 150;
  if (value.includes('task') && (value.includes('complete') || value.includes('done'))) return 50;
  if (value.includes('invoice') && (value.includes('sent') || value.includes('paid'))) return 25;
  if (value.includes('lead') && (value.includes('add') || value.includes('creat') || value.includes('discover'))) return 10;
  if (value.includes('ai') || value.includes('playbook') || value.includes('automation')) return 20;
  return 0;
};

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user, admin } = await requireTenantAccess(tenantId, req);
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: logs, error: logsError }, { data: members, error: membersError }] = await Promise.all([
      admin.from('activity_logs').select('id, user_id, action, metadata, created_at').eq('tenant_id', tenantId).gte('created_at', since).order('created_at', { ascending: false }).limit(5000),
      admin.from('tenant_users').select('user_id, role, profiles:user_id(name, email, avatar_url)').eq('tenant_id', tenantId),
    ]);
    if (logsError) throw logsError;
    if (membersError) throw membersError;
    const byUser = new Map<string, { xp: number; events: number }>();
    for (const log of logs || []) {
      const current = byUser.get(log.user_id) || { xp: 0, events: 0 };
      current.xp += scoreAction(log.action || '');
      current.events += 1;
      byUser.set(log.user_id, current);
    }
    const leaderboard = (members || []).map((member: any) => ({ userId: member.user_id, name: member.profiles?.name || member.profiles?.email || 'Workspace member', avatarUrl: member.profiles?.avatar_url || null, role: member.role, ...(byUser.get(member.user_id) || { xp: 0, events: 0 }), isMe: member.user_id === user.id })).sort((a: any, b: any) => b.xp - a.xp || a.name.localeCompare(b.name)).map((entry: any, index: number) => ({ ...entry, rank: index + 1 }));
    const myLogs = (logs || []).filter((log: any) => log.user_id === user.id);
    const dates = new Set(myLogs.map((log: any) => new Date(log.created_at).toISOString().slice(0, 10)));
    let streak = 0;
    const cursor = new Date();
    for (;;) {
      const key = cursor.toISOString().slice(0, 10);
      if (!dates.has(key)) {
        if (streak === 0) { cursor.setUTCDate(cursor.getUTCDate() - 1); if (!dates.has(cursor.toISOString().slice(0, 10))) break; }
        else break;
      }
      if (dates.has(cursor.toISOString().slice(0, 10))) streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    const actionCounts: Record<string, number> = {};
    for (const log of (myLogs as any[])) { const key = String(log.action || '').toLowerCase(); actionCounts[key] = (actionCounts[key] || 0) + 1; }
    const countMatching = (...terms: string[]): number => {
      let sum = 0;
      for (const [action, count] of Object.entries(actionCounts)) {
        if (terms.some((term) => action.includes(term))) {
          sum += Number(count);
        }
      }
      return sum;
    };
    const me = leaderboard.find((entry: any) => entry.isMe) || { xp: 0, events: 0, rank: leaderboard.length + 1 };
    return NextResponse.json({
      profile: { xp: me.xp, events: me.events },
      badges: [
        { id: 'first-deal', name: 'First Deal', icon: '🤝', description: 'Record a closed or won deal', earned: countMatching('deal closed', 'deal won') >= 1 },
        { id: 'task-builder', name: 'Task Builder', icon: '✅', description: 'Complete 10 tasks', earned: countMatching('task complete', 'task done') >= 10 },
        { id: 'automation-operator', name: 'Automation Operator', icon: '⚙️', description: 'Run 10 AI or automation activities', earned: countMatching('ai', 'automation', 'playbook') >= 10 },
        { id: 'invoice-operator', name: 'Invoice Operator', icon: '💰', description: 'Send or record 25 paid invoices', earned: countMatching('invoice sent', 'invoice paid') >= 25 },
        { id: 'pipeline-builder', name: 'Pipeline Builder', icon: '🌐', description: 'Add or discover 100 leads', earned: countMatching('lead add', 'lead creat', 'lead discover') >= 100 },
      ],
      history: myLogs.filter((log: any) => scoreAction(log.action || '') > 0).slice(0, 20).map((log: any) => ({ id: log.id, action: log.action, xp: scoreAction(log.action || ''), createdAt: log.created_at })),
    });
  } catch (error) {
    return routeErrorResponse(error, 'Workspace achievements could not be loaded', req);
  }
}
