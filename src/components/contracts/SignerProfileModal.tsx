import React, { useEffect, useState } from 'react';
import { X, Loader2, Save, Trash2, PenTool, BookmarkCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { contractSignerProfileService } from '@/services/contractSignerProfileService';
import type { ContractSignerProfile, SignerProfileTextField } from '@/lib/contracts/signerProfile';
import { SignaturePad } from './SignaturePad';
import { CONTRACT_INPUT_CLASS, CONTRACT_LABEL_CLASS, JurisdictionFields } from './JurisdictionFields';

interface SignerProfileModalProps {
    profile: ContractSignerProfile;
    onSaved: (profile: ContractSignerProfile) => void;
    onClose: () => void;
}

const PROVIDER_FIELDS: { key: SignerProfileTextField; label: string; placeholder: string }[] = [
    { key: 'providerName', label: 'Full Legal Name / Company Name', placeholder: 'e.g. Acme Solutions Ltd.' },
    { key: 'providerEmail', label: 'Email Address', placeholder: 'you@company.com' },
    { key: 'providerAddress', label: 'Business Address', placeholder: '123 Business Ave, City, State' },
    { key: 'providerPhone', label: 'Phone Number', placeholder: '+1 (555) 000-0000' },
    { key: 'providerRegistration', label: 'Business Registration Number', placeholder: 'e.g. LLC-123456' },
];

/**
 * "My signature" — the owner's reusable signer profile. Everything saved here
 * is pre-filled on every new contract and the signature is applied with one
 * click, so the owner never has to type their details or redraw again.
 */
export const SignerProfileModal: React.FC<SignerProfileModalProps> = ({ profile, onSaved, onClose }) => {
    const { t } = useLanguage();
    const [draft, setDraft] = useState<ContractSignerProfile>(profile);
    const [saving, setSaving] = useState(false);
    const [removingSignature, setRemovingSignature] = useState(false);
    const [replacingSignature, setReplacingSignature] = useState(!profile.signature);

    useEffect(() => {
        setDraft(profile);
        setReplacingSignature(!profile.signature);
    }, [profile]);

    const setField = (key: SignerProfileTextField, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));

    const saveDetails = async () => {
        setSaving(true);
        try {
            const saved = await contractSignerProfileService.save({
                providerName: draft.providerName,
                providerAddress: draft.providerAddress,
                providerEmail: draft.providerEmail,
                providerPhone: draft.providerPhone,
                providerRegistration: draft.providerRegistration,
                jurisdiction: draft.jurisdiction,
                governingLaw: draft.governingLaw,
            });
            onSaved(saved);
            toast.success(t('Signer details saved — new contracts will be pre-filled.'));
            onClose();
        } catch (error) {
            toast.error((error as Error).message || t('Signer details could not be saved'));
        } finally {
            setSaving(false);
        }
    };

    const rememberSignature = async (cleanDataUrl: string, fullName: string) => {
        try {
            const saved = await contractSignerProfileService.save({ signature: { dataUrl: cleanDataUrl, fullName } });
            onSaved(saved);
            setDraft(saved);
            setReplacingSignature(false);
            toast.success(t('Signature saved. You can now sign contracts with one click.'));
        } catch (error) {
            toast.error((error as Error).message || t('Signature could not be saved'));
        }
    };

    const removeSignature = async () => {
        setRemovingSignature(true);
        try {
            const saved = await contractSignerProfileService.removeSignature();
            onSaved(saved);
            setDraft(saved);
            setReplacingSignature(true);
            toast.success(t('Saved signature removed'));
        } catch (error) {
            toast.error((error as Error).message || t('Saved signature could not be removed'));
        } finally {
            setRemovingSignature(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="signer-profile-title">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur">
                    <div>
                        <h2 id="signer-profile-title" className="text-white font-bold text-lg flex items-center gap-2">
                            <PenTool className="w-4 h-4 text-teal-400" /> {t('My signature & signer details')}
                        </h2>
                        <p className="text-slate-400 text-sm mt-0.5">
                            {t('Saved once, used on every contract: your details are pre-filled and you sign with one click.')}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" aria-label={t('Close')}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    <section className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-widest text-teal-300 flex items-center gap-1.5">
                            <BookmarkCheck className="w-3.5 h-3.5" /> {t('Saved signature')}
                        </h3>
                        {draft.signature && !replacingSignature ? (
                            <div className="rounded-2xl border border-teal-500/30 bg-slate-950/40 p-5 flex flex-col items-center gap-3">
                                <img src={draft.signature.dataUrl} alt={t('Saved signature')} className="h-20 object-contain bg-white px-4 py-2 rounded-xl" />
                                <p className="text-sm font-semibold text-white font-mono">{draft.signature.fullName}</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setReplacingSignature(true)}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                    >
                                        <PenTool className="w-3.5 h-3.5" /> {t('Replace signature')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={removeSignature}
                                        disabled={removingSignature}
                                        className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-60"
                                    >
                                        {removingSignature ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} {t('Remove')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-slate-400">
                                    {t('Draw your signature once. It is stored privately on your account and applied to contracts you sign.')}
                                </p>
                                <SignaturePad
                                    onSave={() => undefined}
                                    onClear={() => undefined}
                                    onRememberSignature={rememberSignature}
                                    initialFullName={draft.signature?.fullName || draft.providerName}
                                />
                                {draft.signature && (
                                    <button type="button" onClick={() => setReplacingSignature(false)} className="text-xs font-bold text-slate-400 hover:text-white">
                                        {t('Keep current signature')}
                                    </button>
                                )}
                            </div>
                        )}
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-teal-300">{t('Service Provider (You)')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {PROVIDER_FIELDS.map((field) => (
                                <div key={field.key} className={field.key === 'providerAddress' ? 'md:col-span-2' : ''}>
                                    <label className={CONTRACT_LABEL_CLASS}>{t(field.label)}</label>
                                    <input
                                        className={CONTRACT_INPUT_CLASS}
                                        value={draft[field.key]}
                                        onChange={(e) => setField(field.key, e.target.value)}
                                        placeholder={field.placeholder}
                                    />
                                </div>
                            ))}
                            <JurisdictionFields
                                jurisdiction={draft.jurisdiction}
                                governingLaw={draft.governingLaw}
                                onChange={(next) => setDraft((prev) => ({ ...prev, ...next }))}
                                hint={t('Used as the default governing law on new contracts. A contract cannot be sent without one.')}
                            />
                        </div>
                    </section>
                </div>

                <div className="sticky bottom-0 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold">
                        {t('Close')}
                    </button>
                    <button
                        type="button"
                        onClick={saveDetails}
                        disabled={saving}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('Save signer details')}
                    </button>
                </div>
            </div>
        </div>
    );
};
