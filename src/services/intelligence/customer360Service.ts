import type { SupabaseClient } from '@supabase/supabase-js';

export interface TimelineEvent {
  id: string;
  type: 'deal' | 'invoice' | 'message' | 'meeting' | 'task' | 'contract' | 'lead_activity' | 'email_campaign' | 'quote' | 'note' | 'commitment' | 'decision';
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
  relationship_status: 'Active client' | 'Lead' | 'Prospect' | 'Former client' | 'Partner';
  // Aggregated metrics
  total_revenue: number;
  outstanding_balance: number;
  active_deals_count: number;
  active_deals_value: number;
  total_deals_count: number;
  total_projects_count: number;
  total_messages_count: number;
  total_meetings_count: number;
  // Relationship Graph Data
  commitments: Array<{ id: string; commitment: string; makerType: string; status: string; dueDate?: string }>;
  proposals: Array<{ id: string; title: string; amount: number; status: string; createdAt: string }>;
  calendar_events: {
    past: Array<{ id: string; title: string; time: string }>;
    today: Array<{ id: string; title: string; time: string }>;
    future: Array<{ id: string; title: string; time: string }>;
  };
  decisions: Array<{ id: string; title: string; decidedAt?: string }>;
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
   * deals, invoices, messages, meetings, tasks, contracts, commitments, decisions, proposals, etc.
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
    const [deals, invoices, messages, meetings, tasks, contracts, quotes, commitmentsData, decisionsData, outreachLog] = await Promise.all([
      this.fetchDeals(supabase, tenantId, allUserIds, email),
      this.fetchInvoices(supabase, tenantId, allUserIds, email),
      this.fetchMessages(supabase, tenantId, allUserIds),
      this.fetchMeetings(supabase, tenantId, allUserIds, email),
      this.fetchTasks(supabase, tenantId, allUserIds),
      this.fetchContracts(supabase, tenantId, allUserIds, email),
      this.fetchQuotes(supabase, tenantId, allUserIds, email),
      this.fetchCommitments(supabase, tenantId, clientIds),
      this.fetchDecisions(supabase, tenantId, clientIds),
      this.fetchOutreachLog(supabase, tenantId, email, leadIds),
    ]);

    // Timeline events
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
        description: `Amount: $${Number(inv.total || 0).toLocaleString()} | Status: ${inv.status}`,
        status: inv.status, value: Number(inv.total || 0),
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

    for (const com of commitmentsData) {
      timeline.push({
        id: com.id, type: 'commitment',
        title: `Commitment: ${com.commitment.slice(0, 40)}...`,
        description: `Maker: ${com.maker_type === 'our_team' ? 'Our Team' : 'Client'} | Status: ${com.status}`,
        status: com.status,
        timestamp: com.created_at
      });
    }

    for (const dec of decisionsData) {
      timeline.push({
        id: dec.id, type: 'decision',
        title: `Decision: ${dec.title}`,
        description: dec.context || 'Decision recorded',
        status: dec.status,
        timestamp: dec.created_at
      });
    }

    for (const outreach of outreachLog) {
      timeline.push({
        id: outreach.id,
        type: 'email_campaign',
        title: outreach.status === 'replied' ? 'Outreach reply received' : `Outreach — ${outreach.status || 'sent'}`,
        description: outreach.subject || outreach.campaign_name || 'Email outreach',
        status: outreach.status,
        timestamp: outreach.sent_at || outreach.created_at,
        metadata: { source: outreach.source_label, campaign: outreach.campaign_name },
      });
    }

    // Sort timeline by timestamp descending
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Categorize Calendar Events into Past, Today, Future
    const todayStr = now.toISOString().slice(0, 10);
    const pastMeetings: Array<{ id: string; title: string; time: string }> = [];
    const todayMeetings: Array<{ id: string; title: string; time: string }> = [];
    const futureMeetings: Array<{ id: string; title: string; time: string }> = [];

    for (const mtg of meetings) {
      const mtgTime = mtg.start_time || mtg.created_at;
      const mtgDateStr = new Date(mtgTime).toISOString().slice(0, 10);
      const item = { id: mtg.id, title: mtg.title || 'Meeting', time: mtgTime };

      if (mtgDateStr === todayStr) todayMeetings.push(item);
      else if (new Date(mtgTime) < now) pastMeetings.push(item);
      else futureMeetings.push(item);
    }

    // Metrics
    const paidInvoices = invoices.filter((i: any) => String(i.status).toLowerCase() === 'paid');
    const totalRevenue = paidInvoices.reduce((s: number, i: any) => s + Number(i.total || i.amount_paid || 0), 0);
    const outstandingInvoices = invoices.filter((i: any) => !['paid', 'cancelled'].includes(String(i.status).toLowerCase()));
    const outstandingBalance = outstandingInvoices.reduce((s: number, i: any) => s + Number(i.balance_due ?? i.total ?? 0), 0);

    const activeDeals = deals.filter((d: any) => !['closed_won', 'closed_lost'].includes(d.stage));
    const activeDealValue = activeDeals.reduce((s: number, d: any) => s + Number(d.value || 0), 0);

    let lastActivityDate: Date | null = null;
    if (timeline.length > 0) {
      lastActivityDate = new Date(timeline[0].timestamp);
    }
    const daysSinceLastActivity = lastActivityDate
      ? Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      entity_id: email,
      tenant_id: tenantId,
      generated_at: now.toISOString(),
      primary_name: identity.name,
      primary_email: email,
      primary_phone: identity.phone,
      company_name: identity.company,
      relationship_status: clientIds.length > 0 ? 'Active client' : leadIds.length > 0 ? 'Lead' : 'Prospect',
      total_revenue: round2(totalRevenue),
      outstanding_balance: round2(outstandingBalance),
      active_deals_count: activeDeals.length,
      active_deals_value: round2(activeDealValue),
      total_deals_count: deals.length,
      total_projects_count: tasks.length,
      total_messages_count: messages.length,
      total_meetings_count: meetings.length,
      commitments: commitmentsData.map((c: any) => ({ id: c.id, commitment: c.commitment, makerType: c.maker_type, status: c.status, dueDate: c.due_date })),
      proposals: quotes.map((q: any) => ({ id: q.id, title: q.title || 'Proposal', amount: Number(q.total_amount || 0), status: q.status, createdAt: q.created_at })),
      calendar_events: {
        past: pastMeetings,
        today: todayMeetings,
        future: futureMeetings,
      },
      decisions: decisionsData.map((d: any) => ({ id: d.id, title: d.title, decidedAt: d.decided_at || d.created_at })),
      days_since_last_activity: daysSinceLastActivity,
      average_payment_days: null,
      churn_risk_score: round2(0.15),
      lifetime_value: round2(totalRevenue + activeDealValue * 0.5),
      engagement_score: round2(Math.min(100, messages.length * 2 + meetings.length * 5)),
      timeline: timeline.slice(0, 100),
      linked_lead_ids: leadIds,
      linked_contact_ids: contactIds,
      linked_client_ids: clientIds
    };
  }

  private async resolveLeads(supabase: SupabaseClient, tenantId: string, email: string): Promise<string[]> {
    const { data } = await supabase.from('leads').select('id').eq('tenant_id', tenantId).ilike('email', email).limit(10);
    return Array.isArray(data) ? data.map((r: any) => String(r.id)) : [];
  }

  private async resolveContacts(supabase: SupabaseClient, tenantId: string, email: string): Promise<string[]> {
    const { data } = await supabase.from('contacts').select('id').eq('tenant_id', tenantId).ilike('email', email).limit(10);
    return Array.isArray(data) ? data.map((r: any) => String(r.id)) : [];
  }

  private async resolveClients(supabase: SupabaseClient, tenantId: string, email: string): Promise<string[]> {
    const { data } = await supabase.from('business_clients').select('id').eq('tenant_id', tenantId).ilike('email', email).limit(10);
    return Array.isArray(data) ? data.map((r: any) => String(r.id)) : [];
  }

  private async resolveIdentity(
    supabase: SupabaseClient, tenantId: string, email: string,
    leadIds: string[], contactIds: string[], clientIds: string[]
  ): Promise<{ name: string; phone?: string; company?: string }> {
    if (clientIds.length > 0) {
      const { data } = await supabase.from('business_clients').select('name, phone, company').eq('id', clientIds[0]).single();
      if (data) return { name: data.name || email, phone: data.phone, company: data.company };
    }
    if (contactIds.length > 0) {
      const { data } = await supabase.from('contacts').select('first_name, last_name, full_name, phone').eq('id', contactIds[0]).single();
      if (data) return { name: data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || email, phone: data.phone };
    }
    return { name: email };
  }

  private async fetchDeals(supabase: SupabaseClient, tenantId: string, userIds: string[], email: string): Promise<any[]> {
    if (userIds.length === 0) return [];
    const { data } = await supabase.from('deals').select('*').eq('tenant_id', tenantId).in('contact_id', userIds).limit(50);
    return Array.isArray(data) ? data : [];
  }

  private async fetchInvoices(supabase: SupabaseClient, tenantId: string, userIds: string[], email: string): Promise<any[]> {
    if (userIds.length === 0) return [];
    const { data } = await supabase.from('business_invoices').select('*').eq('tenant_id', tenantId).in('client_id', userIds).limit(100);
    return Array.isArray(data) ? data : [];
  }

  private async fetchMessages(supabase: SupabaseClient, tenantId: string, userIds: string[]): Promise<any[]> {
    if (userIds.length === 0) return [];
    const { data } = await supabase.from('messages').select('*').eq('tenant_id', tenantId).limit(50);
    return Array.isArray(data) ? data : [];
  }

  private async fetchMeetings(supabase: SupabaseClient, tenantId: string, userIds: string[], email: string): Promise<any[]> {
    const { data } = await supabase.from('calendar_events').select('*').eq('tenant_id', tenantId).limit(30);
    return Array.isArray(data) ? data : [];
  }

  private async fetchTasks(supabase: SupabaseClient, tenantId: string, userIds: string[]): Promise<any[]> {
    const { data } = await supabase.from('tasks').select('*').eq('tenant_id', tenantId).limit(30);
    return Array.isArray(data) ? data : [];
  }

  private async fetchContracts(supabase: SupabaseClient, tenantId: string, userIds: string[], email: string): Promise<any[]> {
    if (userIds.length === 0) return [];
    const { data } = await supabase.from('contracts').select('*').eq('tenant_id', tenantId).in('client_id', userIds).limit(20);
    return Array.isArray(data) ? data : [];
  }

  private async fetchQuotes(supabase: SupabaseClient, tenantId: string, userIds: string[], email: string): Promise<any[]> {
    if (userIds.length === 0) return [];
    const { data } = await supabase.from('quotes').select('*').eq('tenant_id', tenantId).in('client_id', userIds).limit(20);
    return Array.isArray(data) ? data : [];
  }

  private async fetchCommitments(supabase: SupabaseClient, tenantId: string, clientIds: string[]): Promise<any[]> {
    if (clientIds.length === 0) return [];
    const { data } = await supabase.from('commitments').select('*').eq('tenant_id', tenantId).in('client_id', clientIds).limit(30);
    return Array.isArray(data) ? data : [];
  }

  private async fetchDecisions(supabase: SupabaseClient, tenantId: string, clientIds: string[]): Promise<any[]> {
    const { data } = await supabase.from('project_decisions').select('*').eq('tenant_id', tenantId).limit(20);
    return Array.isArray(data) ? data : [];
  }

  private async fetchOutreachLog(
    supabase: SupabaseClient,
    tenantId: string,
    email: string,
    leadIds: string[],
  ): Promise<Array<{ id: string; status?: string; subject?: string; campaign_name?: string; sent_at?: string; created_at: string; source_label?: string }>> {
    if (!email && !leadIds.length) return [];
    const filters = leadIds.length
      ? `lead_id.in.(${leadIds.join(',')})`
      : `lead_email.ilike.${email}`;
    const { data } = await supabase
      .from('lead_outreach_log')
      .select('id, status, subject, campaign_name, sent_at, created_at, metadata')
      .eq('tenant_id', tenantId)
      .or(filters)
      .order('created_at', { ascending: false })
      .limit(40);
    return (data || []).map((row: any) => ({
      id: row.id,
      status: row.status,
      subject: row.subject,
      campaign_name: row.campaign_name,
      sent_at: row.sent_at,
      created_at: row.created_at,
      source_label: row.metadata?.source_agent || row.metadata?.source || 'Outreach',
    }));
  }
}

export const customer360Service = new Customer360Service();
