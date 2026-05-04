'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button, Modal, Input, Card } from '../../ui/UIComponents';
import { 
    X, Download, Eye, FileText, Printer, Share2, Search, List, Plus, 
    Sparkles, Trash2, Mail, User, CreditCard, Save, ChevronDown 
} from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { googleDriveService } from '../../../services/googleDriveService';
import { supabase } from '../../../lib/supabase';
import { businessClientService, BusinessClient } from '../../../services/businessClientService';
import toast from 'react-hot-toast';
import { useBreakpoint } from '@/hooks/useBreakpoint';

interface ReceiptItem {
    description: string;
    quantity: number;
    price: number;
}

interface ReceiptGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ReceiptGeneratorModal({ isOpen, onClose }: ReceiptGeneratorModalProps) {
    const { currentTenant } = useTenant();
    const { isMobile } = useBreakpoint();

    const [receiptData, setReceiptData] = useState({
        receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        clientName: '',
        clientEmail: '',
        paymentMethod: 'Credit Card',
        receivedBy: '',
        template: 'professional' as 'professional' | 'modern',
        items: [{ description: '', quantity: 1, price: 0 }] as ReceiptItem[],
        discountAmount: 0,
        taxRate: 0,
        notes: 'Thank you for your business.',
        accentColor: '#14b8a6'
    });

    const [isSaving, setIsSaving] = useState(false);
    const [clients, setClients] = useState<BusinessClient[]>([]);
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        businessClientService.getClients(currentTenant?.id || '').then(({ clients }) => {
            if (clients) setClients(clients);
        });
    }, [isOpen, currentTenant?.id]);

    const handleAddItem = () => setReceiptData(p => ({ ...p, items: [...p.items, { description: '', quantity: 1, price: 0 }] }));
    const handleRemoveItem = (i: number) => setReceiptData(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
    const handleItemChange = (i: number, f: keyof ReceiptItem, v: any) => {
        const next = [...receiptData.items];
        next[i] = { ...next[i], [f]: v };
        setReceiptData(p => ({ ...p, items: next }));
    };

    const calculateSubtotal = () => receiptData.items.reduce((s, item) => s + (item.quantity * item.price), 0);
    const calculateTotal = () => {
        const sub = calculateSubtotal();
        const tax = (sub - receiptData.discountAmount) * (receiptData.taxRate / 100);
        return sub - receiptData.discountAmount + tax;
    };

    const generatePDF = () => {
        const doc = new jsPDF();
        doc.text('RECEIPT', 105, 20, { align: 'center' });
        doc.text(`No: ${receiptData.receiptNumber}`, 20, 30);
        doc.save(`Receipt_${receiptData.receiptNumber}.pdf`);
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Receipt Generator" maxWidth="max-w-4xl">
            <div className={`space-y-8 ${isMobile ? 'pb-24' : ''}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Receipt #" value={receiptData.receiptNumber} onChange={e => setReceiptData({...receiptData, receiptNumber: e.target.value})} />
                    <Input label="Date" type="date" value={receiptData.date} onChange={e => setReceiptData({...receiptData, date: e.target.value})} />
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <User className="w-4 h-4 text-teal-500" />
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Client</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Name" value={receiptData.clientName} onChange={e => setReceiptData({...receiptData, clientName: e.target.value})} />
                        <Input label="Email" value={receiptData.clientEmail} onChange={e => setReceiptData({...receiptData, clientEmail: e.target.value})} />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Items</h3>
                        <button onClick={handleAddItem} className="text-teal-500 text-[10px] font-black uppercase flex items-center gap-1"><Plus size={14} /> Add</button>
                    </div>
                    <div className="space-y-3">
                        {receiptData.items.map((item, i) => (
                            <div key={i} className="bg-slate-900/40 p-4 rounded-2xl border border-white/5 space-y-3">
                                <input placeholder="Description" value={item.description} onChange={e => handleItemChange(i, 'description', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white" />
                                <div className="flex gap-3">
                                    <input type="number" placeholder="Qty" value={item.quantity} onChange={e => handleItemChange(i, 'quantity', parseInt(e.target.value) || 1)} className="w-20 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-center text-white" />
                                    <input type="number" placeholder="Price" value={item.price} onChange={e => handleItemChange(i, 'price', parseFloat(e.target.value) || 0)} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white" />
                                    {receiptData.items.length > 1 && <button onClick={() => handleRemoveItem(i)} className="p-3 text-rose-500"><Trash2 size={18} /></button>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 bg-teal-600/5 border border-teal-500/20 rounded-3xl flex flex-col items-end gap-2">
                    <div className="flex justify-between w-full text-[10px] font-black text-gray-500 uppercase"><span>Subtotal</span><span>${calculateSubtotal().toLocaleString()}</span></div>
                    <div className="text-4xl font-black text-white tracking-tighter">${calculateTotal().toLocaleString()}</div>
                    <p className="text-[10px] font-black text-teal-500 uppercase tracking-widest">Amount Paid</p>
                </div>

                {/* Footer Actions */}
                <div className={`flex flex-wrap gap-3 pt-6 border-t border-white/5 ${isMobile ? 'fixed bottom-0 left-0 right-0 p-4 bg-black/90 backdrop-blur-xl z-50 border-white/10' : ''}`}>
                    {isMobile ? (
                        <button onClick={generatePDF} className="w-full h-14 bg-teal-600 text-white rounded-2xl font-black uppercase text-sm shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2"><Download size={20} /> Download Receipt</button>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                            <div className="flex-1" />
                            <Button variant="secondary" onClick={generatePDF} icon={<Download size={18} />}>Download</Button>
                            <Button onClick={() => toast.success('Saved')} icon={<Save size={18} />}>Finalize</Button>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
}
