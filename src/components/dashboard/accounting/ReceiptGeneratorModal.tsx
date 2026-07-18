'use client';

import React, { useState, useEffect } from 'react';
import { Button, Modal, Input } from '../../ui/UIComponents';
import { Download, Plus, Trash2, User, Save } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { businessClientService, BusinessClient } from '../../../services/businessClientService';
import { receiptService } from '../../../services/accounting/receiptService';
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
        accentColor: '#34d399'
    });

    const [isSaving, setIsSaving] = useState(false);
    const [clients, setClients] = useState<BusinessClient[]>([]);

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
        doc.setFillColor(receiptData.accentColor);
        doc.rect(0, 0, 210, 38, 'F');
        doc.setTextColor('#ffffff');
        doc.setFontSize(24);
        doc.text('PAYMENT RECEIPT', 20, 23);
        doc.setFontSize(10);
        doc.text(receiptData.receiptNumber, 190, 18, { align: 'right' });
        doc.text(receiptData.date, 190, 25, { align: 'right' });
        doc.setTextColor('#111827');
        doc.setFontSize(11);
        doc.text(`Received from: ${receiptData.clientName}`, 20, 52);
        if (receiptData.clientEmail) doc.text(`Email: ${receiptData.clientEmail}`, 20, 59);
        doc.text(`Payment method: ${receiptData.paymentMethod}`, 20, 66);
        autoTable(doc, {
            startY: 76,
            head: [['Description', 'Quantity', 'Price', 'Amount']],
            body: receiptData.items.map((item) => [item.description, item.quantity, `$${item.price.toFixed(2)}`, `$${(item.quantity * item.price).toFixed(2)}`]),
            theme: 'grid',
            headStyles: { fillColor: receiptData.accentColor },
        });
        const endY = (doc as any).lastAutoTable?.finalY || 100;
        doc.text(`Subtotal: $${calculateSubtotal().toFixed(2)}`, 190, endY + 12, { align: 'right' });
        if (receiptData.discountAmount) doc.text(`Discount: -$${receiptData.discountAmount.toFixed(2)}`, 190, endY + 19, { align: 'right' });
        doc.text(`Tax: ${receiptData.taxRate.toFixed(2)}%`, 190, endY + 26, { align: 'right' });
        doc.setFontSize(15);
        doc.text(`Total paid: $${calculateTotal().toFixed(2)}`, 190, endY + 36, { align: 'right' });
        doc.setFontSize(10);
        if (receiptData.notes) doc.text(doc.splitTextToSize(receiptData.notes, 170), 20, endY + 50);
        doc.save(`Receipt_${receiptData.receiptNumber}.pdf`);
    };

    const finalizeReceipt = async () => {
        if (!currentTenant?.id) return toast.error('Select a workspace before finalizing a receipt');
        if (!receiptData.clientName.trim()) return toast.error('Client name is required');
        if (receiptData.items.some((item) => !item.description.trim() || item.quantity <= 0 || item.price < 0)) return toast.error('Complete every receipt item');
        const total = calculateTotal();
        if (total <= 0) return toast.error('Receipt total must be greater than zero');
        setIsSaving(true);
        const { receipt, error } = await receiptService.createSalesReceipt({
            receiptNumber: receiptData.receiptNumber,
            receiptDate: receiptData.date,
            clientName: receiptData.clientName,
            clientEmail: receiptData.clientEmail || undefined,
            paymentMethod: receiptData.paymentMethod,
            items: receiptData.items.map((item) => ({ description: item.description, quantity: item.quantity, unitPrice: item.price })),
            discountAmount: receiptData.discountAmount,
            taxRate: receiptData.taxRate,
            notes: receiptData.notes,
            receivedBy: receiptData.receivedBy,
        });
        setIsSaving(false);
        if (error || !receipt) return toast.error(error || 'Receipt could not be finalized');
        generatePDF();
        setReceiptData((current) => ({ ...current, receiptNumber: `REC-${Date.now().toString(36).toUpperCase()}`, items: [{ description: '', quantity: 1, price: 0 }] }));
        toast.success('Sales receipt finalized, posted to the ledger, and downloaded');
        onClose();
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
                        <User className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Client</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Input label="Name" list="receipt-client-options" value={receiptData.clientName} onChange={e => {
                                const client = clients.find((item) => item.name === e.target.value);
                                setReceiptData({ ...receiptData, clientName: e.target.value, clientEmail: client?.email || receiptData.clientEmail });
                            }} />
                            <datalist id="receipt-client-options">{clients.map((client) => <option key={client.id} value={client.name}>{client.email || ''}</option>)}</datalist>
                        </div>
                        <Input label="Email" value={receiptData.clientEmail} onChange={e => setReceiptData({...receiptData, clientEmail: e.target.value})} />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Items</h3>
                        <button onClick={handleAddItem} className="text-emerald-400 text-xs font-black uppercase flex items-center gap-1"><Plus size={14} /> Add</button>
                    </div>
                    <div className="space-y-3">
                        {receiptData.items.map((item, i) => (
                            <div key={i} className="dashboard-panel-soft p-4 space-y-3">
                                <input placeholder="Description" value={item.description} onChange={e => handleItemChange(i, 'description', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white" />
                                <div className="flex gap-3">
                                    <input type="number" placeholder="Qty" value={item.quantity} onChange={e => handleItemChange(i, 'quantity', parseInt(e.target.value) || 1)} className="w-20 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-center text-white" />
                                    <input type="number" placeholder="Price" value={item.price} onChange={e => handleItemChange(i, 'price', parseFloat(e.target.value) || 0)} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white" />
                                    {receiptData.items.length > 1 && <button onClick={() => handleRemoveItem(i)} className="p-3 text-rose-400"><Trash2 size={18} /></button>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex flex-col items-end gap-2">
                    <div className="flex justify-between w-full text-xs font-black text-slate-300 uppercase"><span>Subtotal</span><span>${calculateSubtotal().toLocaleString()}</span></div>
                    <div className="text-4xl font-black text-white tracking-tighter">${calculateTotal().toLocaleString()}</div>
                    <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">Amount Paid</p>
                </div>

                {/* Footer Actions */}
                <div className={`flex flex-wrap gap-3 pt-6 border-t border-white/5 ${isMobile ? 'fixed bottom-0 left-0 right-0 p-4 bg-black/90 backdrop-blur-xl z-50 border-white/10' : ''}`}>
                    {isMobile ? (
                        <button onClick={finalizeReceipt} disabled={isSaving} className="w-full h-14 bg-emerald-600 disabled:opacity-60 text-white rounded-2xl font-black uppercase text-sm shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"><Save size={20} /> {isSaving ? 'Finalizing…' : 'Finalize & Download'}</button>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                            <div className="flex-1" />
                            <Button variant="secondary" onClick={generatePDF} icon={<Download size={18} />}>Download</Button>
                            <Button onClick={finalizeReceipt} isLoading={isSaving} disabled={isSaving} icon={<Save size={18} />}>Finalize</Button>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
}
