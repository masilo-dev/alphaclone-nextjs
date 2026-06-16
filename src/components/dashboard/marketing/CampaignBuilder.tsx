'use client';

import React, { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { campaignService } from '@/services/campaignService';
import toast from 'react-hot-toast';

interface CampaignBuilderProps {
    onClose: () => void;
    onCreated: () => void;
}

const CampaignBuilder: React.FC<CampaignBuilderProps> = ({ onClose, onCreated }) => {
    const { currentTenant } = useTenant();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        subject: '',
        body: '',
        type: 'email' as string,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant?.id) return;
        setLoading(true);
        try {
            await campaignService.createCampaign({
                tenantId: currentTenant.id,
                name: form.name,
                subject: form.subject,
                body: form.body,
                type: form.type,
                status: 'draft',
            });
            toast.success('Campaign created!');
            onCreated();
        } catch (err) {
            console.error(err);
            toast.error('Failed to create campaign');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <h2 className="text-lg font-bold text-white">New Campaign</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
                    <X className="w-4 h-4 text-slate-300" />
                </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Campaign Name</label>
                    <input
                        required
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Summer Promo 2026"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 transition-colors"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Subject Line</label>
                    <input
                        required
                        value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder="e.g. Exclusive offer just for you 🎉"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 transition-colors"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message Body</label>
                    <textarea
                        required
                        rows={8}
                        value={form.body}
                        onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                        placeholder="Write your campaign message here..."
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 transition-colors resize-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Type</label>
                    <select
                        value={form.type}
                        onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500/50 transition-colors"
                    >
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="whatsapp">WhatsApp</option>
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-colors"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {loading ? 'Creating...' : 'Create Campaign'}
                </button>
            </form>
        </div>
    );
};

export default CampaignBuilder;
