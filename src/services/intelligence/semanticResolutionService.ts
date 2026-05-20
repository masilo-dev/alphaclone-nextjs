import { generateText } from '../unifiedAIService';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolutionMatch {
  source_id: string;
  duplicate_id: string;
  entity_type: 'contact' | 'company' | 'lead';
  confidence_score: number; // 0 to 100
  matching_fields: string[];
  proposed_target_id: string;
  merge_payload: {
    emails: string[];
    phones: string[];
    names: string[];
    companies: string[];
  };
}

export interface MergeExecutionReport {
  success: boolean;
  surviving_id: string;
  archived_ids: string[];
  records_merged: number;
  message: string;
}

class SemanticResolutionService {
  /**
   * Scans lead and contact lists to locate duplicates using Levenshtein distance
   * and deep AI context parsing (Semantic Entity Resolution).
   */
  async scanForDuplicates(
    supabase: SupabaseClient,
    tenantId: string,
    entityType: 'contact' | 'lead' = 'contact'
  ): Promise<ResolutionMatch[]> {
    const matches: ResolutionMatch[] = [];

    // 1. Fetch all active entities for this tenant
    const table = entityType === 'lead' ? 'leads' : 'contacts';
    const { data: records } = await supabase
      .from(table)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (!Array.isArray(records) || records.length < 2) return [];

    // 2. Perform fuzzy comparisons
    for (let i = 0; i < records.length; i++) {
      const recordA = records[i];

      for (let j = i + 1; j < records.length; j++) {
        const recordB = records[j];
        const matchingFields: string[] = [];
        let score = 0;

        // Clean values for normalization
        const nameA = String(recordA.name || '').trim().toLowerCase();
        const nameB = String(recordB.name || '').trim().toLowerCase();
        const emailA = String(recordA.email || '').trim().toLowerCase();
        const emailB = String(recordB.email || '').trim().toLowerCase();
        const phoneA = this.cleanPhone(recordA.phone);
        const phoneB = this.cleanPhone(recordB.phone);

        // Direct Email match
        if (emailA && emailA === emailB) {
          score += 60;
          matchingFields.push('email');
        }

        // Direct Phone match
        if (phoneA && phoneA === phoneB) {
          score += 50;
          matchingFields.push('phone');
        }

        // Fuzzy Name similarity using simple Levenshtein
        if (nameA && nameB) {
          const distance = this.levenshteinDistance(nameA, nameB);
          const maxLen = Math.max(nameA.length, nameB.length);
          const similarity = maxLen > 0 ? (maxLen - distance) / maxLen : 0;

          if (similarity > 0.85) {
            score += 40;
            matchingFields.push('name');
          } else if (similarity > 0.7) {
            score += 20;
            matchingFields.push('fuzzy_name');
          }
        }

        // Apply weights and cap at 100
        const confidenceScore = Math.min(100, score);

        // Propose merge if above threshold
        if (confidenceScore >= 50) {
          const surviving = new Date(recordA.created_at).getTime() < new Date(recordB.created_at).getTime()
            ? recordA.id
            : recordB.id;

          matches.push({
            source_id: recordA.id,
            duplicate_id: recordB.id,
            entity_type: entityType,
            confidence_score: confidenceScore,
            matching_fields: matchingFields,
            proposed_target_id: surviving,
            merge_payload: {
              emails: Array.from(new Set([recordA.email, recordB.email].filter(Boolean))),
              phones: Array.from(new Set([recordA.phone, recordB.phone].filter(Boolean))),
              names: Array.from(new Set([recordA.name, recordB.name].filter(Boolean))),
              companies: Array.from(new Set([recordA.company, recordB.company].filter(Boolean)))
            }
          });
        }
      }
    }

    // 3. Optional: AI review of critical matches to prevent false positives
    return this.refineMatchesWithAI(matches, tenantId);
  }

  /**
   * Asks AI to verify borderline matches using company context, industry domain rules, or secondary notes.
   */
  private async refineMatchesWithAI(
    matches: ResolutionMatch[],
    tenantId: string
  ): Promise<ResolutionMatch[]> {
    const borderline = matches.filter(m => m.confidence_score >= 50 && m.confidence_score < 80);
    const highlyConfident = matches.filter(m => m.confidence_score >= 80);

    if (borderline.length === 0) return matches;

    const prompt = `You are a Semantic Data Cleansing Specialist.
Your task is to analyze these borderline duplicate match proposals and decide if they represent the same person/company or distinct entities.

MATCH ENTRIES:
${JSON.stringify(borderline.map(b => ({
  id_pair: `${b.source_id} <-> ${b.duplicate_id}`,
  names: b.merge_payload.names,
  emails: b.merge_payload.emails,
  phones: b.merge_payload.phones,
  companies: b.merge_payload.companies
})), null, 2)}

Provide your output as a single clean JSON array indicating only which pair IDs are actual duplicate records:
[
  { "id_pair": "uuid-1 <-> uuid-2", "is_duplicate": true, "reason": "Consistent domain and matching name spelling variance" }
]`;

    try {
      const { text } = await generateText(prompt, 1000, 'claude-sonnet-4-6-20260217', tenantId);
      const jsonStart = text?.indexOf('[');
      const jsonEnd = (text?.lastIndexOf(']') ?? -1) + 1;

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const aiDecisions = JSON.parse(text!.slice(jsonStart, jsonEnd));
        const verifiedBorderline = borderline.filter(b => {
          const decision = aiDecisions.find((d: any) => d.id_pair === `${b.source_id} <-> ${b.duplicate_id}`);
          return decision ? decision.is_duplicate : false;
        });

        return [...highlyConfident, ...verifiedBorderline];
      }
    } catch (e) {
      console.warn('AI duplicate refinement skipped due to parsing error:', e);
    }

    return matches;
  }

  /**
   * Executes the merge, consolidating activities and transitioning duplicates safely.
   */
  async executeMerge(
    supabase: SupabaseClient,
    tenantId: string,
    match: ResolutionMatch
  ): Promise<MergeExecutionReport> {
    const table = match.entity_type === 'lead' ? 'leads' : 'contacts';
    const sourceId = match.proposed_target_id;
    const redundantId = match.source_id === sourceId ? match.duplicate_id : match.source_id;

    try {
      // 1. Fetch records to make sure they exist
      const { data: surviving } = await supabase.from(table).select('*').eq('id', sourceId).eq('tenant_id', tenantId).single();
      const { data: redundant } = await supabase.from(table).select('*').eq('id', redundantId).eq('tenant_id', tenantId).single();

      if (!surviving || !redundant) {
        throw new Error('One or both entities not found in workspace.');
      }

      // 2. Consolidate core fields into surviving record
      const updatedFields = {
        email: match.merge_payload.emails[0] || surviving.email,
        phone: match.merge_payload.phones[0] || surviving.phone,
        name: surviving.name || redundant.name,
        company: surviving.company || redundant.company,
        metadata: {
          ...(surviving.metadata || {}),
          merged_from: [...(surviving.metadata?.merged_from || []), redundantId],
          merged_at: new Date().toISOString()
        }
      };

      await supabase
        .from(table)
        .update(updatedFields)
        .eq('id', sourceId)
        .eq('tenant_id', tenantId);

      // 3. Re-link deal relationships
      await supabase
        .from('deals')
        .update({ contact_id: sourceId })
        .eq('contact_id', redundantId)
        .eq('tenant_id', tenantId);

      // 4. Delete the duplicate record
      await supabase
        .from(table)
        .delete()
        .eq('id', redundantId)
        .eq('tenant_id', tenantId);

      return {
        success: true,
        surviving_id: sourceId,
        archived_ids: [redundantId],
        records_merged: 1,
        message: `Successfully merged and consolidated duplicate record into ${sourceId}`
      };
    } catch (e: any) {
      return {
        success: false,
        surviving_id: sourceId,
        archived_ids: [redundantId],
        records_merged: 0,
        message: `Merge failed: ${e.message}`
      };
    }
  }

  private LevenshteinDistance(s: string, t: string): number {
    if (s.length === 0) return t.length;
    if (t.length === 0) return s.length;

    const d: number[][] = [];
    for (let i = 0; i <= s.length; i++) {
      d[i] = [i];
    }
    for (let j = 0; j <= t.length; j++) {
      d[0][j] = j;
    }

    for (let i = 1; i <= s.length; i++) {
      for (let j = 1; j <= t.length; j++) {
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + cost
        );
      }
    }

    return d[s.length][t.length];
  }

  private levenshteinDistance(s: string, t: string): number {
    return this.LevenshteinDistance(s, t);
  }

  private cleanPhone(phone: any): string {
    return String(phone || '').replace(/\D/g, '');
  }
}

export const semanticResolutionService = new SemanticResolutionService();
