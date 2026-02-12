import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import { generateText } from './unifiedAIService';
import { tenantService } from './tenancy/TenantService';
import { esignatureComplianceService } from './esignatureComplianceService';

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
    payment_due_date?: string; // ISO Date
    payment_amount?: number;
    payment_status?: 'pending' | 'paid' | 'overdue';
    metadata?: {
        signer_ip?: string;
        content_hash?: string;
        version?: string;
    };
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
                tenant_id: tenantId,
                title: contract.title,
                content: contract.content,
                project_id: contract.project_id,
                client_id: contract.client_id, // Link to Client profile
                owner_id: userData.user?.id,   // Link to Admin user
                status: 'draft',
                payment_due_date: contract.payment_due_date,
                payment_amount: contract.payment_amount,
                payment_status: contract.payment_status || 'pending'
            })
            .select()
            .single();

        return { contract: data, error };
    },

    /**
     * Update contract content/status
     * LEGAL COMPLIANCE: Signed contracts cannot be edited
     */
    async updateContract(id: string, updates: Partial<Contract>) {
        const tenantId = this.getTenantId();

        // CRITICAL: Check if contract is signed
        const { data: existing, error: fetchError } = await supabase
            .from('contracts')
            .select('status')
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .single();

        if (fetchError) {
            return { contract: null, error: fetchError };
        }

        // LEGAL PROTECTION: Prevent editing signed contracts
        if (existing?.status === 'fully_signed' || existing?.status === 'client_signed') {
            // Only allow payment status updates on signed contracts
            const allowedFields = ['payment_status', 'payment_due_date'];
            const hasDisallowedUpdates = Object.keys(updates).some(
                key => !allowedFields.includes(key)
            );

            if (hasDisallowedUpdates) {
                return {
                    contract: null,
                    error: {
                        message: 'Cannot modify signed contracts. Create a new version or amendment instead.',
                        code: 'SIGNED_CONTRACT_IMMUTABLE'
                    } as any
                };
            }
        }

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
     * Clean markdown formatting from AI-generated text
     * Removes **, ~~, ####, -, *, and other markdown symbols
     */
    cleanMarkdown(text: string): string {
        if (!text) return '';

        return text
            // Remove markdown headers (####, ###, ##, #)
            .replace(/^#{1,6}\s+/gm, '')
            // Remove bold (**text** or __text__)
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/__(.+?)__/g, '$1')
            // Remove italic (*text* or _text_)
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/_(.+?)_/g, '$1')
            // Remove strikethrough (~~text~~)
            .replace(/~~(.+?)~~/g, '$1')
            // Remove code blocks (```text```)
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`(.+?)`/g, '$1')
            // Remove markdown links [text](url)
            .replace(/\[(.+?)\]\(.+?\)/g, '$1')
            // Remove markdown images ![alt](url)
            .replace(/!\[.*?\]\(.+?\)/g, '')
            // Remove horizontal rules (---, ***, ___)
            .replace(/^[-*_]{3,}$/gm, '')
            // Remove bullet points and list markers (-, *, +)
            .replace(/^[\s]*[-*+]\s+/gm, '')
            // Remove numbered lists (1., 2., etc.)
            .replace(/^[\s]*\d+\.\s+/gm, '')
            // Remove blockquotes (>)
            .replace(/^>\s+/gm, '')
            // Remove extra asterisks, tildes, hashes
            .replace(/[*~#]+/g, '')
            // Clean up multiple spaces
            .replace(/\s{2,}/g, ' ')
            // Clean up multiple newlines (keep max 2)
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    },

    /**
     * Generate Draft with AI
     */
    async generateDraft(type: string, clientName: string, projectDetails: string) {
        const prompt = `Act as an elite corporate legal counsel. Write a comprehensive, high-stakes professional ${type} for "${clientName}".

        Project Scope: ${projectDetails}

        STRUCTURE TO FOLLOW:
        1. MASTER SERVICE AGREEMENT: High-level purpose.
        2. SCOPE OF WORK: Detailed deliverables based on the project details.
        3. FINANCIAL TERMS: Explicitly mention payment structures and currency (USD).
        4. INTELLECTUAL PROPERTY: Assignment of rights upon full payment.
        5. CONFIDENTIALITY: Professional NDA clauses.
        6. LIMITATION OF LIABILITY & INDEMNIFICATION.
        7. TERMINATION & DISPUTE RESOLUTION.

        CRITICAL STYLING:
        - Output PLAIN TEXT ONLY - NO markdown formatting (no **, ~~, ####, ---, etc.)
        - DO NOT use placeholders like "__________" or "[INSERT HERE]". Populate with realistic, high-end defaults if specific data is missing.
        - Use sophisticated legal terminology (e.g., "Force Majeure", "Governing Law").
        - Ensure the tone is authoritative yet partnership-oriented.
        - Format with clear numbered sections (Section 1.0, 1.1, etc.).
        - Use proper spacing and line breaks only.
        - Explicitly state current date as the execution date.
        - Write as if this is a final printed legal document.`;

        // Use unified AI service (supports Claude, Gemini, OpenAI)
        const { text, error } = await generateText(prompt, 3000);

        if (error || !text) {
            return { text: null, error };
        }

        // Clean any markdown formatting that AI might have added
        const cleanedText = this.cleanMarkdown(text);

        return { text: cleanedText, error: null };
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
     * ESIGN COMPLIANT: Records full audit trail, consent, and tamper seals
     */
    async signContract(
        contractId: string,
        role: 'client' | 'admin',
        signatureDataUrl: string,
        signerInfo?: {
            id: string;
            name: string;
            email: string;
            consentGiven?: boolean;
            userAgent?: string;
        }
    ) {
        try {
            const response = await fetch('/api/contracts/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractId,
                    role,
                    signatureDataUrl,
                    signerName: signerInfo?.name || (role === 'admin' ? 'Administrator' : 'Client'),
                    signerEmail: signerInfo?.email || '',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to sign contract');
            }

            const { contract } = await response.json();
            return { contract, error: null };
        } catch (error: any) {
            console.error('Sign contract error:', error);
            return { contract: null, error: { message: error.message || 'Failed to sign contract' } as any };
        }
    },

    /**
     * Helper to generate a hash of the contract content
     */
    async generateHash(text: string): Promise<string> {
        if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
            return 'native-crypto-unavailable';
        }
        const msgUint8 = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Generate a professional PDF for a contract
     */
    generateProfessionalPDF(contract: any, tenant?: any) {
        const doc = new jsPDF();
        const primaryColor = '#14b8a6'; // Teal-500
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;

        // Header - Branding
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, 210, 40, 'F');

        // Logo Integration
        const logoUrl = tenant?.logo_url || tenant?.settings?.branding?.logo;
        if (logoUrl) {
            try {
                doc.addImage(logoUrl, 'PNG', 20, 7, 25, 25);
                doc.setFontSize(22);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text(contract.title || 'Service Agreement', 50, 25);
            } catch (e) {
                console.error('Failed to add logo to contract PDF:', e);
                doc.setFontSize(22);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text(contract.title || 'Service Agreement', 20, 25);
            }
        } else {
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text(contract.title || 'Service Agreement', 20, 25);
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(`Reference ID: ${contract.id}`, 20, 33);

        // Body Content
        let y = 60;
        doc.setTextColor(15, 23, 42); // slate-900
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');

        const content = typeof contract.content === 'string' ? contract.content : 'No content provided';
        const splitText = doc.splitTextToSize(content, 170);

        // Check if content fits on one page (estimating)
        let linesOnCurrentPage = 0;
        const maxLinesPerPage = 220;

        splitText.forEach((line: string) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            doc.text(line, 20, y);
            y += 6;
        });

        // Signatures Section
        y += 20;
        if (y > 220) {
            doc.addPage();
            y = 30;
        }

        doc.setDrawColor(226, 232, 240); // slate-200
        doc.line(20, y, 190, y);
        y += 15;

        // Signature Layout
        const sigWidth = 70;
        const sigHeight = 30;

        // Client Side
        if (contract.client_signature) {
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENT SIGNATURE', 20, y);
            doc.addImage(contract.client_signature, 'PNG', 20, y + 5, sigWidth, sigHeight);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(`Signed at: ${new Date(contract.client_signed_at).toLocaleString()}`, 20, y + 42);
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(148, 163, 184);
            doc.text('CLIENT SIGNATURE PENDING', 20, y);
        }

        // Admin Side
        if (contract.admin_signature) {
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.text('EXECUTIVE SIGNATURE', 120, y);
            doc.addImage(contract.admin_signature, 'PNG', 120, y + 5, sigWidth, sigHeight);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(`Signed at: ${new Date(contract.admin_signed_at).toLocaleString()}`, 120, y + 42);
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(148, 163, 184);
            doc.text('EXECUTIVE SIGNATURE PENDING', 120, y);
        }

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`This is a legally binding document generated by ${tenant?.name || 'AlphaClone Systems'}.`, pageWidth / 2, pageHeight - 15, { align: 'center' });
        doc.text(`Document ID: ${contract.id} | Page ${doc.getNumberOfPages()}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

        return doc;
    },

    downloadPDF(contract: any, tenant?: any) {
        const doc = this.generateProfessionalPDF(contract, tenant);
        doc.save(`${contract.title.replace(/\s+/g, '_')}.pdf`);
    }
};
