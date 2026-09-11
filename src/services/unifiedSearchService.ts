/**
 * Unified Search Service - 120% Feature
 * Full-text search across all content with ranking and filters
 */

import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface SearchResult {
  id: string;
  type: 'contact' | 'company' | 'deal' | 'project' | 'task' | 'invoice' | 'campaign' | 'contract' | 'ticket' | 'message';
  title: string;
  subtitle: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
  updatedAt: string;
  route: string;
}

export interface SearchFilters {
  types?: SearchResult['type'][];
  dateRange?: { from: string; to: string };
  sortBy?: 'relevance' | 'date' | 'alphabetical';
  limit?: number;
}

/**
 * Unified search across all tables
 * 120% feature - One search for everything
 */
export async function unifiedSearch(
  query: string,
  filters?: SearchFilters
): Promise<{ results: SearchResult[]; total: number; suggestions: string[] }> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) return { results: [], total: 0, suggestions: [] };

    if (!query.trim()) {
      return { results: [], total: 0, suggestions: [] };
    }

    const searchTerm = query.toLowerCase().trim();
    const types = filters?.types || ['contact', 'company', 'deal', 'project', 'task', 'invoice'];
    const limit = filters?.limit || 50;

    // Parallel searches across all tables
    const searchPromises: Promise<SearchResult[]>[] = [];

    if (types.includes('contact')) {
      searchPromises.push(searchContacts(searchTerm, tenantId, limit));
    }
    if (types.includes('company')) {
      searchPromises.push(searchCompanies(searchTerm, tenantId, limit));
    }
    if (types.includes('deal')) {
      searchPromises.push(searchDeals(searchTerm, tenantId, limit));
    }
    if (types.includes('project')) {
      searchPromises.push(searchProjects(searchTerm, tenantId, limit));
    }
    if (types.includes('task')) {
      searchPromises.push(searchTasks(searchTerm, tenantId, limit));
    }
    if (types.includes('invoice')) {
      searchPromises.push(searchInvoices(searchTerm, tenantId, limit));
    }
    if (types.includes('campaign')) {
      searchPromises.push(searchCampaigns(searchTerm, tenantId, limit));
    }

    const results = (await Promise.all(searchPromises)).flat();

    // Score and rank results
    const scored = results.map(result => ({
      ...result,
      score: calculateRelevanceScore(result, searchTerm),
    }));

    // Sort by relevance score
    scored.sort((a, b) => b.score - a.score);

    // Apply date filter if provided
    let filtered = scored;
    if (filters?.dateRange) {
      filtered = scored.filter(r => 
        r.updatedAt >= filters.dateRange!.from && 
        r.updatedAt <= filters.dateRange!.to
      );
    }

    // Generate search suggestions based on partial matches
    const suggestions = generateSearchSuggestions(searchTerm, results);

    return {
      results: filtered.slice(0, limit),
      total: filtered.length,
      suggestions,
    };
  } catch (err) {
    console.error('Search failed:', err);
    return { results: [], total: 0, suggestions: [] };
  }
}

interface ContactRow { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; title: string | null; company: string | null; status: string; updated_at: string }

async function searchContacts(term: string, tenantId: string, limit: number): Promise<SearchResult[]> {
  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, title, company, status, updated_at')
    .eq('tenant_id', tenantId)
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,title.ilike.%${term}%`)
    .limit(limit);

  return (data || []).map((c: ContactRow) => ({
    id: c.id,
    type: 'contact',
    title: `${c.first_name} ${c.last_name}`,
    subtitle: c.email || c.phone || '',
    content: c.title ? `${c.title} at ${c.company || 'Unknown Company'}` : '',
    metadata: { status: c.status, company: c.company },
    score: 0,
    updatedAt: c.updated_at,
    route: `/dashboard/crm/contacts/${c.id}`,
  }));
}

interface CompanyRow { id: string; name: string; industry: string | null; website: string | null; updated_at: string }

async function searchCompanies(term: string, tenantId: string, limit: number): Promise<SearchResult[]> {
  const { data } = await supabase
    .from('companies')
    .select('id, name, industry, website, updated_at')
    .eq('tenant_id', tenantId)
    .or(`name.ilike.%${term}%,industry.ilike.%${term}%,website.ilike.%${term}%`)
    .limit(limit);

  return (data || []).map((c: CompanyRow) => ({
    id: c.id,
    type: 'company',
    title: c.name,
    subtitle: c.industry || '',
    content: c.website || '',
    metadata: { industry: c.industry },
    score: 0,
    updatedAt: c.updated_at,
    route: `/dashboard/crm/companies/${c.id}`,
  }));
}

interface DealRow { id: string; name: string; value: number | null; stage: string; contacts?: { first_name: string | null; last_name: string | null }; updated_at: string }

async function searchDeals(term: string, tenantId: string, limit: number): Promise<SearchResult[]> {
  const { data } = await supabase
    .from('deals')
    .select('id, name, value, stage, contacts(first_name, last_name), updated_at')
    .eq('tenant_id', tenantId)
    .or(`name.ilike.%${term}%,stage.ilike.%${term}%`)
    .limit(limit);

  return (data || []).map((d: DealRow) => ({
    id: d.id,
    type: 'deal',
    title: d.name,
    subtitle: `$${(d.value || 0).toLocaleString()}`,
    content: `Stage: ${d.stage} | Contact: ${d.contacts?.first_name || 'Unknown'} ${d.contacts?.last_name || ''}`,
    metadata: { value: d.value, stage: d.stage },
    score: 0,
    updatedAt: d.updated_at,
    route: `/dashboard/crm/deals/${d.id}`,
  }));
}

interface ProjectRow { id: string; name: string; status: string | null; description: string | null; updated_at: string }

async function searchProjects(term: string, tenantId: string, limit: number): Promise<SearchResult[]> {
  const { data } = await supabase
    .from('projects')
    .select('id, name, status, description, updated_at')
    .eq('tenant_id', tenantId)
    .or(`name.ilike.%${term}%,description.ilike.%${term}%`)
    .limit(limit);

  return (data || []).map((p: ProjectRow) => ({
    id: p.id,
    type: 'project',
    title: p.name,
    subtitle: p.status || 'Active',
    content: p.description?.substring(0, 100) || '',
    metadata: { status: p.status },
    score: 0,
    updatedAt: p.updated_at,
    route: `/dashboard/projects/${p.id}`,
  }));
}

interface TaskRow { id: string; title: string; description: string | null; status: string; priority: string; updated_at: string }

async function searchTasks(term: string, tenantId: string, limit: number): Promise<SearchResult[]> {
  const { data } = await supabase
    .from('tasks')
    .select('id, title, description, status, priority, updated_at')
    .eq('tenant_id', tenantId)
    .or(`title.ilike.%${term}%,description.ilike.%${term}%`)
    .limit(limit);

  return (data || []).map((t: TaskRow) => ({
    id: t.id,
    type: 'task',
    title: t.title,
    subtitle: `${t.status} | ${t.priority}`,
    content: t.description?.substring(0, 100) || '',
    metadata: { status: t.status, priority: t.priority },
    score: 0,
    updatedAt: t.updated_at,
    route: `/dashboard/tasks/${t.id}`,
  }));
}

interface InvoiceRow { id: string; invoice_number: string; total: number | null; status: string; notes: string | null; updated_at: string }

async function searchInvoices(term: string, tenantId: string, limit: number): Promise<SearchResult[]> {
  const { data } = await supabase
    .from('business_invoices')
    .select('id, invoice_number, total, status, notes, updated_at')
    .eq('tenant_id', tenantId)
    .or(`invoice_number.ilike.%${term}%,notes.ilike.%${term}%`)
    .limit(limit);

  return (data || []).map((i: InvoiceRow) => ({
    id: i.id,
    type: 'invoice',
    title: i.invoice_number,
    subtitle: `$${(i.total || 0).toLocaleString()} | ${i.status}`,
    content: i.notes?.substring(0, 100) || '',
    metadata: { total: i.total, status: i.status },
    score: 0,
    updatedAt: i.updated_at,
    route: `/dashboard/business/billing/manage?invoiceId=${i.id}`,
  }));
}

interface CampaignRow { id: string; name: string; subject: string | null; status: string; updated_at: string }

async function searchCampaigns(term: string, tenantId: string, limit: number): Promise<SearchResult[]> {
  const { data } = await supabase
    .from('email_campaigns')
    .select('id, name, subject, status, updated_at')
    .eq('tenant_id', tenantId)
    .or(`name.ilike.%${term}%,subject.ilike.%${term}%`)
    .limit(limit);

  return (data || []).map((c: CampaignRow) => ({
    id: c.id,
    type: 'campaign',
    title: c.name,
    subtitle: c.subject || '',
    content: `Status: ${c.status}`,
    metadata: { status: c.status },
    score: 0,
    updatedAt: c.updated_at,
    route: `/dashboard/marketing/campaigns/${c.id}`,
  }));
}

/**
 * Calculate relevance score based on match quality
 * 120% feature - Smart ranking
 */
function calculateRelevanceScore(result: SearchResult, term: string): number {
  let score = 0;
  const lowerTerm = term.toLowerCase();
  const lowerTitle = result.title.toLowerCase();
  const lowerContent = result.content.toLowerCase();

  // Exact match in title (highest priority)
  if (lowerTitle === lowerTerm) {
    score += 100;
  }
  // Starts with term in title
  else if (lowerTitle.startsWith(lowerTerm)) {
    score += 80;
  }
  // Contains term in title
  else if (lowerTitle.includes(lowerTerm)) {
    score += 60;
  }

  // Contains term in content
  if (lowerContent.includes(lowerTerm)) {
    score += 30;
  }

  // Boost by type priority
  const typePriority: Record<string, number> = {
    contact: 10,
    company: 8,
    deal: 8,
    project: 6,
    task: 4,
    invoice: 4,
    campaign: 3,
  };
  score += typePriority[result.type] || 0;

  // Recent items get a small boost
  const daysSinceUpdate = (Date.now() - new Date(result.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 7) {
    score += 5;
  }

  return score;
}

/**
 * Generate search suggestions
 */
function generateSearchSuggestions(term: string, results: SearchResult[]): string[] {
  const suggestions: Set<string> = new Set();

  // Add common search patterns
  if (term.length >= 3) {
    suggestions.add(`${term} contact`);
    suggestions.add(`${term} project`);
    suggestions.add(`${term} invoice`);
  }

  // Add related terms from results
  results.slice(0, 5).forEach(r => {
    if (r.type === 'contact' && r.metadata?.company) {
      suggestions.add(`${r.metadata.company} contacts`);
    }
    if (r.type === 'deal' && r.metadata?.stage) {
      suggestions.add(`${r.metadata.stage} deals`);
    }
  });

  return Array.from(suggestions).slice(0, 5);
}

/**
 * Recent items for quick access
 */
export async function getRecentItems(types?: SearchResult['type'][]): Promise<SearchResult[]> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) return [];

    const items: SearchResult[] = [];
    const typesToFetch = types || ['contact', 'deal', 'project', 'invoice'];

    if (typesToFetch.includes('contact')) {
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, updated_at')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .limit(5);
      
      items.push(...(data || []).map((c: { id: string; first_name: string; last_name: string; email: string | null; updated_at: string }) => ({
        id: c.id,
        type: 'contact' as const,
        title: `${c.first_name} ${c.last_name}`,
        subtitle: c.email || '',
        content: '',
        metadata: {},
        score: 0,
        updatedAt: c.updated_at,
        route: `/dashboard/crm/contacts/${c.id}`,
      })));
    }

    if (typesToFetch.includes('deal')) {
      const { data } = await supabase
        .from('deals')
        .select('id, name, value, updated_at')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .limit(5);

      items.push(...(data || []).map((d: { id: string; name: string; value: number | null; updated_at: string }) => ({
        id: d.id,
        type: 'deal' as const,
        title: d.name,
        subtitle: `$${(d.value || 0).toLocaleString()}`,
        content: '',
        metadata: { value: d.value },
        score: 0,
        updatedAt: d.updated_at,
        route: `/dashboard/crm/deals/${d.id}`,
      })));
    }

    // Sort by updated date
    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return items.slice(0, 10);
  } catch (err) {
    console.error('Failed to get recent items:', err);
    return [];
  }
}

/**
 * Save search for analytics
 */
export async function saveSearchAnalytics(query: string, resultCount: number): Promise<void> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) return;

    await supabase.from('search_analytics').insert({
      tenant_id: tenantId,
      query: query.toLowerCase(),
      result_count: resultCount,
      searched_at: new Date().toISOString(),
    });
  } catch (err) {
    // Silent fail - analytics shouldn't block search
    console.error('Failed to save search analytics:', err);
  }
}

/**
 * Get popular searches
 */
export async function getPopularSearches(limit: number = 10): Promise<string[]> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) return [];

    const { data } = await supabase.rpc('get_popular_searches', {
      p_tenant_id: tenantId,
      p_limit: limit,
    });

    return (data || []).map((d: any) => d.query);
  } catch (err) {
    console.error('Failed to get popular searches:', err);
    return [];
  }
}
