import type { SupabaseClient } from '@supabase/supabase-js';

export interface TimelineEvent {
  id: string;
  type: 'deal' | 'invoice' | 'message' | 'meeting' | 'task' | 'contract' | 'lead_activity' | 'email_campaign' | 'quote' | 'note';
  title: string;
  description: string;
  status?: string;
  value?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Customer360Profile {
  entity_id: string;
  tenant_id: string;
  generated_at: string;
  // Identity
  primary_name: string;
  primary_email: string;
  primary_phone?: string;
  company_name?: string;
  // Aggregated metrics
  total_revenue: number;
  outstanding_balance: number;
  active_deals_count: number;
  active_deals_value: number;
  total_deals_count: number;
  total_projects_count: number;
  total_messages_count: number;
  total_meetings_count: number;
  // Health signals
  days_since_last_activity: number | null;
  average_payment_days: number | null;
  churn_risk_score: number;
  lifetime_value: number;
  engagement_score: number;
  // Timeline
  timeline: TimelineEvent[];
  // Linked records
  linked_lead_ids: string[];
  linked_contact_ids: string[];
  linked_client_ids: string[];
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

class Customer360Service {
  /**
   * Build a unified Customer 360 profile by merging data across
   * deals, invoices, messages, meetings, tasks, contracts, and more.
   * Uses email as primary entity resolution key.
   */
  async buildProfile(
    supabase: SupabaseClient,
    tenantId: string,
    email: string
  ): Promise<Customer360Profile> {
    const now = new Date();
    const timeline: TimelineEvent[] = [];

    // Resolve entity across tables
    const [leadIds, contactIds, clientIds] = await Promise.all([
      this.resolveLeads(supabase, tenantId, email),
      this.resolveContacts(supabase, tenantId, email),
      this.resolveClients(supabase, tenantId, email)
    ]);

    const allUserIds = [...new Set([...leadIds, ...contactIds, ...clientIds])];

    // Fetch identity info
    const identity = await this.resolveIdentity(supabase, tenantId, email, leadIds, contactIds, clientIds);

    // Fetch all related data in parallel
    const [deals, invoices, messages, meetings, tasks, contracts, quotes] = await Promise.all([
      this.fetchDeals(supabase, tenantId, allUserIds, email),
      this.fetchInvoices(supabase, tenantId, allUserIds, email),
      this.fetchMessages(supabase, tenantId, allUserIds),
      this.fetchMeetings(supabase, tenantId, allUserIds, email),
      this.fetchTasks(supabase, tenantId, allUserIds),
      this.fetchContracts(supabase, tenantId, allUserIds, email),
      this.fetchQuotes(supabase, tenantId, allUserIds, email)
    ]);

    // Build timeline events
    for (const deal of deals) {
      timeline.push({
        id: deal.id, type: 'deal',
        title: `Deal: ${deal.name}`,
        description: `Stage: ${deal.stage} | Value: $${Number(deal.value || 0).toLocaleString()}`,
        status: deal.stage, value: Number(deal.value || 0),
        timestamp: deal.created_at
      });
    }

    for (const inv of invoices) {
      timeline.push({
        id: inv.id, type: 'invoice',
        title: `Invoice ${inv.invoice_number || inv.id.slice(0, 8)}`,
        description: `Amount: $${Number(inv.amount || inv.total_amount || 0).toLocaleString()} | Status: ${inv.status}`,
        status: inv.status, value: Number(inv.amount || inv.total_amount || 0),
        timestamp: inv.created_at
      });
    }

    for (const msg of messages.slice(0, 30)) {
      timeline.push({
        id: msg.id, type: 'message',
        title: 'Message',
        description: String(msg.content || '').slice(0, 120),
        timestamp: msg.created_at
      });
    }

    for (const mtg of meetings) {
      timeline.push({
        id: mtg.id, type: 'meeting',
        title: `Meeting: ${mtg.title || 'Untitled'}`,
        description: mtg.description || '',
        timestamp: mtg.start_time || mtg.created_at
      });
    }

    for (const task of tasks.slice(0, 20)) {
      timeline.push({
        id: task.id, type: 'task',
        title: `Task: ${task.title}`,
        description: task.description || '',
        status: task.status,
        timestamp: task.created_at
      });
    }

    for (const contract of contracts) {
      timeline.push({
        id: contract.id, type: 'contract',
        title: `Contract: ${contract.title || contract.id.slice(0, 8)}`,
        description: `Status: ${contract.status}`,
        status: contract.status,
        timestamp: contract.created_at
      });
    }

    for (const quote of quotes) {
      timeline.push({
        id: quote.id, type: 'quote',
        title: `Quote: ${quote.title || quote.id.slice(0, 8)}`,
        description: `Total: $${Number(quote.total_amount || 0).toLocaleString()} | Status: ${quote.status}`,
        status: quote.status, value: Number(quote.total_amount || 0),
        timestamp: quote.created_at
      });
    }

    // Sort timeline by timestamp descending
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Compute aggregated metrics
    const paidInvoices = invoices.filter((i: any) => String(i.status).toLowerCase() === 'paid');
    const totalRevenue = paidInvoices.reduce((s: number, i: any) => s + Number(i.amount || i.total_amount || 0), 0);
    const outstandingInvoices = invoices.filter((i: any) => !['paid', 'cancelled'].includes(String(i.status).toLowerCase()));
    const outstandingBalance = outstandingInvoices.reduce((s: number, i: any) => s + Number(i.amount || i.total_amount || 0), 0);

    const activeDeals = deals.filter((d: any) => !['closed_won', 'closed_lost'].includes(d.stage));
    const activeDealValue = activeDeals.reduce((s: number, d: any) => s + Number(d.value || 0), 0);

    // Days since last activity
    let lastActivityDate: Date | null = null;
    if (timeline.length > 0) {
      lastActivityDate = new Date(timeline[0].timestamp);
    }
    const daysSinceLastActivity = lastActivityDate
      ? Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Average payment days
    const paymentDays = paidInvoices
      .filter((i: any) => i.created_at && i.paid_at)
      .map((i: any) => {
        const created = new Date(i.created_at).getTime();
        const paid = new Date(i.paid_at).getTime();
        return Math.floor((paid - created) / (1000 * 60 * 60 * 24));
      })
      .filter((d: number) => d >= 0 && d < 365);
    const avgPaymentDays = paymentDays.length > 0
      ? round2(paymentDays.reduce((s, d) => s + d, 0) / paymentDays.length)
      : null;

    // Churn risk (simple heuristic)
    let churnRisk = 0.15;
    if (daysSinceLastActivity !== null) {
      if (daysSinceLastActivity > 90) churnRisk += 0.4;
      else if (daysSinceLastActivity > 60) churnRisk += 0.25;
      else if (daysSinceLastActivity > 30) churnRisk += 0.1;
    }
    if (activeDeals.length === 0) churnRisk += 0.15;
    if (outstandingBalance > totalRevenue * 0.5) churnRisk += 0.1;
    churnRisk = Math.min(0.95, churnRisk);

    // Engagement score
    const engagementSignals = messages.length + meetings.length * 3 + deals.length * 2;
    const engagementScore = round2(Math.min(100, engagementSignals * 2));

    return {
      entity_id: email,
      tenant_id: tenantId,
      generated_at: now.toISOString(),
      primary_name: identity.name,
      primary_email: email,
      primary_phone: identity.phone,
      company_name: identity.company,
      total_revenue: round2(totalRevenue),
      outstanding_balance: round2(outstandingBalance),
      active_deals_count: activeDeals.length,
      active_deals_value: round2(activeDealValue),
      total_deals_count: deals.length,
      total_projects_count: tasks.length, // Approximate
      total_messages_count: messages.length,
      total_meetings_count: meetings.length,
      days_since_last_activity: daysSinceLastActivity,
      average_payment_days: avgPaymentDays,
      churn_risk_score: round2(churnRisk),
      lifetime_value: round2(totalRevenue + activeDealValue * 0.5),
      engagement_score: engagementScore,
      timeline: timeline.slice(0, 100),
      linked_lead_ids: leadIds,
      linked_contact_ids: contactIds,
      linked_client_ids: clientIds
    };
  }

  private async resolveLeads(supabase: SupabaseClient, tenantId: string, email: string): Promise<string[]> {
    const { data } = await supabase
      .from('leads').select('id').eq('tenant_id', tenantId).ilike('email', email).limit(10);
    return Array.isArray(data) ? data.map((r: any) => String(r.id)) : [];
  }

  private async resolveContacts(supabase: SupabaseClient, tenantId: string, email: string): Promise<string[]> {
    const { data } = await supabase
      .from('contacts').select('id').eq('tenant_id', tenantId).ilike('email', email).limit(10);
    return Array.isArray(data) ? data.map((r: any) => String(r.id)) : [];
  }

  private async resolveClients(supabase: SupabaseClient, tenantId: string, email: string): Promise<string[]> {
    const { data } = await supabase
      .from('business_clients').select('id').eq('tenant_id', tenantId).ilike('email', email).limit(10);
    return Array.isArray(data) ? data.map((r: any) => String(r.id)) : [];
  }

  private async resolveIdentity(
    supabase: SupabaseClient, tenantId: string, email: string,
    leadIds: string[], contactIds: string[], clientIds: string[]
  ): Promise<{ name: string; phone?: string; company?: string }> {
    // Try contacts first (most reliable), then leads, then clients
    if (contactIds.length > 0) {
      const { data } = await supabase
        .from('contacts').select('first_name, last_name, full_name, phone, company_id').eq('id', contactIds[0]).single();
      if (data) {
        const name = data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim();
        return { name: name || email, phone: data.phone, company: undefined };
      }
    }
    if (leadIds.length > 0) {
      const { data } = await supabase
        .from('leads').select('business_name, contact_name, phone, industry').eq('id', leadIds[0]).single();
      if (data) {
        return {
          name: data.business_name || data.contact_name || email,
          phone: data.phone,
          company: data.industry,
        };
      }
    }
    if (clientIds.length > 0) {
      const { data } = await supabase
        .from('business_clients').select('name, phone, company').eq('id', clientIds[0]).single();
      if (data) return { name: data.name || email, phone: data.phone, company: data.company };
    }
    return { name: email };
  }

  private async fetchDeals(supabase: SupabaseClient, tenantId: string, userIds: string[], email: string): Promise<any[]> {
    if (userIds.length === 0) return [];
    const { data } = await supabase
      .from('deals').select('id, name, value, stage, probability, created_at, updated_at')
      .eq('tenant_id', tenantId).in('contact_id', userIds).order('created_at', { ascending: false }).limit(50);
    return Array.isArray(data) ? data : [];
  }

  private async fetchInvoices(supabase: SupabaseClient, tenantId: string, userIds: string[], email: string): Promise<any[]> {
    if (userIds.length === 0) return [];
    const { data } = await supabase
      .from('invoices').select('id, invoice_number, amount, total_amount, status, created_at, paid_at')
      .eq('tenant_id', tenantId).in('client_id', userIds).order('created_at', { ascending: false }).limit(100);
    return Array.isArray(data) ? data : [];
  }

  private async fetchMessages(supabase: SupabaseClient, tenantId: string, userIds: string[]): Promise<any[]> {
    if (userIds.length === 0) return [];
    const { data } = await supabase
      .from('messages').select('id, content, sender_id, created_at')
      .eq('tenant_id', tenantId)
      .or(userIds.map(id => `sender_id.eq.${id}`).join(','))
      .order('created_at', { ascending: false }).limit(50);
    return Array.isArray(data) ? data : [];
  }

  private async fetchMeetings(supabase: SupabaseClient, tenantId: string, userIds: string[], email: string): Promise<any[]> {
    const { data } = await supabase
      .from('calendar_events').select('id, title, description, start_time, created_at')
      .eq('tenant_id', tenantId).order('start_time', { ascending: false }).limit(30);
    return Array.isArray(data) ? data : [];
  }

  private async fetchTasks(supabase: SupabaseClient, tenantId: string, userIds: string[]): Promise<any[]> {
    if (userIds.length === 0) return [];
    const { data } = await supabase
      .from('tasks').select('id, title, description, status, created_at')
      .eq('tenant_id', tenantId).in('assigned_to', userIds)
      .order('created_at', { ascending: false }).limit(30);
    return Array.isArray(data) ? data : [];
  }

  private async fetchContracts(supabase: SupabaseClient, tenantId: string, userIds: string[], email: string): Promise<any[]> {
    if (userIds.length === 0) return [];
    const { data } = await supabase
      .from('contracts').select('id, title, status, created_at')
      .eq('tenant_id', tenantId).in('client_id', userIds)
      .order('created_at', { ascending: false }).limit(20);
    return Array.isArray(data) ? data : [];
  }

  private async fetchQuotes(supabase: SupabaseClient, tenantId: string, userIds: string[], email: string): Promise<any[]> {
    if (userIds.length === 0) return [];
    const { data } = await supabase
      .from('quotes').select('id, title, total_amount, status, created_at')
      .eq('tenant_id', tenantId).in('client_id', userIds)
      .order('created_at', { ascending: false }).limit(20);
    return Array.isArray(data) ? data : [];
  }
}

export const customer360Service = new Customer360Service();
