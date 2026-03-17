'use client';

import React, { useState } from 'react';
import { Button, Modal, Input } from '../../ui/UIComponents';
import { X, Download, Eye, FileText, Printer, Share2, Search, List, Plus, Sparkles, Trash2, Mail, User, CreditCard } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { googleDriveService } from '../../../services/googleDriveService';
import { supabase } from '../../../lib/supabase';
import { businessClientService, BusinessClient } from '../../../services/businessClientService';
import toast from 'react-hot-toast';

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

    const [receiptData, setReceiptData] = useState(() => ({
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
        notes: 'Thank you for your business.'
    }));

    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [isSavingToDrive, setIsSavingToDrive] = useState(false);
    const [clients, setClients] = useState<BusinessClient[]>([]);
    const [myServices, setMyServices] = useState<Record<string, any>>({});
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowContactDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    React.useEffect(() => {
        const fetchDropdownData = async () => {
            const tenantId = currentTenant?.id;
            if (!tenantId || !isOpen) return;

            try {
                const [clientsRes, settingsRes] = await Promise.all([
                    businessClientService.getClients(tenantId),
                    supabase
                        .from('business_settings')
                        .select('settings')
                        .eq('tenant_id', tenantId)
                        .maybeSingle()
                ]);

                if (clientsRes.clients) {
                    setClients(clientsRes.clients);
                }

                if (settingsRes.data?.settings?.my_services) {
                    setMyServices(settingsRes.data.settings.my_services);
                }
            } catch (err) {
                console.error('Error fetching dropdown data:', err);
            }
        };

        fetchDropdownData();
    }, [currentTenant?.id, isOpen]);

    if (!isOpen) return null;

    const handleAddItem = () => {
        setReceiptData(prev => ({
            ...prev,
            items: [...prev.items, { description: '', quantity: 1, price: 0 }]
        }));
    };

    const handleRemoveItem = (index: number) => {
        setReceiptData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index: number, field: keyof ReceiptItem, value: any) => {
        const newItems = [...receiptData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setReceiptData(prev => ({ ...prev, items: newItems }));
    };

    const calculateSubtotal = () => {
        return Math.round(receiptData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0) * 100) / 100;
    };

    const calculateTax = (subtotal: number) => {
        const taxableAmount = Math.max(0, subtotal - receiptData.discountAmount);
        return Math.round((taxableAmount * (receiptData.taxRate / 100)) * 100) / 100;
    };

    const calculateTotal = () => {
        const subtotal = calculateSubtotal();
        const tax = calculateTax(subtotal);
        return Math.round((subtotal - receiptData.discountAmount + tax) * 100) / 100;
    };

    const handleSaveToDrive = async () => {
        if (!receiptData.clientName) {
            toast.error('Client name is required');
            return;
        }

        setIsSavingToDrive(true);
        const toastId = toast.loading('Exporting to Google Drive...');

        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) throw new Error('Not authenticated');

            const doc = new jsPDF();
            // We need to re-generate the PDF content for the blob
            // Using the same logic as in generatePDF
            // For brevity, I'll extract a helper or just re-run the professional template logic here
            // since that's the default and most professional.

            // To be DRY, let's just use the generatePDF logic but return the doc instead of saving
            const docToSave = generatePDF('blob') as jsPDF;
            if (!docToSave) throw new Error('Failed to generate document');

            const pdfBlob = docToSave.output('blob');
            await googleDriveService.uploadFile(
                authUser.id,
                pdfBlob,
                `Receipt_${receiptData.receiptNumber}.pdf`
            );

            toast.success('Successfully saved to Google Drive!', { id: toastId });
        } catch (err: any) {
            console.error('Google Drive Export Error:', err);
            toast.error(err.message || 'Failed to save to Google Drive', { id: toastId });
        } finally {
            setIsSavingToDrive(false);
        }
    };

    const generatePDF = (mode: 'download' | 'preview' | 'blob') => {
        if (!receiptData.clientName) {
            toast.error('Client name is required');
            return;
        }

        try {
            const doc = new jsPDF();
            const total = calculateTotal();
            const subtotal = calculateSubtotal();

            if (receiptData.template === 'professional') {
                // Template 1: Professional / Standard
                // Header
                doc.setFontSize(22);
                doc.setTextColor(30, 41, 59); // Slate 800
                doc.text('RECEIPT', 14, 22);

                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139); // Slate 500
                doc.text(`Receipt #: ${receiptData.receiptNumber}`, 14, 30);
                doc.text(`Date: ${receiptData.date}`, 14, 35);

                // Business Info (Top Right)
                doc.setFontSize(12);
                doc.setTextColor(30, 41, 59);
                doc.text(currentTenant?.name || 'Your Company', 140, 22);
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                if (currentTenant?.domain) {
                    doc.text(currentTenant.domain, 140, 30);
                }

                // Client Info
                doc.setFontSize(11);
                doc.setTextColor(30, 41, 59);
                doc.text('Bill To:', 14, 50);
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(receiptData.clientName, 14, 56);
                if (receiptData.clientEmail) {
                    doc.text(receiptData.clientEmail, 14, 62);
                }

                // Payment Details
                doc.setFontSize(11);
                doc.setTextColor(30, 41, 59);
                doc.text('Payment Details:', 140, 50);
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(`Method: ${receiptData.paymentMethod}`, 140, 56);
                if (receiptData.receivedBy) {
                    doc.text(`Received By: ${receiptData.receivedBy}`, 140, 62);
                }

                // Items Table
                autoTable(doc, {
                    startY: 75,
                    head: [['Description', 'Qty', 'Price', 'Total']],
                    body: receiptData.items.map(item => [
                        item.description,
                        item.quantity.toString(),
                        `$${item.price.toFixed(2)}`,
                        `$${(item.quantity * item.price).toFixed(2)}`
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
                    styles: { fontSize: 10, textColor: [51, 65, 85] },
                });

                // Totals
                const finalY = (doc as any).lastAutoTable.finalY || 100;
                doc.setFontSize(10);
                doc.setTextColor(30, 41, 59); // Slate 800
                doc.text('Subtotal:', 140, finalY + 10);
                doc.text(`$${subtotal.toFixed(2)}`, 170, finalY + 10, { align: 'right' });

                if (receiptData.discountAmount > 0) {
                    doc.text('Discount:', 140, finalY + 16);
                    doc.text(`-$${receiptData.discountAmount.toFixed(2)}`, 170, finalY + 16, { align: 'right' });
                }

                if (receiptData.taxRate > 0) {
                    const taxLineY = receiptData.discountAmount > 0 ? 22 : 16;
                    doc.text(`Tax (${receiptData.taxRate}%):`, 140, finalY + taxLineY);
                    doc.text(`$${calculateTax(subtotal).toFixed(2)}`, 170, finalY + taxLineY, { align: 'right' });
                }

                const totalLineY = (receiptData.discountAmount > 0 ? 6 : 0) + (receiptData.taxRate > 0 ? 6 : 0) + 20;
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text('Total Paid:', 140, finalY + totalLineY);
                doc.text(`$${total.toFixed(2)}`, 170, finalY + totalLineY, { align: 'right' });

                // Notes
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(receiptData.notes, 14, finalY + totalLineY + 15);

            } else {
                // Template 2: Modern / Minimalist
                // Header Accent Component
                doc.setFillColor(15, 23, 42); // slate 900
                doc.rect(0, 0, 210, 40, 'F');

                doc.setFontSize(24);
                doc.setTextColor(255, 255, 255);
                doc.text('RECEIPT', 14, 25);

                doc.setFontSize(12);
                doc.text(currentTenant?.name || 'Your Company', 140, 25);

                // Receipt Details
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139); // slate 500
                doc.text('RECEIPT NUMBER', 14, 55);
                doc.text('DATE PAID', 70, 55);

                doc.setFontSize(11);
                doc.setTextColor(15, 23, 42); // slate 900
                doc.text(receiptData.receiptNumber, 14, 62);
                doc.text(receiptData.date, 70, 62);

                // Client Info
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text('ISSUED TO', 140, 55);

                doc.setFontSize(11);
                doc.setTextColor(15, 23, 42);
                doc.text(receiptData.clientName, 140, 62);
                if (receiptData.clientEmail) {
                    doc.setFontSize(10);
                    doc.setTextColor(100, 116, 139);
                    doc.text(receiptData.clientEmail, 140, 68);
                }

                // Payment Details
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text('PAYMENT METHOD', 14, 76);
                doc.text('RECEIVED BY', 70, 76);

                doc.setFontSize(11);
                doc.setTextColor(15, 23, 42);
                doc.text(receiptData.paymentMethod || 'N/A', 14, 83);
                doc.text(receiptData.receivedBy || 'N/A', 70, 83);

                autoTable(doc, {
                    startY: 95,
                    head: [['Description', 'Qty', 'Price', 'Total']],
                    body: receiptData.items.map(item => [
                        item.description,
                        item.quantity.toString(),
                        `$${item.price.toFixed(2)}`,
                        `$${(item.quantity * item.price).toFixed(2)}`
                    ]),
                    theme: 'plain',
                    headStyles: { textColor: [100, 116, 139], fontStyle: 'normal' },
                    styles: { fontSize: 10, textColor: [15, 23, 42] },
                    alternateRowStyles: { fillColor: [248, 250, 252] } // slate 50 / very light
                });

                const finalY = (doc as any).lastAutoTable.finalY || 100;

                // Totals
                const totalsY = finalY + 10;
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text('Subtotal:', 140, totalsY);
                doc.text(`$${subtotal.toFixed(2)}`, 196, totalsY, { align: 'right' });

                let currentTotalY = totalsY + 6;
                if (receiptData.discountAmount > 0) {
                    doc.text('Discount:', 140, currentTotalY);
                    doc.text(`-$${receiptData.discountAmount.toFixed(2)}`, 196, currentTotalY, { align: 'right' });
                    currentTotalY += 6;
                }

                if (receiptData.taxRate > 0) {
                    doc.text(`Tax (${receiptData.taxRate}%):`, 140, currentTotalY);
                    doc.text(`$${calculateTax(subtotal).toFixed(2)}`, 196, currentTotalY, { align: 'right' });
                    currentTotalY += 6;
                }

                // Big Total Area
                doc.setFillColor(241, 245, 249); // slate 100
                doc.rect(130, currentTotalY + 4, 66, 25, 'F');

                doc.setFontSize(11);
                doc.setTextColor(100, 116, 139);
                doc.text('Total Paid', 135, currentTotalY + 12);

                doc.setFontSize(16);
                doc.setTextColor(15, 23, 42);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${total.toFixed(2)}`, 135, currentTotalY + 22);

                // Notes
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(receiptData.notes, 14, currentTotalY + 40);
            }

            if (mode === 'download') {
                doc.save(`Receipt_${receiptData.receiptNumber}.pdf`);
                toast.success('Receipt downloaded successfully!');
                onClose();
            } else if (mode === 'preview') {
                // Preview mode (Opens in new tab)
                const pdfDataUri = doc.output('datauristring');
                const win = window.open();
                if (win) {
                    win.document.write(`<iframe width='100%' height='100%' src='${pdfDataUri}'></iframe>`);
                } else {
                    toast.error('Could not open preview. Please allow popups.');
                }
            } else if (mode === 'blob') {
                return doc;
            }
        } catch (error) {
            console.error("PDF Generation error:", error);
            toast.error('Failed to generate receipt');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Generate Professional Receipt"
            maxWidth="max-w-4xl"
        >
            <div className="space-y-8">
                {/* Receipt Details */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                        <FileText className="w-4 h-4 text-teal-400" />
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Receipt Metadata</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Receipt Number"
                            value={receiptData.receiptNumber}
                            onChange={(e) => setReceiptData({ ...receiptData, receiptNumber: e.target.value })}
                        />
                        <Input
                            label="Date"
                            type="date"
                            value={receiptData.date}
                            onChange={(e) => setReceiptData({ ...receiptData, date: e.target.value })}
                        />
                    </div>
                </div>

                {/* Client Information */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                        <User className="w-4 h-4 text-teal-400" />
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Client Credentials</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative" ref={dropdownRef}>
                            <Input
                                label="Client Name *"
                                value={receiptData.clientName}
                                onChange={(e) => {
                                    setReceiptData({ ...receiptData, clientName: e.target.value });
                                    setContactSearch(e.target.value);
                                    setShowContactDropdown(true);
                                }}
                                onFocus={() => setShowContactDropdown(true)}
                                placeholder="Jane Doe or Acme Corp"
                            />
                            {showContactDropdown && (clients.length > 0) && (
                                <div className="absolute z-[120] w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar backdrop-blur-md">
                                    {clients
                                        .filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                                            (c.email && c.email.toLowerCase().includes(contactSearch.toLowerCase())))
                                        .map(client => (
                                            <div
                                                key={client.id}
                                                onClick={() => {
                                                    setReceiptData({
                                                        ...receiptData,
                                                        clientName: client.name,
                                                        clientEmail: client.email || ''
                                                    });
                                                    setShowContactDropdown(false);
                                                }}
                                                className="px-4 py-3 hover:bg-teal-500/10 cursor-pointer border-b border-slate-800 last:border-0 transition-colors group"
                                            >
                                                <div className="text-sm font-medium text-white group-hover:text-teal-400 transition-colors">{client.name}</div>
                                                {client.email && <div className="text-xs text-slate-500">{client.email}</div>}
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                        <Input
                            label="Client Email"
                            type="email"
                            icon={<Mail className="w-4 h-4" />}
                            value={receiptData.clientEmail}
                            onChange={(e) => setReceiptData({ ...receiptData, clientEmail: e.target.value })}
                            placeholder="jane@example.com"
                        />
                    </div>
                </div>

                {/* Payment Information */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                        <CreditCard className="w-4 h-4 text-teal-400" />
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Transaction Logistics</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Payment Method</label>
                            <select
                                value={receiptData.paymentMethod}
                                onChange={(e) => setReceiptData({ ...receiptData, paymentMethod: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all cursor-pointer"
                            >
                                <option value="Credit Card">Credit Card</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Cash">Cash</option>
                                <option value="Mobile Money">Mobile Money</option>
                                <option value="Check">Check</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <Input
                            label="Received By"
                            value={receiptData.receivedBy}
                            onChange={(e) => setReceiptData({ ...receiptData, receivedBy: e.target.value })}
                            placeholder="Name of receiver"
                        />
                    </div>
                </div>

                {/* Line Items */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Inventory Entries</h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleAddItem}
                            icon={<Plus className="w-4 h-4" />}
                            className="text-teal-400 hover:text-teal-300"
                        >
                            Add Item
                        </Button>
                    </div>

                    {/* Quick Add Services */}
                    {Object.keys(myServices).length > 0 && (
                        <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-2xl">
                            <label className="block text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Sparkles className="w-3 h-3" />
                                Protocol Fast-Sync
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(myServices).map(([id, service]: [string, any]) => (
                                    <button
                                        key={id}
                                        onClick={() => {
                                            const emptyIdx = receiptData.items.findIndex(item => !item.description);
                                            if (emptyIdx !== -1) {
                                                handleItemChange(emptyIdx, 'description', service.name);
                                                handleItemChange(emptyIdx, 'price', service.defaultPrice || 0);
                                            } else {
                                                setReceiptData(prev => ({
                                                    ...prev,
                                                    items: [...prev.items, {
                                                        description: service.name,
                                                        quantity: 1,
                                                        price: service.defaultPrice || 0
                                                    }]
                                                }));
                                            }
                                            toast.success(`Added ${service.name}`);
                                        }}
                                        className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-teal-500 hover:bg-teal-500/10 rounded-xl text-xs text-slate-300 transition-all flex items-center gap-2 group"
                                    >
                                        <Plus className="w-3 h-3 text-teal-500 group-hover:scale-110 transition-transform" />
                                        {service.name}
                                        <span className="text-slate-500 ml-1 font-mono">${service.defaultPrice}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {receiptData.items.map((item, index) => (
                            <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800 transition-all hover:border-slate-700">
                                <div className="flex-1 w-full">
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                                        placeholder="Service or Product description..."
                                    />
                                </div>
                                <div className="flex gap-3 w-full sm:w-auto">
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                                        className="w-20 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-center text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                                        placeholder="Qty"
                                    />
                                    <div className="relative w-32">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-sm">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.price}
                                            onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-7 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all font-mono"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    {receiptData.items.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveItem(index)}
                                            className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-end bg-slate-900/40 p-6 rounded-2xl border border-slate-800/50">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Discount ($)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={receiptData.discountAmount}
                                    onChange={(e) => setReceiptData({ ...receiptData, discountAmount: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all font-mono"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Tax Rate (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={receiptData.taxRate}
                                    onChange={(e) => setReceiptData({ ...receiptData, taxRate: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all font-mono"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5 text-right">
                            <div className="flex justify-end gap-10 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <span>Subtotal</span>
                                <span className="font-mono text-slate-300">${calculateSubtotal().toFixed(2)}</span>
                            </div>
                            {receiptData.discountAmount > 0 && (
                                <div className="flex justify-end gap-10 text-rose-500/70 text-xs font-bold uppercase tracking-wider">
                                    <span>Discount</span>
                                    <span className="font-mono">-${receiptData.discountAmount.toFixed(2)}</span>
                                </div>
                            )}
                            {receiptData.taxRate > 0 && (
                                <div className="flex justify-end gap-10 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                    <span>Tax ({receiptData.taxRate}%)</span>
                                    <span className="font-mono text-slate-300">${calculateTax(calculateSubtotal()).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="pt-3 border-t border-slate-800/50">
                                <p className="text-[10px] font-black text-teal-400 uppercase tracking-[0.2em] mb-1">Total Payload Value</p>
                                <p className="text-4xl font-black text-white tracking-tighter italic">${calculateTotal().toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Styling & Notes */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                        <Sparkles className="w-4 h-4 text-teal-400" />
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Interface & Annotation</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setReceiptData({ ...receiptData, template: 'professional' })}
                                className={`group p-4 rounded-2xl border-2 transition-all flex flex-col gap-3 ${receiptData.template === 'professional' ? 'border-teal-500 bg-teal-500/5' : 'border-slate-800 hover:border-slate-700 bg-slate-900/50'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={`text-xs font-bold uppercase tracking-widest ${receiptData.template === 'professional' ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'}`}>Standard</span>
                                    <div className={`w-2 h-2 rounded-full transition-all ${receiptData.template === 'professional' ? 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]' : 'bg-slate-800'}`} />
                                </div>
                                <div className="space-y-1">
                                    <div className="h-1.5 w-full bg-slate-800 rounded opacity-40"></div>
                                    <div className="h-1.5 w-2/3 bg-slate-800 rounded opacity-40"></div>
                                    <div className="h-6 w-full bg-slate-800 rounded-md mt-2 opacity-20"></div>
                                </div>
                            </button>

                            <button
                                onClick={() => setReceiptData({ ...receiptData, template: 'modern' })}
                                className={`group p-4 rounded-2xl border-2 transition-all flex flex-col gap-3 ${receiptData.template === 'modern' ? 'border-teal-500 bg-teal-500/5' : 'border-slate-800 hover:border-slate-700 bg-slate-900/50'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={`text-xs font-bold uppercase tracking-widest ${receiptData.template === 'modern' ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'}`}>Modern</span>
                                    <div className={`w-2 h-2 rounded-full transition-all ${receiptData.template === 'modern' ? 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]' : 'bg-slate-800'}`} />
                                </div>
                                <div className="space-y-1">
                                    <div className="h-4 w-full bg-teal-500/10 rounded-sm"></div>
                                    <div className="h-1.5 w-1/2 bg-slate-800 rounded opacity-40"></div>
                                    <div className="h-4 w-1/3 bg-slate-800 rounded-sm ml-auto opacity-20"></div>
                                </div>
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Annotation / Footer</label>
                            <textarea
                                value={receiptData.notes}
                                onChange={(e) => setReceiptData({ ...receiptData, notes: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all h-[110px] resize-none placeholder-slate-800"
                                placeholder="Synaptic notes for the client..."
                            />
                        </div>
                    </div>
                </div>

                {/* Final Actions */}
                <div className="flex flex-wrap gap-3 pt-6 border-t border-slate-800/50">
                    <Button variant="ghost" onClick={onClose}>
                        Abort
                    </Button>
                    <div className="flex-1" />
                    <Button
                        variant="ghost"
                        onClick={() => window.print()}
                        icon={<Printer className="w-4 h-4" />}
                    >
                        Print
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => generatePDF('preview')}
                        disabled={!receiptData.clientName}
                        icon={<Eye className="w-4 h-4" />}
                    >
                        Review
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={handleSaveToDrive}
                        disabled={isSavingToDrive || !receiptData.clientName}
                        isLoading={isSavingToDrive}
                        icon={<Share2 className="w-4 h-4" />}
                    >
                        Archival Drive
                    </Button>
                    <Button
                        onClick={() => generatePDF('download')}
                        disabled={!receiptData.clientName}
                        icon={<Download className="w-4 h-4" />}
                    >
                        Hard Copy
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
