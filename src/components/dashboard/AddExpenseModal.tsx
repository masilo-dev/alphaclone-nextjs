import React, { useState, useEffect, useRef } from 'react';
import { X, Receipt, CheckCircle, Save, Users, Loader2, Search } from 'lucide-react';
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

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');

    // Accounting state
    const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
    const [assetAccounts, setAssetAccounts] = useState<any[]>([]);
    const [selectedExpenseAccount, setSelectedExpenseAccount] = useState('');
    const [selectedAssetAccount, setSelectedAssetAccount] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState<'edit' | 'success'>('edit');

    const [searchQuery, setSearchQuery] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!isOpen || !currentTenant?.id) return;
            try {
                const { chartOfAccountsService } = await import('../../services/accounting/chartOfAccountsService');
                const { businessClientService } = await import('../../services/businessClientService');

                const [expenseRes, assetRes, clientsRes] = await Promise.all([
                    chartOfAccountsService.getAccountsByType('expense'),
                    chartOfAccountsService.getAccountsByType('asset'),
                    businessClientService.getClients(currentTenant.id)
                ]);

                if (expenseRes.accounts) {
                    setExpenseAccounts(expenseRes.accounts);
                    if (expenseRes.accounts.length > 0) setSelectedExpenseAccount(expenseRes.accounts[0].id);
                }

                if (assetRes.accounts) {
                    const currentAssets = assetRes.accounts.filter(a => a.accountSubtype === 'current_asset' || a.accountName.toLowerCase().includes('cash'));
                    setAssetAccounts(currentAssets.length > 0 ? currentAssets : assetRes.accounts);
                    if (currentAssets.length > 0) setSelectedAssetAccount(currentAssets[0].id);
                    else if (assetRes.accounts.length > 0) setSelectedAssetAccount(assetRes.accounts[0].id);
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
        setDate(new Date().toISOString().split('T')[0]);
        setDescription('');
        setAmount('');
        setStep('edit');
        setSearchQuery('');
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

        if (!description || !amount || !selectedExpenseAccount || !selectedAssetAccount) {
            toast.error('Please fill in all required fields');
            return;
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        setIsSubmitting(true);

        try {
            const { journalEntryService } = await import('../../services/accounting/journalEntryService');

            const { entry, error: createError } = await journalEntryService.createSimpleEntry(
                date,
                `Expense: ${description}`,
                selectedExpenseAccount,
                selectedAssetAccount,
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
                                <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                    <Receipt className="w-5 h-5 text-red-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white uppercase tracking-tight">Record Outflow</h2>
                                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">General Ledger · Entry Protocol</p>
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
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] block px-1">Effective Date</label>
                                                <input
                                                    type="date"
                                                    value={date}
                                                    onChange={(e) => setDate(e.target.value)}
                                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-red-500/40 outline-none transition-all shadow-inner"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] block px-1">Quantum Amount ({currencyCode})</label>
                                                <input
                                                    type="number"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-red-500/40 outline-none transition-all shadow-inner placeholder:text-slate-700 font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="relative" ref={dropdownRef}>
                                            <label className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] block mb-3 px-1">Vendor / Counterparty</label>
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-white/5 rounded-lg group-focus-within:bg-red-500/10 transition-colors">
                                                    <Users className="w-3.5 h-3.5 text-slate-500 group-focus-within:text-red-500" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={description}
                                                    onChange={e => {
                                                        setDescription(e.target.value);
                                                        setSearchQuery(e.target.value);
                                                        setShowContactDropdown(true);
                                                    }}
                                                    onFocus={() => setShowContactDropdown(true)}
                                                    placeholder="Search entity or enter manual name..."
                                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-12 py-4 text-sm text-white focus:border-red-500/40 outline-none transition-all shadow-inner placeholder:text-slate-700 font-medium"
                                                />
                                            </div>

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
                                                                    onClick={() => {
                                                                        setDescription(client.name);
                                                                        setShowContactDropdown(false);
                                                                    }}
                                                                    className="w-full text-left p-3.5 rounded-2xl hover:bg-white/5 transition-all group flex items-center justify-between border border-transparent hover:border-white/5 mb-1"
                                                                >
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-inner">
                                                                            <span className="text-xs font-black text-red-500">{client.name?.charAt(0)}</span>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{client.name}</p>
                                                                            <p className="text-[10px] text-slate-500 font-mono">{client.email}</p>
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="p-8 text-center">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 italic">Press Enter to use manual name</p>
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <div className="border-t border-white/5 pt-8">
                                            <label className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] block mb-4 px-1">Proof of Transaction (Optional)</label>
                                            <div className="border-2 border-dashed border-white/5 rounded-[2.5rem] p-10 text-center hover:bg-white/2 hover:border-red-500/20 transition-all cursor-pointer group group">
                                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-inner">
                                                    <Receipt className="w-8 h-8 text-slate-500 group-hover:text-red-500 transition-colors" />
                                                </div>
                                                <p className="text-sm text-slate-300 font-bold">Inject Digital Evidence</p>
                                                <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest font-mono">PDF, IMAGE · MAX 5MB</p>
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
                                        <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Entry Committed</h3>
                                        <p className="text-slate-500 max-w-sm mb-10 text-lg leading-relaxed font-medium">
                                            Transmission successful. Journal entry synchronization is complete within the General Ledger.
                                        </p>
                                        <Button onClick={handleClose} className="h-14 px-12 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] outline-none">
                                            Conclude Session
                                        </Button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        {step === 'edit' && (
                            <div className="p-8 border-t border-white/5 bg-white/2 flex items-center justify-between">
                                <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] hidden sm:block">
                                    Ledger State: ASYNCHRONOUS
                                </div>
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <button
                                        onClick={handleClose}
                                        className="flex-1 sm:flex-none px-8 py-3.5 text-slate-400 hover:text-white font-black text-[10px] uppercase tracking-widest transition-all"
                                    >
                                        Abort
                                    </button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleSave}
                                        disabled={isSubmitting || !selectedExpenseAccount || !selectedAssetAccount}
                                        className="flex-1 sm:flex-none bg-red-600 hover:bg-red-500 text-white px-10 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-red-600/20 disabled:opacity-50 disabled:grayscale"
                                    >
                                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 stroke-[2.5px]" />}
                                        Commit Protocol
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
