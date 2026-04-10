import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Get comprehensive stats
    const [
      clientsResult,
      projectsResult,
      invoicesResult,
      leadsResult,
      meetingsResult,
      integrationsResult
    ] = await Promise.all([
      // Client stats
      supabase
        .from('business_clients')
        .select('id, created_at')
        .eq('tenant_id', tenantId),
      
      // Project stats
      supabase
        .from('projects')
        .select('id, status, created_at')
        .eq('tenant_id', tenantId),
      
      // Invoice stats
      supabase
        .from('invoices')
        .select('id, amount, status, created_at')
        .eq('tenant_id', tenantId),
      
      // Lead stats
      supabase
        .from('leads')
        .select('id, status, created_at')
        .eq('tenant_id', tenantId),
      
      // Meeting stats
      supabase
        .from('meetings')
        .select('id, status, created_at')
        .eq('tenant_id', tenantId),
      
      // Integration stats
      supabase
        .from('integrations')
        .select('id, provider, status, created_at')
        .eq('tenant_id', tenantId)
    ]);

    // Calculate metrics
    const clientCount = clientsResult.data?.length || 0;
    const activeProjects = projectsResult.data?.filter((p: any) => p.status === 'active').length || 0;
    const totalRevenue = invoicesResult.data?.reduce((sum: number, inv: any) => 
      inv.status === 'paid' ? sum + (inv.amount || 0) : sum, 0
    ) || 0;
    const pendingInvoices = invoicesResult.data?.filter((inv: any) => inv.status === 'pending').length || 0;
    const leadCount = leadsResult.data?.length || 0;
    const upcomingMeetings = meetingsResult.data?.filter((m: any) => 
      m.status === 'scheduled' && new Date(m.created_at) > new Date()
    ).length || 0;
    const activeIntegrations = integrationsResult.data?.filter((inv: any) => inv.status === 'active').length || 0;

    // Calculate monthly revenue for chart
    const monthlyRevenue = calculateMonthlyRevenue(invoicesResult.data || []);

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
      ...clientsResult.data || [],
      ...projectsResult.data || [],
      ...invoicesResult.data || [],
      ...leadsResult.data || []
    ].filter(item => {
      const itemDate = new Date(item.created_at);
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
        productivityScore: Math.min(Math.round((clientCount * 10 + activeProjects * 15 + totalRevenue / 100) / 10), 100)
      }
    });

  } catch (error) {
    console.error('Progress API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress data' },
      { status: 500 }
    );
  }
}

function calculateMonthlyRevenue(invoices: any[]) {
  const monthlyData: Record<string, number> = {};
  const today = new Date();
  
  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    monthlyData[monthKey] = 0;
  }
  
  // Calculate revenue per month
  invoices.forEach(invoice => {
    if (invoice.status === 'paid' && invoice.amount) {
      const date = new Date(invoice.created_at);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (monthlyData.hasOwnProperty(monthKey)) {
        monthlyData[monthKey] += invoice.amount;
      }
    }
  });
  
  return Object.entries(monthlyData).map(([month, revenue]) => ({
    month,
    revenue
  }));
}
