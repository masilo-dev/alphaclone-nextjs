import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import { generateText } from './unifiedAIService';
import { tenantService } from './tenancy/TenantService';

export interface Contract {
    id: string;
    project_id?: string;
    owner_id?: string; // Admin
    client_id?: string;
    title: string;
    type: string; // 'NDA', 'Service', etc.
    status: 'draft' | 'sent' | 'client_signed' | 'fully_signed' | 'rejected';
    content: string; // HTML/Text
    client_signature?: string;
    client_signed_at?: string;
    admin_signature?: string;
    admin_signed_at?: string;
    created_at: string;
}

export const contractService = {
    /**
     * Get tenant ID (required for all operations)
     */
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    /**
     * Create a new contract
     */
    async createContract(contract: Partial<Contract>) {
        const tenantId = this.getTenantId();
        const { data: userData } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('contracts')
            .insert({
                tenant_id: tenantId, // ← ASSIGN TO TENANT
                ...contract,
                owner_id: userData.user?.id,
                status: 'draft',
            })
            .select()
            .single();

        return { contract: data, error };
    },

    /**
     * Update contract content/status
     */
    async updateContract(id: string, updates: Partial<Contract>) {
        const tenantId = this.getTenantId();

        const { data, error } = await supabase
            .from('contracts')
            .update(updates)
            .eq('id', id)
            .eq('tenant_id', tenantId) // ← VERIFY OWNERSHIP
            .select()
            .single();
        return { contract: data, error };
    },

    /**
     * Generate Draft with AI
     */
    async generateDraft(type: string, clientName: string, projectDetails: string) {
        const prompt = `Write a professional legal contract for a ${type}.
        Client Name: ${clientName}
        Project Details: ${projectDetails}

        Include standard clauses for Confidentiality, Payment Terms, and Termination.
        Format as clear text suitable for a contract editor.`;

        // Use unified AI service (supports Claude, Gemini, OpenAI)
        return await generateText(prompt, 3000);
    },

    /**
     * Get user contracts (admin or client)
     */
    async getUserContracts(userId: string, userRole?: string) {
        const tenantId = this.getTenantId();

        let query = supabase
            .from('contracts')
            .select(`*, project:projects(name)`)
            .eq('tenant_id', tenantId); // ← TENANT FILTER

        // ✅ FIX: Admin sees ALL contracts, others see only their own
        if (userRole !== 'admin' && userRole !== 'tenant_admin') {
            query = query.or(`owner_id.eq.${userId},client_id.eq.${userId}`);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        return { contracts: data, error };
    },

    /**
     * Sign a contract
     */
    async signContract(contractId: string, role: 'client' | 'admin', signatureDataUrl: string) {
        const updates: any = {};
        const now = new Date().toISOString();

        if (role === 'client') {
            updates.client_signature = signatureDataUrl;
            updates.client_signed_at = now;
            updates.status = 'client_signed';
        } else {
            updates.admin_signature = signatureDataUrl;
            updates.admin_signed_at = now;
            updates.status = 'fully_signed'; // Admin sign usually finalizes
        }

        const { data, error } = await supabase
            .from('contracts')
            .update(updates)
            .eq('id', contractId)
            .select()
            .single();

        return { contract: data, error };
    },

    /**
     * Generate PDF for a contract
     */
    generatePDF(contract: Contract) {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text(contract.title, 20, 20);

        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Contract ID: ${contract.id.slice(0, 8)}`, 20, 30);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 36);

        // Content
        let yPos = 50;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);

        const splitText = doc.splitTextToSize(contract.content || '', 170);
        doc.text(splitText, 20, yPos);

        // Signatures
        const contentHeight = splitText.length * 7;
        yPos += contentHeight + 20;

        // Client Signature
        if (contract.client_signature) {
            doc.text('Client Signature:', 20, yPos);
            doc.addImage(contract.client_signature, 'PNG', 20, yPos + 5, 50, 20);
            doc.text(contract.client_signed_at ? new Date(contract.client_signed_at).toLocaleDateString() : '', 20, yPos + 30);
        }

        // Admin Signature
        if (contract.admin_signature) {
            doc.text('Executive Signature:', 100, yPos);
            doc.addImage(contract.admin_signature, 'PNG', 100, yPos + 5, 50, 20);
            doc.text(contract.admin_signed_at ? new Date(contract.admin_signed_at).toLocaleDateString() : '', 100, yPos + 30);
        }

        return doc;
    },

    downloadPDF(contract: Contract) {
        const doc = this.generatePDF(contract);
        doc.save(`${contract.title.replace(/\s+/g, '_')}.pdf`);
    }
};
