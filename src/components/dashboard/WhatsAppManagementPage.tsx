'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import WhatsAppIntegration from './business/WhatsAppIntegration';

export default function WhatsAppManagementPage() {
    const webhookUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/api/webhooks/whatsapp`
        : '/api/webhooks/whatsapp';

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                    <MessageCircle className="w-8 h-8 text-teal-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white">WhatsApp Accounts</h1>
                    <p className="text-slate-400 text-sm">Connect multiple Green API WhatsApp instances for outreach and AI chat.</p>
                </div>
            </div>

            {/* Setup Guide */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-4"
            >
                <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" /> Setup Guide — Green API
                </h2>
                <ol className="space-y-4 text-sm text-slate-300">
                    <li className="flex gap-3">
                        <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                        <div>
                            <p className="font-semibold text-white mb-1">Create a Green API Account</p>
                            <p className="text-slate-400">Sign up at <a href="https://green-api.com" target="_blank" rel="noreferrer" className="text-teal-400 hover:underline inline-flex items-center gap-1">green-api.com <ExternalLink className="w-3 h-3" /></a> and create a new Instance. This gives you an <strong>Instance ID</strong> and an <strong>API Token</strong>.</p>
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                        <div>
                            <p className="font-semibold text-white mb-1">Configure the Webhook URL</p>
                            <p className="text-slate-400 mb-2">In your Green API instance settings, go to <strong>Account &gt; Notifications</strong> and set the <strong>Webhook URL</strong> to:</p>
                            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3">
                                <code className="text-teal-400 text-xs font-mono break-all flex-1">{webhookUrl}</code>
                                <button
                                    onClick={() => navigator.clipboard.writeText(webhookUrl)}
                                    className="text-slate-500 hover:text-white text-xs px-2 py-1 rounded-lg bg-slate-800 whitespace-nowrap"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                        <div>
                            <p className="font-semibold text-white mb-1">Connect Your Instance Below</p>
                            <p className="text-slate-400">Give it an alias (e.g. "Sales Line"), paste your Instance ID and API Token into the form below, then click <strong>Connect Instance</strong>.</p>
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="w-7 h-7 rounded-full bg-teal-500/20 text-teal-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                        </span>
                        <div>
                            <p className="font-semibold text-white mb-1">That's it!</p>
                            <p className="text-slate-400">Incoming messages will appear in <strong>Messages</strong> in real-time. The AI chatbot will auto-reply if enabled in <strong>Settings → AI Chatbot</strong>.</p>
                        </div>
                    </li>
                </ol>
            </motion.div>

            {/* Integration Panel */}
            <WhatsAppIntegration />
        </div>
    );
}
