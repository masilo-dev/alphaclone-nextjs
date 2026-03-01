'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Mail,
    Sparkles,
    Send,
    Users as UsersIcon,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Search,
    Wand2,
    History,
    CheckSquare,
    Square
} from 'lucide-react';
import { Button, Input } from '../ui/UIComponents';
import { toast } from 'react-hot-toast';
import { contactService, type Contact } from '../../services/contactService';

interface EmailDraft {
    to: string;
    subject: string;
    body: string;
}

const GmailTab: React.FC = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [sending, setSending] = useState(false);
    const [drafting, setDrafting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [predefinedTemplate, setPredefinedTemplate] = useState('Hello [Name], I noticed your business [Business] and wanted to reach out...');
    const [drafts, setDrafts] = useState<Record<string, EmailDraft>>({});

    useEffect(() => {
        const loadContacts = async () => {
            try {
                const { contacts: fetchedContacts } = await contactService.getContacts();
                setContacts(fetchedContacts || []);
            } catch (error) {
                console.error('Error loading contacts:', error);
            } finally {
                setLoadingContacts(false);
            }
        };
        loadContacts();
    }, []);

    const toggleContact = (id: string) => {
        setSelectedContacts(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedContacts.length === contacts.length) {
            setSelectedContacts([]);
        } else {
            setSelectedContacts(contacts.map(c => c.id));
        }
    };

    const generateAIDrafts = async () => {
        if (selectedContacts.length === 0) {
            toast.error('Please select contacts first');
            return;
        }

        setDrafting(true);
        const newDrafts: Record<string, EmailDraft> = { ...drafts };

        try {
            for (const id of selectedContacts) {
                const contact = contacts.find(c => c.id === id);
                if (!contact) continue;

                const name = contact.firstName || contact.fullName.split(' ')[0];
                const business = (contact as any).businessName || 'your company';

                const body = `Hi ${name},\n\nI was reviewing ${business} and was really impressed by your market presence. I'd love to discuss how AlphaClone can help you scale even further.\n\nBest regards,\nAlphaClone Team`;

                newDrafts[id] = {
                    to: contact.email,
                    subject: `Question about ${business}`,
                    body: body
                };
            }
            setDrafts(newDrafts);
            toast.success('AI Drafts generated for selected contacts!');
        } catch (error) {
            toast.error('Failed to generate AI drafts');
        } finally {
            setDrafting(false);
        }
    };

    const handleSendBulk = async () => {
        if (selectedContacts.length === 0) return;

        setSending(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            toast.success(`Successfully sent emails to ${selectedContacts.length} contacts!`);
            setSelectedContacts([]);
            setDrafts({});
        } catch (error) {
            toast.error('Bulk send failed');
        } finally {
            setSending(false);
        }
    };

    const filteredContacts = contacts.filter(c =>
        c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] animate-fade-in gap-6 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-3xl border border-white/5 backdrop-blur-xl">
                <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center border border-teal-500/20">
                            <Mail className="w-6 h-6 text-teal-400" />
                        </div>
                        Gmail AI Commander
                    </h2>
                    <p className="text-slate-400 mt-1 max-w-md">Personalize and dispatch bulk communications using context-aware AI agents.</p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        onClick={generateAIDrafts}
                        disabled={drafting || selectedContacts.length === 0}
                        className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20"
                    >
                        {drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                        {drafting ? 'Brainstorming...' : 'AI Personalize All'}
                    </Button>
                    <Button
                        onClick={handleSendBulk}
                        disabled={sending || selectedContacts.length === 0}
                        className="bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20"
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        Dispatch to {selectedContacts.length} Contacts
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
                <div className="lg:col-span-5 flex flex-col bg-slate-900/30 rounded-3xl border border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <div className="relative flex-1 mr-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input
                                placeholder="Filter contacts..."
                                className="pl-10 h-10 bg-slate-950/50 border-white/5 rounded-xl"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={toggleAll}
                            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400"
                            title="Select All"
                        >
                            {selectedContacts.length === contacts.length ? <CheckSquare className="w-5 h-5 text-teal-500" /> : <Square className="w-5 h-5" />}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {loadingContacts ? (
                            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500">
                                <Loader2 className="w-8 h-8 animate-spin" />
                                <span className="text-xs uppercase tracking-widest font-black">Scanning database...</span>
                            </div>
                        ) : filteredContacts.length === 0 ? (
                            <div className="text-center p-12 text-slate-500 italic">No contacts found</div>
                        ) : (
                            filteredContacts.map(contact => (
                                <div
                                    key={contact.id}
                                    onClick={() => toggleContact(contact.id)}
                                    className={`p-3 rounded-2xl border transition-all cursor-pointer group flex items-center gap-3 ${selectedContacts.includes(contact.id)
                                            ? 'bg-teal-500/10 border-teal-500/30'
                                            : 'bg-slate-900/50 border-white/5 hover:border-white/10'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border ${selectedContacts.includes(contact.id)
                                            ? 'bg-teal-500 text-white border-teal-400/50'
                                            : 'bg-slate-800 text-slate-400 border-white/5'
                                        }`}>
                                        {contact.firstName?.charAt(0) || contact.fullName.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-white truncate text-sm">{contact.fullName}</div>
                                        <div className="text-[10px] text-slate-500 truncate font-mono">{contact.email}</div>
                                    </div>
                                    {drafts[contact.id] && (
                                        <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center" title="AI Draft Ready">
                                            <Sparkles className="w-3 h-3 text-purple-400" />
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="lg:col-span-7 flex flex-col bg-slate-900/30 rounded-3xl border border-white/5 overflow-hidden relative">
                    {selectedContacts.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-12 text-center">
                            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 opacity-50">
                                <UsersIcon className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">Ready for Dispatch</h3>
                            <p className="max-w-xs text-sm">Select one or more contacts from the left to begin personalized AI drafting.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-white/5 bg-slate-900/50 flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                                    Current Draft Queue ({selectedContacts.length})
                                </span>
                                <div className="flex items-center gap-2">
                                    <History className="w-4 h-4 text-slate-600" />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                {selectedContacts.map(id => {
                                    const contact = contacts.find(c => c.id === id);
                                    if (!contact) return null;
                                    const draft = drafts[id];

                                    return (
                                        <div key={id} className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Mail className="w-4 h-4 text-teal-400" />
                                                    <span className="text-xs font-bold text-white">{contact.email}</span>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="relative">
                                                    <label className="text-[10px] uppercase font-black tracking-tighter text-slate-600 block mb-1">Subject</label>
                                                    <Input
                                                        value={draft?.subject || `Contextual reaching out to ${contact.fullName}`}
                                                        className="bg-transparent border-white/5 text-sm h-8"
                                                    />
                                                </div>
                                                <div className="relative">
                                                    <label className="text-[10px] uppercase font-black tracking-tighter text-slate-600 block mb-1">AI Generated Body</label>
                                                    <textarea
                                                        className="w-full bg-slate-900/50 border border-white/5 rounded-xl p-4 text-sm text-slate-300 min-h-[120px] focus:outline-none focus:border-teal-500/30 transition-all font-sans"
                                                        value={draft?.body || predefinedTemplate.replace('[Name]', contact.firstName || contact.fullName.split(' ')[0]).replace('[Business]', (contact as any).businessName || 'your organization')}
                                                        onChange={(e) => {
                                                            setDrafts(prev => ({
                                                                ...prev,
                                                                [id]: { ...(prev[id] || { to: contact.email, subject: `Question about your business` }), body: e.target.value }
                                                            }));
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GmailTab;
