'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Receipt, CheckCircle, Save, Users, Loader2, Search, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input } from '../ui/UIComponents';
import toast from 'react-hot-toast';
import { useTenant } from '../../contexts/TenantContext';
import { useCurrency } from '../../hooks/useCurrency';

interface AddExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExpenseAdded: () => void;
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ isOpen, onClose, onExpenseAdded }) => {
    const { currentTenant } = useTenant();
    const { currencyCode } = useCurrency();

    // Accounting state
    const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
    const [assetAccounts, setAssetAccounts] = useState<any[]>([]);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState<'edit' | 'success'>('edit');

    const [searchQuery, setSearchQuery] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        taxAmount: '0',
        currency: 'USD',
        description: '',
        vendorName: '',
        paymentMethod: 'card',
        expenseAccountId: '',
        assetAccountId: '',
        billable: false,
        notes: '',
    });

    useEffect(() => {
        const fetchData = async () => {
            if (!isOpen || !currentTenant?.id) return;
            try {
                const { chartOfAccountsService } = await import('../../services/accounting/chartOfAccountsService');
                const { businessClientService } = await import('../../services/businessClientService');

                let [expenseRes, assetRes, clientsRes] = await Promise.all([
                    chartOfAccountsService.getAccountsByType('expense'),
                    chartOfAccountsService.getAccountsByType('asset'),
                    businessClientService.getClients(currentTenant.id)
                ]);

                if (expenseRes.accounts.length === 0 || assetRes.accounts.length === 0) {
                    const initResult = await chartOfAccountsService.initializeDefaultAccounts();
                    if (initResult.success) {
                        [expenseRes, assetRes] = await Promise.all([
                            chartOfAccountsService.getAccountsByType('expense'),
                            chartOfAccountsService.getAccountsByType('asset'),
                        ]);
                    }
                }

                if (expenseRes.accounts) {
                    setExpenseAccounts(expenseRes.accounts);
                    if (expenseRes.accounts.length > 0) {
                        setFormData(prev => ({ ...prev, expenseAccountId: expenseRes.accounts[0].id }));
                    }
                }

                if (assetRes.accounts) {
                    const currentAssets = assetRes.accounts.filter((a: any) => 
                        a.accountSubtype === 'current_asset' || 
                        a.accountName.toLowerCase().includes('cash') ||
                        a.accountName.toLowerCase().includes('bank')
                    );
                    const defaultAsset = currentAssets.length > 0 ? currentAssets[0] : assetRes.accounts[0];
                    setAssetAccounts(assetRes.accounts);
                    if (defaultAsset) {
                        setFormData(prev => ({ ...prev, assetAccountId: defaultAsset.id }));
                    }
                }

                if (clientsRes.clients) {
                    setClients(clientsRes.clients);
                }
            } catch (err) {
                console.error("Failed to fetch data:", err);
                toast.error("Failed to load necessary data.");
            }
        };

        fetchData();
        setStep('edit');
    }, [isOpen, currentTenant?.id]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowContactDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const resetForm = () => {
        setFormData({
            date: new Date().toISOString().split('T')[0],
            amount: '',
            taxAmount: '0',
            currency: 'USD',
            description: '',
            vendorName: '',
            paymentMethod: 'card',
            expenseAccountId: expenseAccounts.length > 0 ? expenseAccounts[0].id : '',
            assetAccountId: assetAccounts.length > 0 ? assetAccounts[0].id : '',
            billable: false,
            notes: '',
        });
        setStep('edit');
        setSearchQuery('');
    };

    const getSuggestedAccount = (vendorName: string) => {
        const name = vendorName.toLowerCase();
        
        // Software & Subscriptions
        if (name.includes('google') || name.includes('microsoft') || name.includes('github') || name.includes('vercel') || name.includes('aws') || name.includes('digitalocean') || name.includes('adobe') || name.includes('slack') || name.includes('zoom') || name.includes('software') || name.includes('subscription')) {
            return expenseAccounts.find(a => a.accountName.toLowerCase().includes('software') || a.accountName.toLowerCase().includes('subscription'))?.id;
        }
        
        // Rent & Utilities
        if (name.includes('rent') || name.includes('lease') || name.includes('office') || name.includes('space')) {
            return expenseAccounts.find(a => a.accountName.toLowerCase().includes('rent'))?.id;
        }
        if (name.includes('electric') || name.includes('water') || name.includes('gas') || name.includes('utility') || name.includes('utilities') || name.includes('internet') || name.includes('broadband') || name.includes('phone')) {
            return expenseAccounts.find(a => a.accountName.toLowerCase().includes('utilit'))?.id;
        }

        // Travel & Meals
        if (name.includes('uber') || name.includes('lyft') || name.includes('taxi') || name.includes('train') || name.includes('flight') || name.includes('airline') || name.includes('hotel') || name.includes('travel')) {
            return expenseAccounts.find(a => a.accountName.toLowerCase().includes('travel'))?.id;
        }
        if (name.includes('restaurant') || name.includes('cafe') || name.includes('coffee') || name.includes('starbucks') || name.includes('lunch') || name.includes('dinner') || name.includes('meal') || name.includes('food')) {
            return expenseAccounts.find(a => a.accountName.toLowerCase().includes('meal') || a.accountName.toLowerCase().includes('entertainment'))?.id;
        }

        // Professional Services
        if (name.includes('legal') || name.includes('law') || name.includes('attorney') || name.includes('consult') || name.includes('accounting') || name.includes('audit')) {
            return expenseAccounts.find(a => a.accountName.toLowerCase().includes('professional') || a.accountName.toLowerCase().includes('consult'))?.id;
        }

        // Marketing & Advertising
        if (name.includes('facebook') || name.includes('adwords') || name.includes('instagram') || name.includes('marketing') || name.includes('ads') || name.includes('advertis')) {
            return expenseAccounts.find(a => a.accountName.toLowerCase().includes('market') || a.accountName.toLowerCase().includes('advertis'))?.id;
        }

        return null;
    };

    const handleVendorSelect = (name: string) => {
        setFormData(prev => ({ ...prev, vendorName: name, description: prev.description || `Expense for ${name}` }));
        setSearchQuery('');
        setShowContactDropdown(false);
        
        const suggestedId = getSuggestedAccount(name);
        if (suggestedId) {
            setFormData(prev => ({ ...prev, expenseAccountId: suggestedId }));
            toast.success(`Automatically selected account based on vendor`, { icon: '🤖', duration: 2000 });
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSave = async () => {
        if (!currentTenant?.id) {
            toast.error('No active organization session');
            return;
        }

        if (!formData.description || !formData.amount || !formData.expenseAccountId || !formData.assetAccountId) {
            toast.error('Please fill in all required fields');
            return;
        }

        const amountNum = parseFloat(formData.amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        setIsSubmitting(true);

        try {
            const { journalEntryService } = await import('../../services/accounting/journalEntryService');

            const { entry, error: createError } = await journalEntryService.createSimpleEntry(
                formData.date,
                formData.description,
                formData.expenseAccountId,
                formData.assetAccountId,
                amountNum,
                undefined,
                'manual'
            );

            if (createError) throw new Error(createError);

            if (entry) {
                const { error: postError } = await journalEntryService.postEntry(entry.id);
                if (postError) throw new Error(`Entry created but failed to post: ${postError}`);

                setStep('success');
                toast.success('Expense recorded!');
                onExpenseAdded();
            }
        } catch (err: any) {
            console.error('Expense submission error:', err);
            toast.error(`Failed to record expense: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col z-[120]"
                    >
                        {/* Header */}
                        <div className="p-6 sm:p-8 border-b border-white/5 flex items-center justify-between bg-white/2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                                    <Receipt className="w-5 h-5 text-teal-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white uppercase tracking-tight">Record Outflow</h2>
                                    <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">General Ledger · Expense Entry</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-3 text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
                            <AnimatePresence mode="wait">
                                {step === 'edit' ? (
                                    <motion.div
                                        key="edit"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="space-y-8"
                                    >
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block px-1">Effective Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.date}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-teal-500/40 outline-none transition-all shadow-inner"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block px-1">Amount ({currencyCode})</label>
                                                <input
                                                    type="number"
                                                    value={formData.amount}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                                    placeholder="0.00"
                                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-teal-500/40 outline-none transition-all shadow-inner placeholder:text-slate-700 font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block px-1">Expense Account (Category)</label>
                                                <select
                                                    value={formData.expenseAccountId}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, expenseAccountId: e.target.value }))}
                                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-teal-500/40 outline-none transition-all shadow-inner appearance-none"
                                                >
                                                    <option value="">Select Category</option>
                                                    {expenseAccounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block px-1">Paid From (Asset Account)</label>
                                                <select
                                                    value={formData.assetAccountId}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, assetAccountId: e.target.value }))}
                                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-teal-500/40 outline-none transition-all shadow-inner appearance-none"
                                                >
                                                    <option value="">Select Asset</option>
                                                    {assetAccounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="relative" ref={dropdownRef}>
                                            <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-3 px-1">Vendor / Counterparty</label>
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-white/5 rounded-lg group-focus-within:bg-teal-500/10 transition-colors">
                                                    <Users className="w-3.5 h-3.5 text-slate-500 group-focus-within:text-teal-500" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={formData.vendorName}
                                                    onChange={e => {
                                                        setFormData(prev => ({ ...prev, vendorName: e.target.value }));
                                                        setSearchQuery(e.target.value);
                                                        setShowContactDropdown(true);
                                                    }}
                                                    onFocus={() => setShowContactDropdown(true)}
                                                    placeholder="Search entity or enter manual name..."
                                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-12 py-4 text-sm text-white focus:border-teal-500/40 outline-none transition-all shadow-inner placeholder:text-slate-700 font-medium"
                                                />
                                            </div>

                                            {/* Quick Select Vendors */}
                                            {clients.length > 0 && !formData.vendorName && (
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    <span className="text-xs font-black text-slate-600 uppercase tracking-widest w-full mb-1 ml-1 cursor-default">Quick Select</span>
                                                    {clients.slice(0, 5).map(client => (
                                                        <button
                                                            key={client.id}
                                                            type="button"
                                                            onClick={() => handleVendorSelect(client.name)}
                                                            className="px-3 py-1.5 rounded-full bg-slate-800/50 border border-white/5 text-xs font-bold text-slate-400 hover:bg-teal-500/10 hover:border-teal-500/30 hover:text-teal-400 transition-all flex items-center gap-1.5"
                                                        >
                                                            <Plus className="w-3 h-3" /> {client.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <AnimatePresence>
                                                {showContactDropdown && (searchQuery.length > 0) && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10, scale: 0.98 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: -10, scale: 0.98 }}
                                                        className="absolute left-0 right-0 top-full mt-3 bg-slate-900 border border-white/10 rounded-3xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)] z-[130] max-h-60 overflow-y-auto p-2 backdrop-blur-2xl"
                                                    >
                                                        {clients.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                                                            clients.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase())).map(client => (
                                                                <button
                                                                    key={client.id}
                                                                    onClick={() => handleVendorSelect(client.name)}
                                                                    className="w-full text-left p-3.5 rounded-2xl hover:bg-white/5 transition-all group flex items-center justify-between border border-transparent hover:border-white/5 mb-1"
                                                                >
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner">
                                                                            <span className="text-xs font-black text-teal-500">{client.name?.charAt(0)}</span>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{client.name}</p>
                                                                            <p className="text-xs text-slate-500 font-mono">{client.email}</p>
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="p-8 text-center">
                                                                <p className="text-xs font-black uppercase tracking-widest text-slate-600 italic">Press Enter to use manual name</p>
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block px-1">Description</label>
                                            <input
                                                type="text"
                                                value={formData.description}
                                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                                placeholder="What was this expense for?"
                                                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-teal-500/40 outline-none transition-all shadow-inner placeholder:text-slate-700 font-medium"
                                            />
                                        </div>

                                        <div className="border-t border-white/5 pt-8">
                                            <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-4 px-1">Proof of Transaction (Optional)</label>
                                            <div className="border-2 border-dashed border-white/5 rounded-[2.5rem] p-10 text-center hover:bg-white/2 hover:border-teal-500/20 transition-all cursor-pointer group">
                                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-inner">
                                                    <Receipt className="w-8 h-8 text-slate-500 group-hover:text-teal-500 transition-colors" />
                                                </div>
                                                <p className="text-sm text-slate-300 font-bold">Upload Receipt</p>
                                                <p className="text-xs text-slate-500 mt-2 uppercase tracking-widest font-mono">PDF, Image · Max 5MB</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center justify-center py-12 text-center"
                                    >
                                        <div className="w-24 h-24 bg-green-500/10 rounded-[2.5rem] flex items-center justify-center mb-8 border border-green-500/20 shadow-[0_20px_40px_-10px_rgba(34,197,94,0.3)]">
                                            <CheckCircle className="w-12 h-12 text-green-400" />
                                        </div>
                                        <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Expense Saved</h3>
                                        <p className="text-slate-500 max-w-sm mb-10 text-lg leading-relaxed font-medium">
                                            The expense entry was saved successfully and posted to the ledger.
                                        </p>
                                        <Button onClick={handleClose} className="h-14 px-12 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] outline-none">
                                            Close
                                        </Button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        {step === 'edit' && (
                            <div className="p-8 border-t border-white/5 bg-white/2 flex items-center justify-between">
                                <div className="text-xs font-black text-slate-600 uppercase tracking-[0.2em] hidden sm:block">
                                    Ledger entry
                                </div>
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <button
                                        onClick={handleClose}
                                        className="flex-1 sm:flex-none px-8 py-3.5 text-slate-400 hover:text-white font-black text-xs uppercase tracking-widest transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleSave}
                                        disabled={isSubmitting || !formData.expenseAccountId || !formData.assetAccountId}
                                        className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-500 text-white px-10 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-teal-600/20 disabled:opacity-50 disabled:grayscale"
                                    >
                                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 stroke-[2.5px]" />}
                                        Save Expense
                                    </motion.button>
                                </div>
                            </div>
                        )}
                    </motion.div >
                </div >
            )}
        </AnimatePresence>
    );
};

export default AddExpenseModal;

