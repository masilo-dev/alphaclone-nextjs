import type { SupabaseClient } from '@supabase/supabase-js';

export interface GraphNode {
  id: string;
  label: string;
  type: 'contact' | 'company' | 'deal';
  influence_score: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: 'works_at' | 'associated_with' | 'colleague' | 'decision_maker';
  strength: number; // 0 to 1
}

export interface NetworkGraphReport {
  nodes: GraphNode[];
  edges: GraphEdge[];
  key_influencers: string[];
}

class NetworkGraphService {
  /**
   * Constructs an organizational and relationship map identifying influence
   * nodes within a target account by linking shared deals, company domains, and interactions.
   */
  async buildAccountNetwork(
    supabase: SupabaseClient,
    tenantId: string,
    companyId: string
  ): Promise<NetworkGraphReport> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // 1. Fetch Company Node
    const { data: company } = await supabase
      .from('business_clients')
      .select('id, name')
      .eq('id', companyId)
      .eq('tenant_id', tenantId)
      .single();

    if (!company) {
      throw new Error(`Company ${companyId} not found`);
    }

    nodes.push({
      id: company.id,
      label: company.name || 'Company',
      type: 'company',
      influence_score: 1.0
    });

    // 2. Fetch associated deals
    const { data: deals } = await supabase
      .from('deals')
      .select('id, name, value, contact_id')
      .eq('client_id', companyId)
      .eq('tenant_id', tenantId);

    const dealList = Array.isArray(deals) ? deals : [];
    const contactIds = new Set<string>();

    dealList.forEach(d => {
      nodes.push({
        id: d.id,
        label: d.name || 'Deal',
        type: 'deal',
        influence_score: d.value ? Math.min(1.0, d.value / 100000) : 0.5
      });
      edges.push({
        source: company.id,
        target: d.id,
        relationship: 'associated_with',
        strength: 0.8
      });

      if (d.contact_id) {
        contactIds.add(d.contact_id);
        edges.push({
          source: d.contact_id,
          target: d.id,
          relationship: 'decision_maker',
          strength: 0.9
        });
      }
    });

    // 3. Fetch all contacts associated directly via company matching
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, company')
      .eq('tenant_id', tenantId)
      .ilike('company', `%${company.name}%`);

    const contactList = Array.isArray(contacts) ? contacts : [];
    
    contactList.forEach(c => {
      contactIds.add(c.id);
      nodes.push({
        id: c.id,
        label: c.name || 'Contact',
        type: 'contact',
        influence_score: 0.5 // Default, can be weighted by title
      });
      edges.push({
        source: c.id,
        target: company.id,
        relationship: 'works_at',
        strength: 1.0
      });
    });

    // Extract influencers based on incoming edge counts
    const influencers = nodes
      .filter(n => n.type === 'contact')
      .sort((a, b) => b.influence_score - a.influence_score)
      .slice(0, 3)
      .map(n => n.id);

    return {
      nodes,
      edges,
      key_influencers: influencers
    };
  }
}

export const networkGraphService = new NetworkGraphService();
