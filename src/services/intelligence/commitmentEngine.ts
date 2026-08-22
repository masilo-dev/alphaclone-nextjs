import { supabase } from '@/lib/supabase';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface CommitmentRecord {
  id: string;
  tenant_id: string;
  project_id?: string;
  client_id?: string;
  task_id?: string;
  commitment: string;
  maker_type: 'our_team' | 'client';
  maker_name?: string;
  recipient_name?: string;
  date_made: string;
  due_date?: string;
  status: 'pending' | 'fulfilled' | 'overdue' | 'waived';
  evidence?: string;
  source_type?: 'email' | 'meeting' | 'task_note' | 'proposal' | 'contract' | 'manual';
  source_id?: string;
  created_at: string;
  updated_at: string;
}

export class CommitmentEngine {
  /**
   * Create a new commitment record
   */
  async createCommitment(data: Omit<CommitmentRecord, 'id' | 'created_at' | 'updated_at'>): Promise<{ commitment: CommitmentRecord | null; error: string | null }> {
    try {
      const admin = createSupabaseAdminClient();
      const { data: inserted, error } = await admin
        .from('commitments')
        .insert({
          ...data,
          status: data.status || 'pending',
          date_made: data.date_made || new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) {
        console.warn('[CommitmentEngine] Failed to create commitment:', error.message);
        return { commitment: null, error: error.message };
      }

      return { commitment: inserted as CommitmentRecord, error: null };
    } catch (err) {
      return { commitment: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get all commitments for a project
   */
  async getProjectCommitments(tenantId: string, projectId: string): Promise<CommitmentRecord[]> {
    try {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from('commitments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data as CommitmentRecord[];
    } catch {
      return [];
    }
  }

  /**
   * Get all commitments for a client across all projects
   */
  async getClientCommitments(tenantId: string, clientId: string): Promise<CommitmentRecord[]> {
    try {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from('commitments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data as CommitmentRecord[];
    } catch {
      return [];
    }
  }

  /**
   * Get overdue or upcoming commitments for reminder checks
   */
  async getActionableCommitments(tenantId: string): Promise<{ overdue: CommitmentRecord[]; upcoming: CommitmentRecord[] }> {
    try {
      const admin = createSupabaseAdminClient();
      const now = new Date();
      const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await admin
        .from('commitments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending');

      if (error || !data) return { overdue: [], upcoming: [] };

      const records = data as CommitmentRecord[];
      const overdue = records.filter(c => c.due_date && new Date(c.due_date) < now);
      const upcoming = records.filter(c => c.due_date && new Date(c.due_date) >= now && c.due_date <= next24h);

      return { overdue, upcoming };
    } catch {
      return { overdue: [], upcoming: [] };
    }
  }

  /**
   * Extract commitments from free text (email, meeting note, task note)
   */
  extractCommitmentsFromText(
    text: string,
    context: { tenantId: string; projectId?: string; clientId?: string; sourceType: CommitmentRecord['source_type']; sourceId?: string }
  ): Partial<CommitmentRecord>[] {
    const extracted: Partial<CommitmentRecord>[] = [];
    const lower = text.toLowerCase();

    // Heuristic patterns for team & client promises
    const ourPatterns = [
      /we(?:'ll| will| shall) (?:send|deliver|complete|provide|finish|submit|approve|share) ([^.\n]+)/gi,
      /i(?:'ll| will) (?:send|deliver|complete|provide|finish|submit|approve|share) ([^.\n]+)/gi,
      /our team (?:will|is going to) ([^.\n]+)/gi,
    ];

    const clientPatterns = [
      /you(?:'ll| will) (?:send|provide|approve|confirm|share|pay) ([^.\n]+)/gi,
      /client (?:will|promised to|agreed to) ([^.\n]+)/gi,
      /i'll send (?:the logo|the content|approval|feedback|access) ([^.\n]+)/gi,
    ];

    for (const pattern of ourPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        extracted.push({
          tenant_id: context.tenantId,
          project_id: context.projectId,
          client_id: context.clientId,
          commitment: match[0].trim(),
          maker_type: 'our_team',
          source_type: context.sourceType,
          source_id: context.sourceId,
          status: 'pending',
          date_made: new Date().toISOString(),
        });
      }
    }

    for (const pattern of clientPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        extracted.push({
          tenant_id: context.tenantId,
          project_id: context.projectId,
          client_id: context.clientId,
          commitment: match[0].trim(),
          maker_type: 'client',
          source_type: context.sourceType,
          source_id: context.sourceId,
          status: 'pending',
          date_made: new Date().toISOString(),
        });
      }
    }

    return extracted;
  }

  /**
   * Mark a commitment fulfilled
   */
  async updateStatus(tenantId: string, commitmentId: string, status: CommitmentRecord['status'], evidence?: string): Promise<boolean> {
    try {
      const admin = createSupabaseAdminClient();
      const { error } = await admin
        .from('commitments')
        .update({
          status,
          evidence,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', commitmentId);

      return !error;
    } catch {
      return false;
    }
  }
}

export const commitmentEngine = new CommitmentEngine();
