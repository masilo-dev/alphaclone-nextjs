"use client";

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, Send, ShieldCheck, Target, X, Zap } from 'lucide-react';
import { Button } from '../../ui/UIComponents';
import { leadService } from '../../../services/leadService';
import toast from 'react-hot-toast';

interface BatchOutreachPanelProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: string[];
    onSuccess: () => void;
    recipientSource?: 'leads' | 'clients';
}

type ReviewedRecipient = { id: string; kind: 'lead' | 'client'; name: string; email: string };
type ExcludedRecipient = { id: string; kind: 'lead' | 'client'; name: string; reason: string };

const MAX_BATCH_RECIPIENTS = 120;

function exclusionLabel(reason: string): string {
    switch (reason) {
        case 'missing_direct_email': return 'No direct email address';
        case 'marketing_consent_not_recorded': return 'Marketing consent is not recorded';
        case 'suppressed': return 'Suppressed or unsubscribed';
        default: return 'Not eligible for outreach';
    }
}

export const BatchOutreachPanel: React.FC<BatchOutreachPanelProps> = ({ isOpen, onClose, selectedIds, onSuccess, recipientSource = 'leads' }) => {
    const [tone, setTone] = useState('professional');
    const [context, setContext] = useState('');
    const [provider, setProvider] = useState('zoho');
    const [step, setStep] = useState<'configure' | 'review'>('configure');
    const [reviewedRecipients, setReviewedRecipients] = useState<ReviewedRecipient[]>([]);
    const [excludedRecipients, setExcludedRecipients] = useState<ExcludedRecipient[]>([]);
    const [reviewing, setReviewing] = useState(false);
    const [queueing, setQueueing] = useState(false);
    const [finalConfirmation, setFinalConfirmation] = useState(false);

    const uniqueIds = useMemo(() => [...new Set(selectedIds)], [selectedIds]);
    const capExceeded = uniqueIds.length > MAX_BATCH_RECIPIENTS;

    useEffect(() => {
        if (!isOpen) return;
        setStep('configure');
        setReviewedRecipients([]);
        setExcludedRecipients([]);
        setFinalConfirmation(false);
    }, [isOpen, recipientSource, selectedIds]);

    const handleReview = async () => {
        if (!uniqueIds.length || capExceeded) return;
        setReviewing(true);
        const result = await leadService.previewBatchOutreach({
            leadIds: uniqueIds,
            source: recipientSource,
        });
        setReviewing(false);

        if (!result.success) {
            toast.error(result.error || 'Unable to review recipients');
            return;
        }

        setReviewedRecipients(result.recipients || []);
        setExcludedRecipients(result.excluded || []);
        setFinalConfirmation(false);
        setStep('review');
    };

    const handleQueue = async () => {
        if (!finalConfirmation || !reviewedRecipients.length) return;

        setQueueing(true);
        const result = await leadService.sendBatchOutreach({
            leadIds: uniqueIds,
            tone,
            customContext: context,
            deliveryProvider: provider,
            source: recipientSource,
            finalApproval: true,
        });
        setQueueing(false);

        if (!result.success) {
            toast.error(result.error || 'Unable to queue batch outreach');
            return;
        }

        const skipped = result.skipped || 0;
        toast.success(
            `${result.total || reviewedRecipients.length} reviewed recipient${(result.total || reviewedRecipients.length) === 1 ? '' : 's'} queued${skipped ? `; ${skipped} excluded` : ''}. No email was sent from this screen.`
        );
        onSuccess();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 sm:items-center">
            <div className="w-full max-h-[92vh] overflow-y-auto rounded-t-[2.5rem] border-t border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-500 sm:max-w-xl sm:rounded-[2.5rem] sm:border sm:p-8">
                <div className="mb-7 flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-2xl font-black tracking-tight text-white">
                            {step === 'review' ? 'Review outreach batch' : 'Prepare outreach batch'}
                        </h3>
                        <p className="mt-1 text-sm font-bold uppercase tracking-widest text-slate-400">
                            {uniqueIds.length} selected · maximum {MAX_BATCH_RECIPIENTS}
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Close batch outreach" className="rounded-2xl bg-slate-800 p-3 text-slate-400 transition-all hover:bg-slate-700 hover:text-white">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {step === 'configure' ? (
                    <div className="space-y-6">
                        {capExceeded && (
                            <div className="flex gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">
                                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                                <p className="text-sm leading-6">This selection has {uniqueIds.length} recipients. A reviewed batch is limited to {MAX_BATCH_RECIPIENTS}; remove {uniqueIds.length - MAX_BATCH_RECIPIENTS} recipients before continuing.</p>
                            </div>
                        )}

                        <div>
                            <label className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                                <Zap className="h-4 w-4 text-amber-400" />
                                Engagement tone
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {['professional', 'punchy', 'consultative', 'direct'].map((item) => (
                                    <button
                                        key={item}
                                        onClick={() => setTone(item)}
                                        className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                                            tone === item
                                                ? 'border-teal-500 bg-teal-500/10 text-teal-400 shadow-lg shadow-teal-500/10'
                                                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                                        }`}
                                    >
                                        {item.charAt(0).toUpperCase() + item.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                                <Target className="h-4 w-4 text-teal-400" />
                                Helpful context for the draft
                            </label>
                            <textarea
                                value={context}
                                onChange={(event) => setContext(event.target.value)}
                                placeholder="For example: mention our recent industry report on Q3 growth."
                                className="h-28 w-full resize-none rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white transition-all placeholder:text-slate-600 focus:border-teal-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                                <ShieldCheck className="h-4 w-4 text-blue-400" />
                                Delivery channel
                            </label>
                            <select
                                value={provider}
                                onChange={(event) => setProvider(event.target.value)}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white transition-all focus:border-teal-500 focus:outline-none"
                            >
                                <option value="sendgrid">SendGrid</option>
                                <option value="resend">Resend</option>
                                <option value="zoho">Zoho Mail</option>
                            </select>
                        </div>

                        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm leading-6 text-blue-100">
                            First review the final recipient list. The review checks for direct email addresses, recorded marketing consent, and suppression status. No email is sent at this stage.
                        </div>

                        <Button
                            onClick={handleReview}
                            isLoading={reviewing}
                            disabled={!uniqueIds.length || capExceeded}
                            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-teal-600 py-4 text-lg font-black uppercase tracking-widest text-white shadow-xl shadow-teal-500/20 hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Eye className="h-6 w-6" />
                            Review recipients
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                            <div className="flex gap-3">
                                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                                <div>
                                    <p className="font-bold text-emerald-100">{reviewedRecipients.length} recipients passed review</p>
                                    <p className="mt-1 text-sm leading-6 text-emerald-100/75">Only the people listed below can be queued. They have a direct email address, recorded marketing consent, and no active suppression.</p>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-700">
                            <div className="border-b border-slate-700 bg-slate-800/70 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400">Recipients to queue</div>
                            <div className="max-h-52 divide-y divide-slate-800 overflow-y-auto bg-slate-950/30">
                                {reviewedRecipients.map((recipient) => (
                                    <div key={`${recipient.kind}-${recipient.id}`} className="px-4 py-3">
                                        <p className="truncate text-sm font-bold text-white">{recipient.name}</p>
                                        <p className="truncate text-xs text-slate-400">{recipient.email}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {excludedRecipients.length > 0 && (
                            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                                <p className="text-sm font-bold text-amber-100">{excludedRecipients.length} recipients excluded</p>
                                <div className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs leading-5 text-amber-100/80">
                                    {excludedRecipients.map((recipient) => (
                                        <p key={`${recipient.kind}-${recipient.id}`}>{recipient.name}: {exclusionLabel(recipient.reason)}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-200">
                            <input
                                type="checkbox"
                                checked={finalConfirmation}
                                onChange={(event) => setFinalConfirmation(event.target.checked)}
                                className="mt-1 h-4 w-4 accent-teal-500"
                            />
                            <span>I have reviewed these recipients. I confirm that this batch may be queued for server-side processing. This confirmation is recorded in the audit trail.</span>
                        </label>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <Button
                                onClick={() => setStep('configure')}
                                disabled={queueing}
                                className="flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 py-3 font-bold text-slate-200 hover:bg-slate-700"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>
                            <Button
                                onClick={handleQueue}
                                isLoading={queueing}
                                disabled={!finalConfirmation || !reviewedRecipients.length}
                                className="flex items-center justify-center gap-2 rounded-2xl bg-teal-600 py-3 font-black text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Send className="h-4 w-4" />
                                Confirm & queue
                            </Button>
                        </div>
                        <p className="text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">Queuing does not send from this screen. Processing is tracked in the outreach log and audit trail.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
