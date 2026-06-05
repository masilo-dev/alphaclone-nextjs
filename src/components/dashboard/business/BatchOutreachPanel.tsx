import React, { useState } from 'react';
import { X, Send, MessageSquare, Zap, Target, ShieldCheck } from 'lucide-react';
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

export const BatchOutreachPanel: React.FC<BatchOutreachPanelProps> = ({ isOpen, onClose, selectedIds, onSuccess, recipientSource = 'leads' }) => {
    const [tone, setTone] = useState('professional');
    const [context, setContext] = useState('');
    const [provider, setProvider] = useState('zoho');
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        if (selectedIds.length === 0) return;
        
        setIsSending(true);
        const { success, error, sent, total } = await leadService.sendBatchOutreach({
            leadIds: selectedIds,
            tone,
            customContext: context,
            deliveryProvider: provider,
            source: recipientSource,
        });

        setIsSending(false);
        if (success) {
            toast.success(`Sent ${sent ?? selectedIds.length} of ${total ?? selectedIds.length} outreach emails`);
            onSuccess();
            onClose();
        } else {
            toast.error(error || 'Failed to trigger batch outreach');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full sm:max-w-lg bg-slate-900 border-t sm:border border-slate-800 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-500">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-white tracking-tight">Batch Outreach</h3>
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">
                            {selectedIds.length} Contacts Selected
                        </p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Tone Selection */}
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-400" />
                            Engagement Tone
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {['professional', 'punchy', 'consultative', 'direct'].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTone(t)}
                                    className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                                        tone === t 
                                        ? 'bg-teal-500/10 border-teal-500 text-teal-400 shadow-lg shadow-teal-500/10' 
                                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                                >
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Context */}
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Target className="w-4 h-4 text-teal-400" />
                            Custom Strategy Context
                        </label>
                        <textarea
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            placeholder="e.g. Reference our recent industry report on Q3 growth..."
                            className="w-full h-32 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl focus:outline-none focus:border-teal-500 text-white placeholder-slate-600 text-sm resize-none transition-all"
                        />
                    </div>

                    {/* Provider Selection */}
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-blue-400" />
                            Delivery Channel
                        </label>
                        <select
                            value={provider}
                            onChange={(e) => setProvider(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl focus:outline-none focus:border-teal-500 text-white text-sm transition-all"
                        >
                            <option value="sendgrid">SendGrid (Professional)</option>
                            <option value="resend">Resend (Modern)</option>
                            <option value="zoho">Zoho Mail (Enterprise)</option>
                        </select>
                    </div>

                    {/* Action Button */}
                    <div className="pt-4">
                        <Button
                            onClick={handleSend}
                            isLoading={isSending}
                            className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl shadow-teal-500/20 flex items-center justify-center gap-3"
                        >
                            <Send className="w-6 h-6" />
                            Execute Outreach
                        </Button>
                        <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-4">
                            All messages are scrubbed for professional guardrails before sending
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
