import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { integratedIntelligenceService } from '@/services/intelligence/integratedIntelligenceService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);

    const supabase = createSupabaseAdminClient();
    const { data: tenantUsersData } = await supabase
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', tenantId);
    const tenantUserIds = (tenantUsersData || [])
      .map((row) => String((row as { user_id?: string }).user_id || '').trim())
      .filter((value) => value.length > 0);
    const fallbackUserId = '00000000-0000-0000-0000-000000000000';
    const intelligenceSnapshotPromise = integratedIntelligenceService
      .generateSnapshot(supabase, tenantId, { persist: false })
      .catch((error) => {
        console.error('[dashboard/progress] intelligence snapshot failed:', error);
        return null;
      });

    const [
      clientsResult,
      projectsResult,
      invoicesResult,
      businessInvoicesResult,
      leadsResult,
      meetingsResult,
      integrationsResult,
      intelligenceSnapshot
    ] = await Promise.all([
      supabase
        .from('business_clients')
        .select('id, created_at')
        .eq('tenant_id', tenantId),
      supabase
        .from('projects')
        .select('id, status, created_at')
        .eq('tenant_id', tenantId),
      supabase
        .from('invoices')
        .select('id, amount, status, created_at')
        .eq('tenant_id', tenantId),
      supabase
        .from('business_invoices')
        .select('id, total, status, created_at')
        .eq('tenant_id', tenantId),
      supabase
        .from('leads')
        .select('id, status, created_at')
        .eq('tenant_id', tenantId),
      supabase
        .from('meetings')
        .select('id, status, created_at')
        .in('host_id', tenantUserIds.length > 0 ? tenantUserIds : [fallbackUserId]),
      supabase
        .from('integrations')
        .select('id, provider, status, created_at')
        .eq('tenant_id', tenantId),
      intelligenceSnapshotPromise
    ]);

    const normalizedInvoices = normalizeInvoiceRows(
      invoicesResult.data || [],
      businessInvoicesResult.data || []
    );

    const clientCount = clientsResult.data?.length || 0;
    const activeProjects = projectsResult.data?.filter((p: { status?: string }) => p.status === 'active').length || 0;
    const totalRevenue = normalizedInvoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.amount, 0);
    const pendingInvoices = normalizedInvoices.filter((inv) => inv.status !== 'paid').length;
    const leadCount = leadsResult.data?.length || 0;
    const upcomingMeetings = meetingsResult.data?.filter((m: { status?: string; created_at?: string }) =>
      m.status === 'scheduled' && m.created_at && new Date(m.created_at) > new Date()
    ).length || 0;
    const activeIntegrations = integrationsResult.data?.filter((inv: { status?: string }) => inv.status === 'active').length || 0;

    const monthlyRevenue = calculateMonthlyRevenue(normalizedInvoices);

    // Calculate onboarding progress
    const onboardingProgress = {
      hasClients: clientCount > 0,
      hasProjects: activeProjects > 0,
      hasRevenue: totalRevenue > 0,
      hasIntegrations: activeIntegrations > 0,
      hasLeads: leadCount > 0
    };

    const completedSteps = Object.values(onboardingProgress).filter(Boolean).length;
    const totalSteps = Object.keys(onboardingProgress).length;
    const progressPercentage = (completedSteps / totalSteps) * 100;

    // Calculate streak (simplified - check recent activity)
    const today = new Date();
    const recentActivity = [
      ...(clientsResult.data || []),
      ...(projectsResult.data || []),
      ...(invoicesResult.data || []),
      ...(businessInvoicesResult.data || []),
      ...(leadsResult.data || []),
    ].filter((item: { created_at?: string }) => {
      const itemDate = new Date(item.created_at || 0);
      const daysDiff = Math.floor((today.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 30; // Activity in last 30 days
    }).length;

    const streak = Math.min(Math.floor(recentActivity / 3), 30); // Simplified streak calculation

    // Generate achievements
    const achievements = [
      {
        id: 'client-collector',
        title: 'Client Collector',
        description: 'Add 10 clients',
        icon: 'Users',
        unlocked: clientCount >= 10,
        progress: Math.min(clientCount, 10),
        maxProgress: 10
      },
      {
        id: 'revenue-generator',
        title: 'Revenue Generator',
        description: 'Earn $10,000',
        icon: 'DollarSign',
        unlocked: totalRevenue >= 10000,
        progress: Math.min(totalRevenue, 10000),
        maxProgress: 10000
      },
      {
        id: 'project-master',
        title: 'Project Master',
        description: 'Complete 5 projects',
        icon: 'Briefcase',
        unlocked: activeProjects >= 5,
        progress: Math.min(activeProjects, 5),
        maxProgress: 5
      },
      {
        id: 'lead-magnet',
        title: 'Lead Magnet',
        description: 'Generate 25 leads',
        icon: 'Target',
        unlocked: leadCount >= 25,
        progress: Math.min(leadCount, 25),
        maxProgress: 25
      }
    ];

    return NextResponse.json({
      success: true,
      data: {
        // Core metrics
        totalRevenue,
        clientCount,
        activeProjects,
        pendingInvoices,
        leadCount,
        upcomingMeetings,
        activeIntegrations,
        
        // Progress tracking
        progressPercentage,
        streak,
        completedSteps,
        totalSteps,
        
        // Charts data
        monthlyRevenue,
        
        // Achievements
        achievements,
        
        // Onboarding status
        onboardingProgress,
        
        // Quick stats
        recentActivity,
        totalConnections: clientCount + leadCount,
        productivityScore: Math.min(Math.round((clientCount * 10 + activeProjects * 15 + totalRevenue / 100) / 10), 100),
        intelligence: intelligenceSnapshot
      }
    });

  } catch (error) {
    return routeErrorResponse(error, 'Failed to fetch progress data');
  }
}

type NormalizedInvoiceRow = { amount: number; status: string; created_at: string };

function normalizeInvoiceRows(legacy: Record<string, unknown>[], business: Record<string, unknown>[]): NormalizedInvoiceRow[] {
  const fromLegacy = legacy.map((inv) => ({
    amount: Number(inv.total_amount ?? inv.amount ?? 0),
    status: String(inv.status ?? '').toLowerCase(),
    created_at: String(inv.created_at ?? ''),
  }));
  const fromBusiness = business.map((inv) => {
    const st = String(inv.status ?? '').toLowerCase();
    return {
      amount: Number(inv.total ?? 0),
      status: st === 'paid' ? 'paid' : st,
      created_at: String(inv.created_at ?? ''),
    };
  });
  return [...fromLegacy, ...fromBusiness];
}

function calculateMonthlyRevenue(invoices: NormalizedInvoiceRow[]) {
  const monthlyData: Record<string, number> = {};
  const today = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    monthlyData[monthKey] = 0;
  }

  invoices.forEach((invoice) => {
    if (invoice.status !== 'paid' || !invoice.amount || !invoice.created_at) return;
    const date = new Date(invoice.created_at);
    const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    if (Object.prototype.hasOwnProperty.call(monthlyData, monthKey)) {
      monthlyData[monthKey] += invoice.amount;
    }
  });

  return Object.entries(monthlyData).map(([month, revenue]) => ({
    month,
    revenue,
  }));
}
