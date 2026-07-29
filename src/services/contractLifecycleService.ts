import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface ContractTemplateRecord {
<<<<<<< HEAD
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
=======
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

export interface ContractVersionRecord {
    id: string;
    tenantId?: string | null;
    contractId: string;
    versionNumber: number;
    content: string;
    status: 'draft' | 'approval_pending' | 'approved' | 'rejected' | 'superseded';
    changeSummary?: string | null;
    createdAt: string;
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

export const contractLifecycleService = {
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    async getTemplates(): Promise<{ templates: ContractTemplateRecord[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('contract_templates')
                .select('*')
                .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
                .eq('is_active', true)
                .order('is_default', { ascending: false })
                .order('name', { ascending: true });

            if (error) throw error;
            return { templates: (data || []).map(this.mapTemplate), error: null };
        } catch (err: any) {
            console.error('Error fetching contract templates:', err);
            return { templates: [], error: err.message };
        }
    },

    async createTemplate(input: Partial<ContractTemplateRecord>): Promise<{ template: ContractTemplateRecord | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();
            const { data, error } = await supabase
                .from('contract_templates')
                .insert({
                    tenant_id: tenantId,
                    name: input.name,
                    category: input.category || 'service',
                    description: input.description,
                    content: input.content || '',
                    output_format: input.outputFormat || 'html',
                    approval_required: input.approvalRequired ?? false,
                    is_active: input.isActive ?? true,
                    is_default: input.isDefault ?? false,
                    version_number: input.versionNumber || 1,
                    created_by: userData.user?.id,
                    updated_by: userData.user?.id,
                })
                .select('*')
                .single();

            if (error) throw error;
            return { template: this.mapTemplate(data), error: null };
        } catch (err: any) {
            console.error('Error creating contract template:', err);
            return { template: null, error: err.message };
        }
    },

    async getVersions(contractId: string): Promise<{ versions: ContractVersionRecord[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('contract_versions')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('contract_id', contractId)
                .order('version_number', { ascending: false });

            if (error) throw error;
            return { versions: (data || []).map(this.mapVersion), error: null };
        } catch (err: any) {
            console.error('Error fetching contract versions:', err);
            return { versions: [], error: err.message };
        }
    },

    async createVersion(input: {
        contractId: string;
        content: string;
        changeSummary?: string;
        status?: ContractVersionRecord['status'];
    }): Promise<{ version: ContractVersionRecord | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();
            const { data: latest } = await supabase
                .from('contract_versions')
                .select('version_number')
                .eq('tenant_id', tenantId)
                .eq('contract_id', input.contractId)
                .order('version_number', { ascending: false })
                .limit(1)
                .maybeSingle();

            const nextVersion = Number(latest?.version_number || 0) + 1;
            const { data, error } = await supabase
                .from('contract_versions')
                .insert({
                    tenant_id: tenantId,
                    contract_id: input.contractId,
                    version_number: nextVersion,
                    content: input.content,
                    status: input.status || 'draft',
                    change_summary: input.changeSummary,
                    created_by: userData.user?.id,
                })
                .select('*')
                .single();

            if (error) throw error;
            return { version: this.mapVersion(data), error: null };
        } catch (err: any) {
            console.error('Error creating contract version:', err);
            return { version: null, error: err.message };
        }
    },

    async getApprovals(contractId?: string): Promise<{ approvals: ContractApprovalRecord[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            let query = supabase
                .from('contract_approvals')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (contractId) query = query.eq('contract_id', contractId);

            const { data, error } = await query;
            if (error) throw error;
            return { approvals: (data || []).map(this.mapApproval), error: null };
        } catch (err: any) {
            console.error('Error fetching contract approvals:', err);
            return { approvals: [], error: err.message };
        }
    },

    async requestApproval(input: {
        contractId: string;
        contractVersionId?: string;
        approverId?: string;
        requestNote?: string;
        dueAt?: string;
    }): Promise<{ approval: ContractApprovalRecord | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();
            const { data, error } = await supabase
                .from('contract_approvals')
                .insert({
                    tenant_id: tenantId,
                    contract_id: input.contractId,
                    contract_version_id: input.contractVersionId,
                    requested_by: userData.user?.id,
                    approver_id: input.approverId,
                    request_note: input.requestNote,
                    due_at: input.dueAt,
                    status: 'pending',
                })
                .select('*')
                .single();

            if (error) throw error;

            if (input.contractVersionId) {
                await supabase
                    .from('contract_versions')
                    .update({ status: 'approval_pending' })
                    .eq('id', input.contractVersionId)
                    .eq('tenant_id', tenantId);
            }

            return { approval: this.mapApproval(data), error: null };
        } catch (err: any) {
            console.error('Error requesting contract approval:', err);
            return { approval: null, error: err.message };
        }
    },

    async reviewApproval(input: {
        approvalId: string;
        status: 'approved' | 'rejected' | 'cancelled';
        decisionNote?: string;
    }): Promise<{ approval: ContractApprovalRecord | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('contract_approvals')
                .update({
                    status: input.status,
                    decision_note: input.decisionNote,
                    decided_at: new Date().toISOString(),
                })
                .eq('id', input.approvalId)
                .eq('tenant_id', tenantId)
                .select('*')
                .single();

            if (error) throw error;

            if (data?.contract_version_id) {
                await supabase
                    .from('contract_versions')
                    .update({ status: input.status === 'approved' ? 'approved' : 'rejected' })
                    .eq('id', data.contract_version_id)
                    .eq('tenant_id', tenantId);
            }

            return { approval: this.mapApproval(data), error: null };
        } catch (err: any) {
            console.error('Error reviewing contract approval:', err);
            return { approval: null, error: err.message };
        }
    },

    mapTemplate(row: any): ContractTemplateRecord {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            name: row.name,
            category: row.category,
            description: row.description,
            content: row.content,
            outputFormat: row.output_format,
            approvalRequired: Boolean(row.approval_required),
            isActive: Boolean(row.is_active),
            isDefault: Boolean(row.is_default),
            versionNumber: Number(row.version_number || 1),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    },

    mapVersion(row: any): ContractVersionRecord {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            contractId: row.contract_id,
            versionNumber: Number(row.version_number || 1),
            content: row.content,
            status: row.status,
            changeSummary: row.change_summary,
            createdAt: row.created_at,
        };
    },

    mapApproval(row: any): ContractApprovalRecord {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            contractId: row.contract_id,
            contractVersionId: row.contract_version_id,
            requestedBy: row.requested_by,
            approverId: row.approver_id,
            status: row.status,
            requestNote: row.request_note,
            decisionNote: row.decision_note,
            dueAt: row.due_at,
            decidedAt: row.decided_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    },
>>>>>>> origin/main
};
