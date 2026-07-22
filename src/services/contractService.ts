import { stripHtml } from '@/lib/html/stripHtml';
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
    document_url?: string; // Uploaded PDF URL
    client_signature?: string;
    client_signed_at?: string;
    admin_signature?: string;
    admin_signed_at?: string;
    payment_due_date?: string; // ISO Date
    payment_amount?: number;
    payment_status?: 'pending' | 'paid' | 'overdue';
    signing_token?: string;
    metadata?: {
        signer_ip?: string;
        content_hash?: string;
        version?: string;
        document_theme?: string;
        client_name?: string;
        client_email?: string;
        [key: string]: unknown;
    };
    created_at: string;
}

export const contractService = {
    decodeBase64ToBytes(base64: string): Uint8Array {
        const normalized = String(base64 || '').trim();
        const binary = window.atob(normalized);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    },

    triggerBrowserDownload(blob: Blob, filename: string): void {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
    },
    hasNonLatinText(text: string): boolean {
        if (!text) return false;
        return /[^\u0000-\u00FF]/.test(text);
    },

    buildUnicodeSafeContractHtml(contract: any, tenant?: any): string {
        const title = String(contract?.title || 'Contract');
        const rawContent = typeof contract?.content === 'string' ? contract.content : '';
        const normalized = this.normalizeContractTextForPdf(this.cleanMarkdown(rawContent));
        const contentHtml = normalized
            .split('\n')
            .map((line) => {
                const safe = line
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                if (!safe.trim()) return '<p>&nbsp;</p>';
                if (safe.trim().startsWith('#')) {
                    const cleanHeader = safe.replace(/^#+\s*/, '');
                    return `<h2>${cleanHeader}</h2>`;
                }
                return `<p>${safe}</p>`;
            })
            .join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 28px;
            color: #0f172a;
            background: #ffffff;
            font-family: 'Noto Sans', 'Noto Sans KR', 'Noto Sans JP', 'Noto Sans SC', 'Noto Naskh Arabic', Arial, sans-serif;
            line-height: 1.6;
            font-size: 12px;
        }
        h1, h2, h3, h4 {
            color: #0f172a;
            font-weight: 700;
            margin: 20px 0 10px 0;
        }
        p {
            margin: 0 0 10px 0;
            white-space: pre-wrap;
            word-break: break-word;
        }
        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                font-family: 'Noto Sans', 'Noto Sans KR', 'Noto Sans JP', 'Noto Sans SC', 'Noto Naskh Arabic', Arial, sans-serif !important;
            }
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${contentHtml}
    <hr />
    <p>${tenant?.name || 'AlphaClone Systems'}</p>
</body>
</html>`;
    },
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
        const response = await fetch('/api/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, ...contract }) });
        const payload = await response.json().catch(() => ({}));
        return { contract: response.ok ? payload.data : null, error: response.ok ? null : { message: payload.error || 'Contract could not be created' } };
    },

    /**
     * Clean markdown formatting from AI-generated text
     * Removes **, ~~, ####, -, *, and other markdown symbols
     */
    /**
     * Clean Markdown for Professional Display (Simplified, keeps markers for PDF engine)
     */
    cleanMarkdown(text: string): string {
        if (!text) return '';

        return text
            // Normalize line endings
            .replace(/\r\n/g, '\n')
            // Remove code blocks
            .replace(/```[\s\S]*?```/g, '')
            // Keep # headers and ** bold, but clean others
            .replace(/~~(.*?)~~/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    },

    normalizeContractTextForPdf(text: string): string {
        if (!text) return '';
        return text
            .replace(/\u00a0/g, ' ')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            // Collapse artificial spaced letter runs (e.g. "U M O W A")
            .replace(/((?:\b[A-Za-z]\s){3,}[A-Za-z]\b)/g, (match) => match.replace(/\s+/g, ''))
            .trim();
    },

    prepareContractContentForPdf(rawContent: string): string {
        const asText = rawContent.includes('<') ? stripHtml(rawContent) : rawContent;
        return this.normalizeContractTextForPdf(this.cleanMarkdown(asText));
    },

    /**
     * Generate Draft with AI
     */
    async generateDraft(type: string, clientName: string, projectDetails: string) {
        const prompt = `Act as an expert corporate legal counsel. Write a comprehensive, high-stakes professional ${type} for "${clientName}".

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
     * Delete a contract
     */
    async deleteContract(id: string) {
        const tenantId = this.getTenantId();
        const response = await fetch(`/api/contracts/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId }) });
        const payload = await response.json().catch(() => ({}));
        return { error: response.ok ? null : { message: payload.error || 'Contract could not be deleted' } };
    },

    async bulkDeleteContracts(ids: string[]): Promise<{ error: string | null; count: number; skipped: number }> {
        if (!ids.length) return { error: null, count: 0, skipped: 0 };
        const tenantId = this.getTenantId();
        const uniqueIds = [...new Set(ids)];
        try {
            const { data, error: fetchError } = await supabase
                .from('contracts')
                .select('id, status')
                .in('id', uniqueIds)
                .eq('tenant_id', tenantId);
            if (fetchError) throw fetchError;

            const draftIds = (data || [])
                .filter((row: { id: string; status: string }) => row.status === 'draft')
                .map((row: { id: string }) => row.id);
            const skipped = uniqueIds.length - draftIds.length;

            for (const id of draftIds) {
                const { error } = await this.deleteContract(id);
                if (error) throw error;
            }

            return { error: null, count: draftIds.length, skipped };
        } catch (err) {
            return {
                error: err instanceof Error ? err.message : 'Unknown error',
                count: 0,
                skipped: 0,
            };
        }
    },

    /**
     * Sign a contract
     * ESIGN COMPLIANT: Records full audit trail, consent, and tamper seals
     */
    async signContract(
        contractIdOrToken: string,
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
            const isPublicTokenFlow = signerInfo?.id === 'public';
            const response = await fetch('/api/contracts/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractId: isPublicTokenFlow ? undefined : contractIdOrToken,
                    role: isPublicTokenFlow ? undefined : role,
                    signingToken: isPublicTokenFlow ? contractIdOrToken : undefined,
                    signatureDataUrl,
                    signerName: signerInfo?.name || (role === 'admin' ? 'Administrator' : 'Client'),
                    signerEmail: signerInfo?.email || '',
                    consentGiven: signerInfo?.consentGiven || false,
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
        if (!contract) {
            console.error('generateProfessionalPDF: No contract provided');
            return doc;
        }

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
        doc.text(`Reference ID: ${contract.id || 'NEW'}`, 20, 33);

        // Body Content
        let y = 60;
        doc.setTextColor(15, 23, 42); // slate-900
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');

        const rawContent = typeof contract.content === 'string' ? contract.content : 'No content provided';
        const content = this.prepareContractContentForPdf(rawContent);
        const lines = content.split('\n');

        lines.forEach((line) => {
            if (y > pageHeight - 30) {
                doc.addPage();
                y = 20;

                // Pagination footer on subsequent pages
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
                doc.setTextColor(15, 23, 42);
                doc.setFontSize(11);
            }

            if (line.trim().startsWith('#')) {
                const headerLevel = Math.min(line.match(/^#+/)?.[0].length || 1, 3);
                const headerText = line.replace(/^#+\s*/, '');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16 - headerLevel);
                doc.setTextColor(20, 184, 166); // Teal-500
                const split = doc.splitTextToSize(headerText, 170);
                doc.text(split, 20, y);
                y += (split.length * 7) + 2;
                // Reset
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(11);
                doc.setTextColor(15, 23, 42);
            } else if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
                const boldText = line.trim().replace(/\*\*/g, '');
                doc.setFont('helvetica', 'bold');
                const split = doc.splitTextToSize(boldText, 170);
                doc.text(split, 20, y);
                y += (split.length * 6) + 1;
                doc.setFont('helvetica', 'normal');
            } else if (line.trim() === '') {
                y += 5;
            } else {
                const cleanLine = line.replace(/\*\*/g, '');
                const split = doc.splitTextToSize(cleanLine, 170);
                doc.text(split, 20, y);
                y += (split.length * 5.5) + 1;
            }
        });

        // Signatures Section
        y += 20;
        if (y > 200) {
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
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENT SIGNATURE', 20, y);
            try {
                const clientSigData = contract.client_signature.includes(',')
                    ? contract.client_signature.split(',')[1]
                    : contract.client_signature;
                doc.addImage(clientSigData, 'PNG', 20, y + 5, sigWidth, sigHeight);
            } catch (sigErr) {
                console.error('Failed to add client signature image:', sigErr);
                doc.text('[Signature Image Error]', 20, y + 15);
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const clientSignDate = contract.client_signed_at ? new Date(contract.client_signed_at).toLocaleString() : 'Date Pending';
            doc.text(`${contract.signer_name || 'Client'}`, 20, y + 38);
            doc.text(`Signed at: ${clientSignDate}`, 20, y + 42);
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(148, 163, 184);
            doc.text('CLIENT SIGNATURE PENDING', 20, y);
        }

        // Admin Side (Provider)
        doc.setTextColor(15, 23, 42);
        if (contract.admin_signature) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('PROVIDER SIGNATURE', 120, y);
            try {
                const adminSigData = contract.admin_signature.includes(',')
                    ? contract.admin_signature.split(',')[1]
                    : contract.admin_signature;
                doc.addImage(adminSigData, 'PNG', 120, y + 5, sigWidth, sigHeight);
            } catch (sigErr) {
                console.error('Failed to add admin signature image:', sigErr);
                doc.text('[Signature Image Error]', 120, y + 15);
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const adminSignDate = contract.admin_signed_at ? new Date(contract.admin_signed_at).toLocaleString() : 'Date Pending';
            doc.text(`${contract.admin_signer_name || tenant?.name || 'Authorized Representative'}`, 120, y + 38);
            doc.text(`Signed at: ${adminSignDate}`, 120, y + 42);
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(148, 163, 184);
            doc.text('PROVIDER SIGNATURE PENDING', 120, y);
        }

        // Footer
        const footerText = `This is a legally binding document generated by ${tenant?.name || 'AlphaClone Systems'}${contract.provider_company_name ? ` (for ${contract.provider_company_name})` : ''}.`;
        const pageCount = doc.getNumberOfPages();
        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
            doc.setPage(pageNumber);
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(footerText, pageWidth / 2, pageHeight - 15, { align: 'center' });
            doc.text(`Document ID: ${contract.id || 'NEW'} | Page ${pageNumber} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        return doc;
    },

    async downloadPDF(contract: any, tenant?: any) {
        const tenantId = tenant?.id || tenantService.getCurrentTenantId();
        if (tenantId && contract?.id) {
            try {
                const response = await fetch('/api/contracts/management', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenantId,
                        action: 'download_contract',
                        config: {
                            contractId: contract.id,
                            format: 'pdf',
                            optimize: true,
                        },
                    }),
                });

                const payload = await response.json().catch(() => ({}));
                if (response.ok && payload?.success && payload?.data?.bufferBase64) {
                    const bytes = this.decodeBase64ToBytes(payload.data.bufferBase64);
                    const mimeType = String(payload.data.mimeType || 'application/pdf');
                    const filename = String(payload.data.filename || `${String(contract.title || 'contract').replace(/\s+/g, '_')}.pdf`);
                    const blobBytes = new Uint8Array(bytes.byteLength);
                    blobBytes.set(bytes);
                    const blob = new Blob([blobBytes], { type: mimeType });
                    this.triggerBrowserDownload(blob, filename);
                    return;
                }
            } catch (error) {
                console.error('Server contract PDF download failed, using local fallback:', error);
            }
        }

        const rawContent = typeof contract?.content === 'string' ? contract.content : '';
        if (typeof window !== 'undefined' && rawContent.trim().startsWith('<')) {
            const printWindow = window.open('', '_blank', 'noopener,noreferrer');
            if (printWindow) {
                const title = String(contract.title || 'Contract').replace(/</g, '&lt;');
                printWindow.document.open();
                printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>body{font-family:Georgia,"Times New Roman",serif;color:#0f172a;line-height:1.6;padding:40px;max-width:800px;margin:0 auto;} h1,h2,h3{color:#0f766e;}</style>
</head><body>${rawContent}</body></html>`);
                printWindow.document.close();
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                }, 300);
                return;
            }
        }
        if (typeof window !== 'undefined' && this.hasNonLatinText(rawContent)) {
            const html = this.buildUnicodeSafeContractHtml(contract, tenant);
            const printWindow = window.open('', '_blank', 'noopener,noreferrer');
            if (printWindow) {
                printWindow.document.open();
                printWindow.document.write(html);
                printWindow.document.close();
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                }, 300);
                return;
            }
        }
        const doc = this.generateProfessionalPDF(contract, tenant);
        doc.save(`${contract.title.replace(/\s+/g, '_')}.pdf`);
    },

    /**
     * 900% AUTOMATION: Data-driven industry-agnostic drafting
     */
    async generateDeepContextDraft(params: {
        projectId?: string,
        clientId?: string,
        type: 'NDA' | 'MSA' | 'SOW' | 'Contract-One-Page' | 'Full MSA',
        tone?: 'Corporate' | 'Concise' | 'Consultative',
        language?: string
    }) {
        const tenantId = this.getTenantId();
        const { aiCore } = await import('@/services/core/AICore');

        // Aggregating context (Projects, Clients, etc.)
        const [
            { data: project },
            { data: client },
            businessContext
        ] = await Promise.all([
            params.projectId ? supabase.from('projects').select('*').eq('id', params.projectId).single() : Promise.resolve({ data: null }),
            params.clientId ? supabase.from('business_clients').select('*').eq('id', params.clientId).single() : Promise.resolve({ data: null }),
            aiCore.getBusinessContext(tenantId)
        ]);

        const prompt = `
        Draft a high-stakes, 100% professional ${params.type} in ${params.language || 'English'}.
        Tone: ${params.tone || 'Corporate'}
        
        PARTIES:
        Provider: ${businessContext}
        Client: ${client?.name || 'Valued Client'} (ID: ${params.clientId || 'Unknown'})
        
        PROJECT CONTEXT:
        Title: ${project?.name || 'Standard Engagement'}
        Description: ${project?.description || 'Professional Services'}
        Status: ${project?.status || 'Initiated'}
        
        LEGAL RULES:
        - No placeholders like [INSERT NAME]
        - No "As an AI..."
        - No AI markers.
        - High-stakes legal terminology appropriate for the identified industry.
        - Industry-agnostic but context-aware clauses.
        - Ensure a 100% human appearance.
        `;

        try {
            const { text, error } = await generateText(prompt);
            if (error || !text) {
                throw error || new Error('Failed to generate contract draft');
            }

            const cleanDraft = aiCore.cleanProOutput(text);

            // Log the achievement
            const { activityService } = await import('@/services/activityService');
            await activityService.logSystemAction(
                'system_ai',
                'GENERATE',
                `Auto-drafted ${params.type} for ${project?.name || 'Project'}`,
                { projectId: params.projectId, type: params.type },
                tenantId
            );

            return cleanDraft;
        } catch (error) {
            console.error('Deep Context Drafting failed:', error);
            throw error;
        }
    },

    /**
     * PROACTIVE TRIGGER: Auto-draft contract on project creation (900% automation)
     */
    async autoDraftForProject(projectId: string) {
        try {
            const tenantId = this.getTenantId();
            const { data: project } = await supabase.from('projects').select('tenant_id, client_id, name').eq('id', projectId).eq('tenant_id', tenantId).single();
            if (!project) return;

            const draft = await this.generateDeepContextDraft({
                projectId,
                clientId: project.client_id,
                type: 'MSA',
                tone: 'Corporate'
            });

            // Save the auto-draft to DB
            await this.createContract({
                project_id: projectId,
                client_id: project.client_id,
                title: `Auto-Draft: ${project.name} MSA`,
                content: draft,
                status: 'draft'
            });

            console.log(`[900% Automation] Auto-drafted contract for project ${projectId}`);
        } catch (err) {
            console.error('Auto-draft trigger failed:', err);
        }
    },

    /**
     * Send contract to client with public signing link
     */
    async sendContract(id: string, recipientEmail?: string) {
        const tenantId = this.getTenantId();
        
        try {
            const response = await fetch('/api/contracts/management', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    action: 'send_contract',
                    config: {
                        contractId: id,
                        recipients: recipientEmail,
                    },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send contract');
            }

            return await response.json();
        } catch (error: any) {
            console.error('Send contract error:', error);
            throw new Error(error.message || 'Failed to send contract');
        }
    }
};
