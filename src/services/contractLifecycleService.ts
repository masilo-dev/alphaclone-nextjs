import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface ContractTemplateRecord {
  id: string;
  tenantId?: string | null;
  name: string;
  category: string;
  description?: string | null;
  content: string;
  outputFormat: 'html' | 'markdown' | 'text';
  approvalRequired: boolean;
  isActive: boolean;
  isDefault: boolean;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContractApprovalRecord {
  id: string;
  tenantId: string;
  contractId: string;
  contractVersionId?: string | null;
  requestedBy?: string | null;
  approverId?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestNote?: string | null;
  decisionNote?: string | null;
  dueAt?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

function activeTenantId(): string {
  const tenantId = tenantService.getCurrentTenantId();
  if (!tenantId) throw new Error('Select a workspace first.');
  return tenantId;
}

export const contractLifecycleService = {
  async getTemplates(): Promise<{ templates: ContractTemplateRecord[]; error: string | null }> {
    try {
      const tenantId = activeTenantId();
      const { data, error } = await supabase.from('contract_templates').select('*').or(`tenant_id.eq.${tenantId},tenant_id.is.null`).eq('is_active', true).order('is_default', { ascending: false }).order('name');
      if (error) throw error;
      return { templates: (data || []).map((row: any) => ({ id: row.id, tenantId: row.tenant_id, name: row.name, category: row.category, description: row.description, content: row.content, outputFormat: row.output_format, approvalRequired: Boolean(row.approval_required), isActive: Boolean(row.is_active), isDefault: Boolean(row.is_default), versionNumber: Number(row.version_number || 1), createdAt: row.created_at, updatedAt: row.updated_at })), error: null };
    } catch (error) { return { templates: [], error: error instanceof Error ? error.message : 'Templates could not be loaded' }; }
  },
  async getApprovals(contractId?: string): Promise<{ approvals: ContractApprovalRecord[]; error: string | null }> {
    try {
      const tenantId = activeTenantId();
      let query = supabase.from('contract_approvals').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
      if (contractId) query = query.eq('contract_id', contractId);
      const { data, error } = await query;
      if (error) throw error;
      return { approvals: (data || []).map((row: any) => ({ id: row.id, tenantId: row.tenant_id, contractId: row.contract_id, contractVersionId: row.contract_version_id, requestedBy: row.requested_by, approverId: row.approver_id, status: row.status, requestNote: row.request_note, decisionNote: row.decision_note, dueAt: row.due_at, decidedAt: row.decided_at, createdAt: row.created_at, updatedAt: row.updated_at })), error: null };
    } catch (error) { return { approvals: [], error: error instanceof Error ? error.message : 'Approvals could not be loaded' }; }
  },
};
