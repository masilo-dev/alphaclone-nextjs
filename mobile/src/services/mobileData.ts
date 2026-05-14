import { supabase } from './supabase';
import type {
  MobileActivity,
  MobileDashboardStats,
  MobileInvoice,
  MobileLead,
  MobileProject,
  Tenant,
} from '../types';

const currency = (value: unknown) => Number(value || 0);

const formatRelativeTime = (iso?: string) => {
  if (!iso) return 'Recently';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const normalizeStage = (value?: string | null) => String(value || 'new').toLowerCase();

export async function getUserTenants(userId: string): Promise<Tenant[]> {
  const { data, error } = await supabase.rpc('get_user_tenants', { p_user_id: userId });
  if (error) throw error;
  return (data || []).map((tenant: any) => ({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    role: tenant.role,
    joined_at: tenant.joined_at,
  }));
}

export async function ensureTenantForUser(userId: string, displayName?: string, email?: string): Promise<Tenant | null> {
  const existing = await getUserTenants(userId);
  if (existing.length > 0) return existing[0];

  const fallbackName = displayName || email?.split('@')[0] || 'AlphaClone';
  const workspaceName = `${fallbackName}'s Workspace`;
  const slug = fallbackName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';

  const { error } = await supabase.rpc('create_tenant', {
    p_name: workspaceName,
    p_slug: slug,
    p_admin_user_id: userId,
    p_plan: 'free',
  });
  if (error) throw error;

  const refreshed = await getUserTenants(userId);
  return refreshed[0] || null;
}

export async function getDashboardStats(tenantId: string, userId: string): Promise<MobileDashboardStats> {
  const { data, error } = await supabase.rpc('get_consolidated_dashboard_stats', {
    p_tenant_id: tenantId,
    p_user_id: userId,
  });

  if (error) throw error;

  const recentActivity = Array.isArray(data?.recent_activity)
    ? data.recent_activity.slice(0, 8).map((activity: any, index: number): MobileActivity => ({
        id: `${activity.entity_id || activity.id || index}`,
        title: activity.title || activity.action || 'Workspace activity',
        time: formatRelativeTime(activity.date || activity.created_at),
        type: mapActivityType(activity.type || activity.entity_type),
      }))
    : [];

  return {
    activeProjects: Number(data?.active_projects || data?.total_projects || 0),
    totalLeads: Number(data?.total_leads || 0),
    revenue: currency(data?.total_revenue),
    tasks: Number(data?.total_tasks || 0),
    recentActivity,
  };
}

export async function getProjects(tenantId: string): Promise<MobileProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id,name,owner_name,status,current_stage,progress,due_date,budget,description,updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data || []).map((project: any) => ({
    id: project.id,
    title: project.name || 'Untitled project',
    client: project.owner_name || project.current_stage || 'Workspace project',
    status: normalizeStage(project.status),
    progress: Number(project.progress || 0),
    deadline: project.due_date,
    budget: currency(project.budget),
    description: project.description,
  }));
}

export async function getLeads(tenantId: string): Promise<MobileLead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('id,business_name,email,phone,stage,status,value,notes,updated_at,created_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data || []).map((lead: any) => ({
    id: lead.id,
    name: lead.business_name || 'Unnamed lead',
    email: lead.email,
    company: lead.business_name,
    status: normalizeStage(lead.status || lead.stage),
    value: currency(lead.value),
    phone: lead.phone,
    notes: lead.notes,
    lastContact: formatRelativeTime(lead.updated_at || lead.created_at),
  }));
}

export async function getInvoices(tenantId: string): Promise<MobileInvoice[]> {
  const { data, error } = await supabase
    .from('business_invoices')
    .select('id,invoice_number,status,total,due_date,issue_date,line_items,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data || []).map((invoice: any) => {
    const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
    return {
      id: invoice.id,
      number: invoice.invoice_number || 'Draft invoice',
      client: 'Client',
      amount: currency(invoice.total),
      status: normalizeStage(invoice.status),
      dueDate: invoice.due_date,
      issueDate: invoice.issue_date,
      items: items.map((item: any, index: number) => ({
        id: `${invoice.id}-${index}`,
        description: item.description || 'Line item',
        quantity: Number(item.quantity || 1),
        price: currency(item.rate),
        total: currency(item.amount),
      })),
    };
  });
}

function mapActivityType(type?: string): MobileActivity['type'] {
  const normalized = normalizeStage(type);
  if (normalized.includes('lead') || normalized.includes('client')) return 'lead';
  if (normalized.includes('project') || normalized.includes('task')) return 'project';
  if (normalized.includes('invoice') || normalized.includes('payment')) return 'finance';
  return 'calendar';
}
