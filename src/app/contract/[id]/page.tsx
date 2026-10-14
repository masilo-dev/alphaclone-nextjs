'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FileText, CheckCircle, Loader2, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { SignaturePad } from '../../../components/contracts/SignaturePad';
import { esignatureComplianceService } from '../../../services/esignatureComplianceService';
import toast, { Toaster } from 'react-hot-toast';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { tenantBrandingFromRecord } from '@/lib/documents/documentBuilders';
import { buildContractDocumentInput } from '@/lib/documents/documentBuilders';

export default function PublicContractPage() {
    const params = useParams();
    const signingToken = params?.id as string;

    const [reviewOnly, setReviewOnly] = useState(false);
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
            setReviewOnly(payload.review_only === true);
            setSignerEmail(payload?.signer?.email || '');
            const parties = payload.contract.contract_parties || [];
            const matchingParty = parties.find((party: any) =>
                String(party.party_snapshot?.email || '').toLowerCase() === String(payload.signer?.email || '').toLowerCase());
            const partySigned = matchingParty?.signature_status === 'signed';
            const legacySigned = parties.length === 0 && Boolean(
                payload.signer?.role === 'client' ? payload.contract.client_signed_at : payload.contract.admin_signed_at);
            setSigned(payload.contract.status === 'fully_signed' || partySigned || legacySigned);
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
            const response = await fetch('/api/contracts/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signingToken,
                    signatureDataUrl: signatureData,
                    signerName: legalName.trim(),
                    signerEmail: signerEmail.trim().toLowerCase(),
                    consentGiven: true,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to record your signature');
            setContract(payload.contract ? { ...contract, ...payload.contract, tenant: payload.contract.tenant || contract.tenant } : contract);
            setSigned(true);
            toast.success('Your signature has been recorded. The authoritative agreement and completion receipt will be available after all required signers finish.');

        } catch (error) {
            console.error('Signing error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save signature');
        } finally {
            setSigning(false);
        }
    };


    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-[var(--ws-canvas)] text-white"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>;
    }

    if (!contract) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--ws-canvas)] text-white p-6">
                <div className="max-w-md w-full text-center bg-[var(--ws-panel)] border border-[var(--ws-border)] rounded-2xl p-8">
                    <h1 className="text-2xl font-bold text-red-400 mb-3">Contract Not Found</h1>
                    <p className="text-[var(--ws-text-muted)] mb-6">
                        {loadError || 'This signing link is invalid, expired, or has already been used.'}
                    </p>
                    <a
                        href="/"
                        className="inline-flex w-full items-center justify-center rounded-xl bg-teal-500 px-4 py-3 font-semibold text-slate-950 hover:bg-[var(--brand-blue-400)]"
                    >
                        Return Home
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--ws-canvas)] text-[var(--ws-text-secondary)] py-3 sm:py-8 px-0 sm:px-4 pb-[max(12px,env(safe-area-inset-bottom))]">
            <Toaster position="top-center" />
            <div className="max-w-4xl mx-auto bg-[var(--ws-panel)] border border-[var(--ws-border)] sm:rounded-2xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-[var(--ws-canvas)] p-6 border-b border-[var(--ws-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-teal-500/10 rounded-xl">
                            <FileText className="w-8 h-8 text-teal-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">{reviewOnly ? 'Review agreement' : signed ? 'Signed agreement' : 'Review and sign'}</h1>
                            <p className="type-card-description text-[var(--ws-text-muted)]">Provided by {tenantBrandingFromRecord(contract.tenant).name}</p>
                        </div>
                    </div>
                    {signed && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 rounded-lg border border-green-500/20">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-bold type-ui">{contract.status === 'fully_signed' ? 'Fully signed' : 'Your signature recorded'}</span>
                        </div>
                    )}
                </div>

                <div className="p-0 sm:p-3 bg-white border-y border-[var(--ws-border)] print-content">
                    <DocumentPreview
                        className="!mb-0"
                        hideLabel
                        expandToContent
                        input={buildContractDocumentInput(
                            contract,
                            contract.tenant,
                            { name: contract.metadata?.client_name, email: signerEmail || contract.metadata?.client_email }
                        )}
                    />
                </div>

                {/* Signature Section */}
                {reviewOnly ? (<p className="type-card-description text-[var(--ws-text-muted)]">Draft for review only. No signature is requested or permitted.</p>) : declined ? (
                    <div className="p-4 sm:p-8 bg-[var(--ws-canvas)] border-t border-[var(--ws-border)] text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--error-500)]/10 text-red-400 rounded-lg border border-red-500/20">
                            <XCircle className="w-5 h-5" />
                            <span className="font-bold type-ui">Contract Declined</span>
                        </div>
                    </div>
                ) : !signed ? (
                    <div className="p-4 sm:p-8 bg-[var(--ws-canvas)] border-t border-[var(--ws-border)]">
                        {/* ESIGN Disclosure */}
                        <div className="mb-8 p-6 bg-[var(--ws-panel)] border border-[var(--ws-border)] rounded-xl">
                            <div
                                className="type-caption text-[var(--ws-text-muted)] overflow-y-auto max-h-48 mb-4 esign-disclosure-content"
                                dangerouslySetInnerHTML={{ __html: esignatureComplianceService.ESIGN_DISCLOSURE }}
                            />
                            <label className="flex items-start gap-3 p-4 bg-teal-500/5 border border-teal-500/20 rounded-lg cursor-pointer hover:bg-teal-500/10 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={consentAccepted}
                                    onChange={(event) => setConsentAccepted(event.target.checked)}
                                    className="mt-1 h-5 w-5 shrink-0 accent-teal-500 focus-visible:ring-2 focus-visible:ring-teal-400"
                                />
                                <div>
                                    <p className="type-card-description font-semibold text-white">I agree to the Electronic Signature Disclosure</p>
                                    <p className="type-card-description text-[var(--ws-text-muted)] mt-1">I consent to use electronic signatures for this transaction and agree to be legally bound by the terms of this document.</p>
                                </div>
                            </label>
                        </div>

                        <label className="block type-caption font-bold text-white mb-4 uppercase tracking-wider">Sign Below to Accept</label>
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
                            <label className="block type-label font-medium text-[var(--ws-text-secondary)] mb-2">Signer Email</label>
                            <input
                                type="email"
                                value={signerEmail}
                                onChange={(e) => setSignerEmail(e.target.value)}
                                placeholder="name@company.com"
                                disabled={!consentAccepted}
                                className="w-full bg-[var(--ws-panel)] border border-[var(--ws-border)] rounded-lg px-3 py-2 type-ui text-white focus:outline-none focus:ring-2 focus:ring-teal-500/40 disabled:opacity-50"
                            />
                            <p className="type-card-description text-[var(--ws-text-muted)] mt-2">Use the same email that received this signing link.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 type-caption">
                            <span className="text-[var(--ws-text-muted)] flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Secure 256-bit SSL Cryptography Applied
                            </span>
                            <p className="text-[var(--ws-text-muted)]">{consentAccepted ? 'Draw your signature in the box above.' : 'Accept disclosure above to enable signature.'}</p>
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

                        <div className="mt-6 pt-6 border-t border-[var(--ws-border)]">
                            {!showDeclineForm ? (
                                <button
                                    type="button"
                                    onClick={() => setShowDeclineForm(true)}
                                    className="type-ui text-[var(--ws-text-muted)] hover:text-red-400 transition-colors"
                                >
                                    Decline this contract instead
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <label className="block type-label font-medium text-[var(--ws-text-secondary)]">Reason for declining (optional)</label>
                                    <textarea
                                        value={declineNote}
                                        onChange={(e) => setDeclineNote(e.target.value)}
                                        placeholder="Let us know why you're declining..."
                                        className="w-full h-20 bg-[var(--ws-panel)] border border-[var(--ws-border)] rounded-lg px-3 py-2 type-ui text-white resize-none"
                                    />
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={handleDecline}
                                            disabled={declining}
                                            className="flex-1 py-3 px-4 bg-[var(--ws-surface-secondary)] hover:bg-red-900/40 border border-red-500/30 rounded-xl font-bold text-red-400 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {declining ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                            Confirm Decline
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowDeclineForm(false)}
                                            className="px-4 py-3 text-[var(--ws-text-muted)] hover:text-white type-ui"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="p-4 sm:p-8 bg-[var(--ws-canvas)] border-t border-[var(--ws-border)] text-center space-y-4">
                        <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
                        <h2 className="text-lg font-semibold text-white">Your signature is recorded</h2>
                        <p className="mx-auto max-w-lg type-card-description text-[var(--ws-text-muted)]">
                            Your signature is recorded. The completed agreement is available after all required parties have signed.
                        </p>
                        {contract.pdf_url && (
                            <div>
                                <a
                                    href={contract.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 font-bold text-white transition-all shadow-md text-sm"
                                >
                                    <FileText className="w-4 h-4" /> Download Signed PDF
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="text-center mt-8 text-[var(--ws-text-muted)] type-ui">
                Securely powered by <span className="text-[var(--ws-text-muted)] font-semibold">AlphaClone Systems</span>
            </div>
        </div>
    );
}
