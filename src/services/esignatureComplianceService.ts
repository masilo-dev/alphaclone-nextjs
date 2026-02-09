import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';

/**
 * ESIGN Act Compliance Service
 * Ensures electronic signatures are legally binding under the ESIGN Act (2000)
 * and UETA (Uniform Electronic Transactions Act)
 */

export interface SignerInfo {
    id: string;
    role: 'client' | 'admin';
    name: string;
    email: string;
    signedAt: string;
    ipAddress: string;
    signature: string;
}

export interface CertificateData {
    certificateId: string;
    contractId: string;
    documentTitle: string;
    completionDate: string;
    signers: SignerInfo[];
    documentHash: string;
}

export const esignatureComplianceService = {
    /**
     * ESIGN Act Disclosure Text
     * Required disclosure that must be shown and accepted before signing
     */
    ESIGN_DISCLOSURE: `
        <div class="esign-disclosure">
            <h3>Electronic Signature Disclosure and Consent</h3>

            <p><strong>Important: Please read this disclosure carefully before proceeding.</strong></p>

            <h4>1. Consent to Electronic Signatures</h4>
            <p>By checking the box below and clicking "I Agree," you consent to:</p>
            <ul>
                <li>Use electronic signatures to sign this agreement</li>
                <li>Conduct this transaction electronically</li>
                <li>Receive all communications and disclosures electronically</li>
            </ul>

            <h4>2. How Electronic Signatures Work</h4>
            <p>You will sign this document by:</p>
            <ul>
                <li>Drawing your signature using your mouse or touchscreen</li>
                <li>Typing your full legal name</li>
                <li>Clicking "Sign Document" to apply your signature</li>
            </ul>

            <h4>3. Legal Effect</h4>
            <p>Your electronic signature will have the same legal effect as a handwritten signature.
            By signing electronically, you agree to be bound by the terms of this agreement.</p>

            <h4>4. Required Hardware and Software</h4>
            <p>To access and retain this agreement, you need:</p>
            <ul>
                <li>A computer or mobile device with internet access</li>
                <li>A current web browser (Chrome, Firefox, Safari, or Edge)</li>
                <li>Sufficient storage space or a printer to save or print documents</li>
                <li>An active email address</li>
            </ul>

            <h4>5. Withdrawal of Consent</h4>
            <p>You may withdraw your consent to use electronic signatures at any time by contacting us.
            However, withdrawal of consent will not affect the legal validity of any signatures you
            have already provided electronically.</p>

            <h4>6. Right to Receive Paper Copies</h4>
            <p>You have the right to receive a paper copy of this agreement. You may request a paper
            copy at any time by contacting us. We may charge a reasonable fee for paper copies.</p>

            <h4>7. Record Retention</h4>
            <p>We will maintain electronic records of this agreement for a minimum of 7 years from
            the date of execution. You should download and save or print a copy for your records.</p>

            <h4>8. Updates to This Disclosure</h4>
            <p>We may update this disclosure from time to time. Any changes will be provided to you
            before you sign.</p>

            <h4>9. Contact Information</h4>
            <p>If you have questions about this disclosure or electronic signatures, please contact
            us at support@alphaclone.com or through your dashboard.</p>

            <div class="consent-checkbox">
                <label>
                    <input type="checkbox" id="esign-consent" required>
                    <strong>I have read and agree to the Electronic Signature Disclosure.
                    I consent to use electronic signatures for this transaction.</strong>
                </label>
            </div>
        </div>
    `,

    /**
     * Intent Statement Template
     * User must affirm intent to sign
     */
    INTENT_STATEMENT: "I, [NAME], intend to sign this document and agree to be legally bound by its terms. I understand that my electronic signature has the same legal effect as a handwritten signature.",

    /**
     * Record consent to use electronic signatures
     */
    async recordConsent(
        userId: string,
        contractId: string,
        ipAddress: string,
        userAgent: string,
        consentMethod: 'checkbox' | 'button_click' | 'signature_action' = 'checkbox'
    ): Promise<{ success: boolean; consentId?: string; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('esignature_consents')
                .insert({
                    user_id: userId,
                    contract_id: contractId,
                    consent_given: true,
                    consent_text: this.ESIGN_DISCLOSURE,
                    consent_method: consentMethod,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                })
                .select()
                .single();

            if (error) throw error;

            return { success: true, consentId: data.id };
        } catch (error) {
            console.error('Failed to record consent:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to record consent',
            };
        }
    },

    /**
     * Log contract audit trail event
     */
    async logAuditEvent(
        contractId: string,
        action: string,
        actorId: string,
        actorRole: string,
        actorName: string,
        actorEmail: string,
        ipAddress: string,
        userAgent?: string,
        details?: any
    ): Promise<void> {
        try {
            await supabase.from('contract_audit_trail').insert({
                contract_id: contractId,
                action,
                actor_id: actorId,
                actor_role: actorRole,
                actor_name: actorName,
                actor_email: actorEmail,
                ip_address: ipAddress,
                user_agent: userAgent,
                details: details || {},
            });
        } catch (error) {
            console.error('Failed to log audit event:', error);
            // Don't throw - audit logging failure shouldn't block the operation
        }
    },

    /**
     * Record signature event with full details
     */
    async recordSignatureEvent(
        contractId: string,
        signerId: string,
        signerRole: 'client' | 'admin',
        signerName: string,
        signerEmail: string,
        eventType: 'signature_started' | 'signature_completed' | 'signature_declined',
        signatureData: string,
        contentHash: string,
        ipAddress: string,
        userAgent: string,
        intentStatement: string
    ): Promise<{ success: boolean; eventId?: string; error?: string }> {
        try {
            // Generate tamper seal (combination of all critical data)
            const tamperSealInput = [
                contractId,
                signerId,
                signerEmail,
                contentHash,
                new Date().toISOString(),
            ].join('|');

            const tamperSeal = await this.generateHash(tamperSealInput);

            const { data, error } = await supabase
                .from('signature_events')
                .insert({
                    contract_id: contractId,
                    signer_id: signerId,
                    signer_role: signerRole,
                    signer_name: signerName,
                    signer_email: signerEmail,
                    signer_ip: ipAddress,
                    event_type: eventType,
                    signature_data: signatureData,
                    authentication_method: 'password', // Could be enhanced with 2FA
                    intent_statement: intentStatement,
                    device_info: {
                        user_agent: userAgent,
                        timestamp: new Date().toISOString(),
                    },
                    content_hash_at_signing: contentHash,
                    tamper_seal: tamperSeal,
                })
                .select()
                .single();

            if (error) throw error;

            return { success: true, eventId: data.id };
        } catch (error) {
            console.error('Failed to record signature event:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to record signature event',
            };
        }
    },

    /**
     * Generate SHA-256 hash
     */
    async generateHash(text: string): Promise<string> {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            const msgUint8 = new TextEncoder().encode(text);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
            // Node.js environment
            const crypto = require('crypto');
            return crypto.createHash('sha256').update(text).digest('hex');
        }
    },

    /**
     * Create Certificate of Completion
     * Official certificate proving the document was legally executed
     */
    async createCompletionCertificate(
        contractId: string,
        documentTitle: string,
        signers: SignerInfo[],
        documentContent: string
    ): Promise<{ success: boolean; certificateId?: string; error?: string }> {
        try {
            // Generate document hash
            const documentHash = await this.generateHash(documentContent);

            // Generate tamper seal
            const tamperSealInput = [
                contractId,
                documentTitle,
                documentHash,
                ...signers.map(s => `${s.id}:${s.signedAt}`),
            ].join('|');
            const tamperSeal = await this.generateHash(tamperSealInput);

            // Create certificate in database
            const { data, error } = await supabase.rpc('create_signature_certificate', {
                p_contract_id: contractId,
                p_document_title: documentTitle,
                p_signers: signers,
                p_document_hash: documentHash,
                p_tamper_seal: tamperSeal,
            });

            if (error) throw error;

            // Generate PDF certificate
            const certificateId = data;
            await this.generateCertificatePDF(certificateId, {
                certificateId,
                contractId,
                documentTitle,
                completionDate: new Date().toISOString(),
                signers,
                documentHash,
            });

            return { success: true, certificateId };
        } catch (error) {
            console.error('Failed to create completion certificate:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create certificate',
            };
        }
    },

    /**
     * Generate Certificate of Completion PDF
     */
    async generateCertificatePDF(certificateId: string, data: CertificateData): Promise<void> {
        const doc = new jsPDF();

        // Header
        doc.setFillColor(20, 184, 166); // Teal-500
        doc.rect(0, 0, 210, 50, 'F');

        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('CERTIFICATE OF COMPLETION', 105, 25, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Electronic Signature Verification', 105, 35, { align: 'center' });

        // Certificate ID
        doc.setFontSize(10);
        doc.setTextColor(240, 240, 240);
        doc.text(`Certificate ID: ${data.certificateId}`, 105, 43, { align: 'center' });

        // Body
        let y = 70;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);

        // Document Information
        doc.setFont('helvetica', 'bold');
        doc.text('Document Information', 20, y);
        y += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Title: ${data.documentTitle}`, 20, y);
        y += 7;
        doc.text(`Contract ID: ${data.contractId}`, 20, y);
        y += 7;
        doc.text(`Completion Date: ${new Date(data.completionDate).toLocaleString()}`, 20, y);
        y += 7;
        doc.text(`Document Hash (SHA-256): ${data.documentHash.substring(0, 40)}...`, 20, y);
        y += 15;

        // Signers
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Signatories', 20, y);
        y += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        data.signers.forEach((signer, index) => {
            doc.setFont('helvetica', 'bold');
            doc.text(`${index + 1}. ${signer.name} (${signer.role.toUpperCase()})`, 20, y);
            y += 7;

            doc.setFont('helvetica', 'normal');
            doc.text(`   Email: ${signer.email}`, 20, y);
            y += 5;
            doc.text(`   Signed: ${new Date(signer.signedAt).toLocaleString()}`, 20, y);
            y += 5;
            doc.text(`   IP Address: ${signer.ipAddress}`, 20, y);
            y += 10;
        });

        // Legal Statement
        y += 5;
        doc.setDrawColor(200, 200, 200);
        doc.line(20, y, 190, y);
        y += 10;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Legal Verification', 20, y);
        y += 8;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const legalText = [
            'This certificate verifies that the above-named parties have electronically signed the',
            'referenced document in compliance with the Electronic Signatures in Global and National',
            'Commerce Act (ESIGN Act, 15 U.S.C. § 7001) and the Uniform Electronic Transactions Act (UETA).',
            '',
            'Each signatory:',
            '• Was presented with and accepted the Electronic Signature Disclosure',
            '• Affirmed their intent to sign the document',
            '• Completed the signature action with full knowledge and consent',
            '• Had their signature cryptographically sealed to prevent tampering',
            '',
            'This certificate serves as proof that all parties entered into this agreement voluntarily',
            'and with full legal effect. The electronic signatures on this document are legally binding',
            'and enforceable.',
            '',
            `Retention Period: 7 years from completion date`,
            `Document authenticity can be verified using the Document Hash shown above.`,
        ];

        legalText.forEach(line => {
            doc.text(line, 20, y);
            y += 5;
        });

        // Footer
        y = 280;
        doc.setDrawColor(200, 200, 200);
        doc.line(20, y, 190, y);

        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text('AlphaClone Business OS - Electronic Signature Platform', 105, y + 5, { align: 'center' });
        doc.text('This is a computer-generated certificate and does not require a physical signature.', 105, y + 10, { align: 'center' });

        // TODO: Save PDF to storage and update database with URL
        // const pdfBlob = doc.output('blob');
        // await uploadCertificate(certificateId, pdfBlob);
    },

    /**
     * Verify document integrity (hasn't been tampered with)
     */
    async verifyDocumentIntegrity(
        contractId: string,
        currentContent: string
    ): Promise<{ valid: boolean; originalHash?: string; currentHash?: string }> {
        try {
            // Get original document hash from certificate
            const { data: certificate } = await supabase
                .from('signature_certificates')
                .select('document_hash')
                .eq('contract_id', contractId)
                .single();

            if (!certificate) {
                return { valid: false };
            }

            // Calculate current hash
            const currentHash = await this.generateHash(currentContent);

            return {
                valid: certificate.document_hash === currentHash,
                originalHash: certificate.document_hash,
                currentHash,
            };
        } catch (error) {
            console.error('Failed to verify document integrity:', error);
            return { valid: false };
        }
    },

    /**
     * Get complete audit trail for a contract
     */
    async getAuditTrail(contractId: string): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('contract_audit_trail')
                .select('*')
                .eq('contract_id', contractId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Failed to get audit trail:', error);
            return [];
        }
    },

    /**
     * Get signature events for a contract
     */
    async getSignatureEvents(contractId: string): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('signature_events')
                .select('*')
                .eq('contract_id', contractId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Failed to get signature events:', error);
            return [];
        }
    },
};
