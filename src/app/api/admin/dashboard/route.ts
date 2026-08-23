import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requirePlatformSuperAdmin();
    const admin = createSupabaseAdminClient();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch User Stats
    const { data: profiles, error: pErr } = await admin
      .from('profiles')
      .select('id, role, account_status, created_at, password_change_required');

    if (pErr) throw pErr;

    const allProfiles = profiles || [];
    const totalUsers = allProfiles.length;
    const activeUsers = allProfiles.filter(p => p.account_status === 'active' || !p.account_status).length;
    const suspendedUsers = allProfiles.filter(p => p.account_status === 'suspended').length;
    const deletedUsers = allProfiles.filter(p => p.account_status === 'deleted').length;
    const newUsersToday = allProfiles.filter(p => p.created_at && p.created_at >= startOfToday).length;
    const newUsersThisWeek = allProfiles.filter(p => p.created_at && p.created_at >= sevenDaysAgo).length;
    const pendingPasswordReset = allProfiles.filter(p => p.password_change_required).length;

    // 2. Fetch Tenants / Workspaces Stats
    const { data: tenants } = await admin
      .from('tenants')
      .select('id, created_at');

    const allTenants = tenants || [];
    const totalTenants = allTenants.length;
    const newTenantsThisWeek = allTenants.filter(t => t.created_at && t.created_at >= sevenDaysAgo).length;

    // 3. Fetch System Audit Logs & Alerts
    const { data: recentAuditLogs } = await admin
      .from('audit_logs')
      .select('id, action, user_id, resource_type, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(10);

    const recentRoleChanges = (recentAuditLogs || []).filter(
      l => l.action === 'ROLE_CHANGED' || l.action === 'SUPER_ADMIN_GRANTED' || l.action === 'SUPER_ADMIN_REVOKED'
    );

    const systemWarnings: string[] = [];
    if (suspendedUsers > 0) {
      systemWarnings.push(`${suspendedUsers} user account(s) are currently suspended.`);
    }
    if (pendingPasswordReset > 0) {
      systemWarnings.push(`${pendingPasswordReset} user(s) require forced password resets.`);
    }
    if (totalTenants === 0) {
      systemWarnings.push('No active workspace tenants detected.');
    }

    return NextResponse.json({
      success: true,
      metrics: {
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          deleted: deletedUsers,
          newToday: newUsersToday,
          newThisWeek: newUsersThisWeek,
          pendingPasswordReset,
        },
        workspaces: {
          total: totalTenants,
          newThisWeek: newTenantsThisWeek,
        },
        platform: {
          failedWorkflows: 0,
          failedCampaigns: 0,
          brokenIntegrations: 0,
          uploadFailures: 0,
          systemWarnings,
        },
        security: {
          recentRoleChanges,
          recentAuditLogs: recentAuditLogs || [],
        },
      },
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
