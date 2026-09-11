'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { jsPDF } from 'jspdf';
import { FileText, Download, CheckCircle, Loader2, ShieldCheck, Printer, Share2, CheckCircle2, XCircle } from 'lucide-react';
import { googleDriveService } from '../../../services/googleDriveService';
import { useAuth } from '../../../contexts/AuthContext';
import { SignaturePad } from '../../../components/contracts/SignaturePad';
import { contractService } from '../../../services/contractService';
import { esignatureComplianceService } from '../../../services/esignatureComplianceService';
import toast, { Toaster } from 'react-hot-toast';
import AIOutputDisclaimer from '../../../components/ai/AIOutputDisclaimer';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { buildContractDocumentInput } from '@/lib/documents/documentBuilders';

export default function PublicContractPage() {
    const params = useParams();
    const signingToken = params?.id as string;
    const { user } = useAuth();

    const [contract, setContract] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [signing, setSigning] = useState(false);
    const [signed, setSigned] = useState(false);
    const [signatureData, setSignatureData] = useState<string | null>(null);
    const [legalName, setLegalName] = useState<string>('');
    const [signerEmail, setSignerEmail] = useState<string>('');
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [declining, setDeclining] = useState(false);
    const [declined, setDeclined] = useState(false);
    const [declineNote, setDeclineNote] = useState('');
    const [showDeclineForm, setShowDeclineForm] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (signingToken) {
            loadContract();
        }
    }, [signingToken]);

    const loadContract = async () => {
        try {
            const response = await fetch(`/api/contracts/sign?token=${encodeURIComponent(signingToken)}`, {
                method: 'GET',
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.contract) {
                throw new Error(payload?.error || 'Contract not found');
            }
            setLoadError(null);
            setContract(payload.contract);
            setSignerEmail(payload?.signer?.email || '');
            if (payload.contract.status === 'fully_signed' || payload.contract.status === 'client_signed') {
                setSigned(true);
            }
            if (payload.contract.status === 'rejected') {
                setDeclined(true);
            }
        } catch (error) {
            console.error('Error loading contract:', error);
            const message = error instanceof Error ? error.message : 'Contract not found or access denied.';
            setLoadError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleDecline = async () => {
        setDeclining(true);
        try {
            const response = await fetch('/api/contracts/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: signingToken, action: 'decline', note: declineNote.trim() }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || 'Failed to decline contract');
            }
            setDeclined(true);
            setShowDeclineForm(false);
            toast.success('Contract declined — the sender has been notified.');
        } catch (error: any) {
            toast.error(error.message || 'Unable to decline contract');
        } finally {
            setDeclining(false);
        }
    };

    const handleSign = async () => {
        if (!signatureData) {
            toast.error('Please sign the contract');
            return;
        }
        if (!legalName.trim()) {
            toast.error('Legal name is required');
            return;
        }
        if (!signerEmail.trim() || !signerEmail.includes('@')) {
            toast.error('Valid signer email is required');
            return;
        }
        if (!consentAccepted) {
            toast.error('You must accept the Electronic Signature Disclosure');
            return;
        }

        setSigning(true);
        try {
            const { contract: updated, error } = await contractService.signContract(signingToken, 'client', signatureData, {
                id: 'public',
                name: legalName.trim(),
                email: signerEmail.trim().toLowerCase(),
                consentGiven: true,
            });

            if (error) throw error;

            setContract(updated);
            setSigned(true);
            toast.success('Contract signed successfully!');

            // Auto-download PDF
            setTimeout(() => generateAndDownloadPDF(updated, signatureData), 1000);

        } catch (error) {
            console.error('Signing error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save signature');
        } finally {
            setSigning(false);
        }
    };

    const generateAndDownloadPDF = (contractData: any, signature: string) => {
        const doc = new jsPDF();
        const pageHeight = doc.internal.pageSize.height;

        // Use a better header
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, 210, 40, 'F');

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('CERTIFIED CONTRACT', 20, 25);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(`Reference: ${contractData.id}`, 20, 33);

        // Content
        let y = 60;
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');

        const content = contractService.prepareContractContentForPdf(contractData.content || '');
        const lines = content.split('\n');

        lines.forEach((line) => {
            if (y > pageHeight - 30) {
                doc.addPage();
                y = 20;
            }

            if (line.trim().startsWith('#')) {
                const headerText = line.replace(/^#+\s*/, '');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                const split = doc.splitTextToSize(headerText, 170);
                doc.text(split, 20, y);
                y += split.length * 7 + 2;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(11);
            } else if (line.trim() === '') {
                y += 5;
            } else {
                const cleanLine = line.replace(/\*\*/g, '');
                const split = doc.splitTextToSize(cleanLine, 170);
                split.forEach((textLine: string) => {
                    if (y > pageHeight - 30) {
                        doc.addPage();
                        y = 20;
                    }
                    doc.text(textLine, 20, y);
                    y += 6;
                });
            }
        });

        // Signatures
        y += 20;
        if (y > 240) {
            doc.addPage();
            y = 30;
        }

        doc.setDrawColor(226, 232, 240);
        doc.line(20, y, 190, y);
        y += 15;

        doc.setFont('helvetica', 'bold');
        doc.text('CLIENT SIGNATURE', 20, y);
        const isJpeg = signature.startsWith('data:image/jpeg');
        const imgFormat = isJpeg ? 'JPEG' : 'PNG';
        const base64Data = signature.includes(',') ? signature.split(',')[1] : signature;
        doc.addImage(base64Data, imgFormat, 20, y + 5, 60, 25);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Electronically signed on ${new Date().toLocaleString()}`, 20, y + 35);

        // Security Seal
        doc.setDrawColor(20, 184, 166); // teal-500
        doc.setLineWidth(0.5);
        doc.rect(140, y + 5, 40, 25);
        doc.setFontSize(10);
        doc.setTextColor(20, 184, 166);
        doc.text('VERIFIED', 160, y + 15, { align: 'center' });
        doc.setFontSize(7);
        doc.text('AUTHENTIC DOCUMENT', 160, y + 22, { align: 'center' });

        doc.save(`${contractData.title.replace(/\s+/g, '_')}_Signed.pdf`);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleSaveToDrive = async () => {
        if (!contract || !user) {
            toast.error('You must be logged in to save to Google Drive');
            return;
        }

        const toastId = toast.loading('Saving to Google Drive...');
        try {
            const doc = new jsPDF();
            // Reuse the PDF generation logic briefly or just use the content
            // To be more robust, we would generate the full PDF blob
            const pdfBlob = doc.output('blob');
            await googleDriveService.uploadFile(user.id, pdfBlob, `${contract.title.replace(/\s+/g, '_')}_Signed.pdf`);
            toast.success('Successfully saved to Google Drive!', { id: toastId });
        } catch (error: any) {
            console.error('Drive upload error:', error);
            toast.error(error.message || 'Failed to save to Google Drive', { id: toastId });
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>;
    }

    if (!contract) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
                <div className="max-w-md w-full text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
                    <h1 className="text-2xl font-bold text-red-400 mb-3">Contract Not Found</h1>
                    <p className="text-slate-400 mb-6">
                        {loadError || 'This signing link is invalid, expired, or has already been used.'}
                    </p>
                    <a
                        href="/"
                        className="inline-flex w-full items-center justify-center rounded-xl bg-teal-500 px-4 py-3 font-semibold text-slate-950 hover:bg-teal-400"
                    >
                        Return Home
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4">
            <Toaster position="top-center" />
            <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-slate-950/50 p-6 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-teal-500/10 rounded-xl">
                            <FileText className="w-8 h-8 text-teal-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">{contract.title}</h1>
                            <p className="text-sm text-slate-400">Provided by {contract.tenant?.name || 'AlphaClone'}</p>
                        </div>
                    </div>
                    {signed && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 rounded-lg border border-green-500/20">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-bold text-sm">Signed & Active</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 bg-slate-950/40 border-y border-slate-800">
                    <AIOutputDisclaimer type="contract" />
                </div>
                <div className="p-4 sm:p-6 bg-slate-950/20 border-y border-slate-800 print-content">
                    <DocumentPreview
                        className="!mb-0"
                        hideLabel
                        input={buildContractDocumentInput(
                            contract,
                            contract.tenant,
                            { name: contract.metadata?.client_name, email: signerEmail || contract.metadata?.client_email }
                        )}
                    />
                </div>

                {/* Signature Section */}
                {declined ? (
                    <div className="p-8 bg-slate-950/30 border-t border-slate-800 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
                            <XCircle className="w-5 h-5" />
                            <span className="font-bold text-sm">Contract Declined</span>
                        </div>
                    </div>
                ) : !signed ? (
                    <div className="p-8 bg-slate-950/30 border-t border-slate-800">
                        {/* ESIGN Disclosure */}
                        <div className="mb-8 p-6 bg-slate-900 border border-slate-700 rounded-xl">
                            <div
                                className="text-xs text-slate-400 overflow-y-auto max-h-48 mb-4 esign-disclosure-content"
                                dangerouslySetInnerHTML={{ __html: esignatureComplianceService.ESIGN_DISCLOSURE }}
                            />
                            <div className="flex items-start gap-3 p-4 bg-teal-500/5 border border-teal-500/20 rounded-lg cursor-pointer hover:bg-teal-500/10 transition-colors"
                                 onClick={() => setConsentAccepted(!consentAccepted)}>
                                <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${consentAccepted ? 'bg-teal-500 border-teal-500' : 'border-slate-500 bg-transparent'}`}>
                                    {consentAccepted && <CheckCircle className="w-3.5 h-3.5 text-slate-950" />}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">I agree to the Electronic Signature Disclosure</p>
                                    <p className="text-xs text-slate-400 mt-1">I consent to use electronic signatures for this transaction and agree to be legally bound by the terms of this document.</p>
                                </div>
                            </div>
                        </div>

                        <label className="block text-sm font-bold text-white mb-4 uppercase tracking-wider">Sign Below to Accept</label>
                        <div className={`overflow-hidden bg-white rounded-xl transition-opacity ${!consentAccepted ? 'opacity-50 grayscale pointer-events-none' : 'opacity-100'}`}>
                            <SignaturePad
                                onSave={(data, fullName) => {
                                    setSignatureData(data);
                                    setLegalName(fullName);
                                }}
                                onClear={() => {
                                    setSignatureData(null);
                                    setLegalName('');
                                }}
                            />
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Signer Email</label>
                            <input
                                type="email"
                                value={signerEmail}
                                onChange={(e) => setSignerEmail(e.target.value)}
                                placeholder="name@company.com"
                                disabled={!consentAccepted}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/40 disabled:opacity-50"
                            />
                            <p className="text-[11px] text-slate-500 mt-2">Use the same email that received this signing link.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 text-xs">
                            <span className="text-slate-500 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Secure 256-bit SSL Cryptography Applied
                            </span>
                            <p className="text-slate-500">{consentAccepted ? 'Draw your signature in the box above.' : 'Accept disclosure above to enable signature.'}</p>
                        </div>
                        <button
                            onClick={() => {
                                if (!signatureData) {
                                    toast.error('Please click "Confirm Signature" above first');
                                    return;
                                }
                                handleSign();
                            }}
                            disabled={signing || !consentAccepted}
                            className={`flex-1 w-full mt-6 py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                                signing || !consentAccepted
                                    ? 'bg-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 hover:scale-[1.02] active:scale-95'
                            }`}
                        >
                            {signing ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-5 h-5" />
                            )}
                            {!signatureData ? 'Confirm Signature First' : (signing ? 'Signing...' : 'Sign Contract')}
                        </button>

                        <div className="mt-6 pt-6 border-t border-slate-800">
                            {!showDeclineForm ? (
                                <button
                                    type="button"
                                    onClick={() => setShowDeclineForm(true)}
                                    className="text-sm text-slate-500 hover:text-red-400 transition-colors"
                                >
                                    Decline this contract instead
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-slate-300">Reason for declining (optional)</label>
                                    <textarea
                                        value={declineNote}
                                        onChange={(e) => setDeclineNote(e.target.value)}
                                        placeholder="Let us know why you're declining..."
                                        className="w-full h-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none"
                                    />
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={handleDecline}
                                            disabled={declining}
                                            className="flex-1 py-3 px-4 bg-slate-800 hover:bg-red-900/40 border border-red-500/30 rounded-xl font-bold text-red-400 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {declining ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                            Confirm Decline
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowDeclineForm(false)}
                                            className="px-4 py-3 text-slate-500 hover:text-white text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="p-8 bg-slate-950/30 border-t border-slate-800 text-center">
                        <p className="text-slate-400 mb-6">This contract has been signed on {new Date(contract.client_signed_at).toLocaleDateString()}.</p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <button
                                onClick={() => generateAndDownloadPDF(contract, contract.client_signature)}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-white transition-colors no-print"
                            >
                                <Download className="w-5 h-5" /> Download PDF
                            </button>
                            <button
                                onClick={handlePrint}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-white transition-colors no-print"
                            >
                                <Printer className="w-5 h-5" /> Print
                            </button>
                            <button
                                onClick={handleSaveToDrive}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 rounded-xl font-bold text-white transition-colors no-print"
                            >
                                <Share2 className="w-5 h-5" /> Save to Drive
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="text-center mt-8 text-slate-500 text-sm">
                Securely powered by <span className="text-slate-400 font-semibold">AlphaClone Systems</span>
            </div>
        </div>
    );
}

function contractToStyledHtml(text: string): string {
    if (!text) return '';

    // If it looks like HTML (starts with a tag), trust it but wrap it in a styled container
    const isHtml = /<[a-z][\s\S]*>/i.test(text);

    if (isHtml) {
        return `<div class="contract-content" style="font-family:'Times New Roman', Georgia, serif; font-size:15px; line-height:1.75; color:#0f172a;">${text}</div>`;
    }

    // Otherwise, treat as markdown-ish text
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const formatted = escaped
        .replace(/^# (.+)$/gm, '<h1 style="font-size:28px; text-align:center; text-transform:uppercase; letter-spacing:1px; margin:0 0 18px; font-weight:700; color:#020617;">$1</h1>')
        .replace(/^## (.+)$/gm, '<h2 style="font-size:17px; text-transform:uppercase; border-bottom:1px solid #cbd5e1; padding-bottom:6px; margin:26px 0 14px; font-weight:700; color:#0f172a;">$1</h2>')
        .replace(/^### (.+)$/gm, '<h3 style="font-size:15px; margin:16px 0 8px; font-weight:700; color:#0f172a;">$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700; color:#020617;">$1</strong>')
        .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #cbd5e1;margin:20px 0;" />')
        .replace(/\n\n/g, '</p><p style="margin:0 0 12px; text-align:justify;">')
        .replace(/\n/g, '<br/>');

    return `<div class="contract-content" style="font-family:'Times New Roman', Georgia, serif; font-size:15px; line-height:1.75; color:#0f172a;"><p style="margin:0 0 12px; text-align:justify;">${formatted}</p></div>`;
}
