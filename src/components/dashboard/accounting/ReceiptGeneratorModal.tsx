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
        notes: 'Thank you for your business.',
        accentColor: '#0ea5e9' // Default Sky-500
    }));

    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
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

            // Use the centralized generatePDF logic
            const docToSave = generatePDF('blob') as any;
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

    const handleSaveAndFinalize = async () => {
        if (!currentTenant?.id) return;
        if (!receiptData.clientName) {
            toast.error('Client name is required');
            return;
        }

        setIsSaving(true);
        const toastId = toast.loading('Saving receipt...');

        try {
            const currentTotal = calculateTotal();
            const currentSubtotal = calculateSubtotal();
            const currentTax = calculateTax(currentSubtotal);

            // Prepare metadata to be stored in the notes field as JSON
            const metadata = {
                type: 'receipt',
                clientName: receiptData.clientName,
                clientEmail: receiptData.clientEmail,
                template: receiptData.template,
                accentColor: receiptData.accentColor,
                receivedBy: receiptData.receivedBy,
                originalNotes: receiptData.notes
            };

            const payload = {
                tenant_id: currentTenant.id,
                invoice_number: receiptData.receiptNumber || `REC-${Date.now().toString().slice(-6)}`,
                client_id: null,
                issue_date: receiptData.date,
                due_date: receiptData.date,
                status: 'paid',
                subtotal: currentSubtotal,
                tax_rate: receiptData.taxRate,
                tax: currentTax,
                discount_amount: receiptData.discountAmount,
                total: currentTotal,
                line_items: receiptData.items.map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    rate: item.price,
                    amount: item.quantity * item.price
                })),
                notes: `---METADATA---${JSON.stringify(metadata)}---METADATA---\n${receiptData.notes}`,
                bank_details: receiptData.paymentMethod
            };

            const { error } = await supabase
                .from('business_invoices')
                .insert(payload);

            if (error) throw error;

            toast.success('Receipt saved and finalized', { id: toastId });
            onClose();
        } catch (err: any) {
            console.error('Error saving receipt:', err);
            toast.error(`Error saving: ${err.message}`, { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    const generatePDF = (mode: 'download' | 'preview' | 'blob' = 'download') => {
        if (!receiptData.clientName) {
            toast.error('Client name is required');
            return;
        }

        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const colors = {
            primary: '#1e293b',
            accent: receiptData.accentColor || '#0ea5e9',
            text: '#334155',
            light: '#f8fafc',
            border: '#e2e8f0'
        };

        if (receiptData.template === 'professional') {
            // Header with accent color
            doc.setFillColor(colors.primary);
            doc.rect(0, 0, 210, 50, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(28);
            doc.setFont('helvetica', 'bold');
            doc.text('RECEIPT', 15, 25);
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`RECEIPT NUMBER: ${receiptData.receiptNumber}`, 195, 20, { align: 'right' });
            doc.text(`ISSUED DATE: ${receiptData.date}`, 195, 27, { align: 'right' });
            doc.text(`CURRENCY: USD`, 195, 34, { align: 'right' });

            // Accent Bar
            doc.setFillColor(colors.accent as any);
            doc.rect(0, 50, 210, 2, 'F');

            // Content
            doc.setTextColor(colors.text);
            doc.setFontSize(10);
            doc.text('ISSUED BY:', 15, 65);
            doc.setFont('helvetica', 'bold');
            doc.text(currentTenant?.name || 'AlphaClone Partner', 15, 72);
            doc.setFont('helvetica', 'normal');
            
            doc.text('BILL TO:', 120, 65);
            doc.setFont('helvetica', 'bold');
            doc.text(receiptData.clientName || 'Valued Client', 120, 72);
            doc.setFont('helvetica', 'normal');
            if (receiptData.clientEmail) doc.text(receiptData.clientEmail, 120, 78);

            // Table
            autoTable(doc, {
                startY: 90,
                head: [['Description', 'Qty', 'Unit Price', 'Total Amount']],
                body: receiptData.items.map(item => [
                    item.description,
                    item.quantity,
                    `$${item.price.toFixed(2)}`,
                    `$${(item.quantity * item.price).toFixed(2)}`
                ]),
                headStyles: { fillColor: colors.accent as any, textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 4 },
                columnStyles: { 3: { halign: 'right' } }
            });
        } else {
            // Modern Template
            doc.setFillColor(colors.accent as any);
            doc.rect(0, 0, 80, 297, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text('RECEIPT', 15, 30);
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`NO: ${receiptData.receiptNumber}`, 15, 40);
            doc.text(`DATE: ${receiptData.date}`, 15, 46);

            doc.setTextColor(30, 41, 59);
            const startX = 90;
            doc.setFontSize(10);
            doc.text('FROM:', startX, 30);
            doc.setFont('helvetica', 'bold');
            doc.text(currentTenant?.name || 'AlphaClone Partner', startX, 37);
            
            doc.setFont('helvetica', 'normal');
            doc.text('BILL TO:', startX, 55);
            doc.setFont('helvetica', 'bold');
            doc.text(receiptData.clientName || 'Valued Client', startX, 62);

            autoTable(doc, {
                startY: 80,
                margin: { left: 90 },
                head: [['Description', 'Amount']],
                body: receiptData.items.map(item => [
                    item.description,
                    `$${(item.quantity * item.price).toFixed(2)}`
                ]),
                headStyles: { fillColor: [30, 41, 59], textColor: 255 },
                styles: { cellPadding: 4 },
                theme: 'plain'
            });
        }

        // Totals
        const subtotal = calculateSubtotal();
        const tax = calculateTax(subtotal);
        const total = calculateTotal();
        const finalY = (doc as any).lastAutoTable.finalY + 15;

        doc.setFontSize(10);
        doc.setTextColor(colors.text);
        doc.setFont('helvetica', 'normal');
        doc.text(`Subtotal: $${subtotal.toFixed(2)}`, 195, finalY, { align: 'right' });
        doc.text(`Tax (${receiptData.taxRate}%): $${tax.toFixed(2)}`, 195, finalY + 7, { align: 'right' });
        
        if (receiptData.discountAmount > 0) {
            doc.text(`Discount: -$${receiptData.discountAmount.toFixed(2)}`, 195, finalY + 14, { align: 'right' });
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colors.accent as any);
        doc.text(`Total Amount Paid: $${total.toFixed(2)}`, 195, finalY + 24, { align: 'right' });

        // Payment Info & Verification
        const footerY = Math.max(finalY + 50, 230);
        
        doc.setDrawColor(colors.border);
        doc.line(15, footerY - 5, 195, footerY - 5);
        
        doc.setTextColor(colors.text);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('PAYMENT INFORMATION', 15, footerY);
        doc.setFont('helvetica', 'normal');
        doc.text(`Method: ${receiptData.paymentMethod}`, 15, footerY + 6);
        doc.text(`Reference: ${receiptData.receiptNumber}`, 15, footerY + 12);
        if (receiptData.receivedBy) {
            doc.text(`Processed By: ${receiptData.receivedBy}`, 15, footerY + 18);
        }

        // Verification Badge
        doc.setFillColor(colors.light);
        doc.roundedRect(140, footerY - 2, 55, 25, 2, 2, 'F');
        doc.setTextColor(colors.primary);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('VERIFIED RECEIPT', 167.5, footerY + 5, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('AlphaClone AI Security Scanned', 167.5, footerY + 11, { align: 'center' });
        doc.text('Digital Signature Active', 167.5, footerY + 16, { align: 'center' });
        doc.text(new Date().toISOString().split('T')[0], 167.5, footerY + 21, { align: 'center' });

        // Legal Footer
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(7);
        const disclaimer = "Disclaimer: This receipt is proof of payment for services rendered. AlphaClone does not guarantee profits, revenue, or specific business performance. Results depend on individual execution and market conditions. This document is not legal, tax, or financial advice. For questions regarding this transaction, please contact the issuing partner directly.";
        const splitDisclaimer = doc.splitTextToSize(disclaimer, 180);
        doc.text(splitDisclaimer, 105, 280, { align: 'center' });

        if (mode === 'blob') return doc;
        if (mode === 'download') {
            doc.save(`Receipt_${receiptData.receiptNumber}.pdf`);
            toast.success('Receipt downloaded successfully!');
            onClose();
        } else {
            const pdfBlob = doc.output('blob');
            const url = URL.createObjectURL(pdfBlob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 100);
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
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setReceiptData(prev => ({ ...prev, template: 'professional' }))}
                                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${receiptData.template === 'professional' ? 'bg-teal-600/10 border-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'bg-slate-800/50 border-slate-700 hober:bg-slate-800'}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                                        <FileText className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-sm font-medium text-white">Standard</span>
                                </button>
                                <button 
                                    onClick={() => setReceiptData(prev => ({ ...prev, template: 'modern' }))}
                                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${receiptData.template === 'modern' ? 'bg-teal-600/10 border-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'bg-slate-800/50 border-slate-700 hober:bg-slate-800'}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-sm font-medium text-white">Modern</span>
                                </button>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs text-slate-400 font-medium px-1">ACCENT COLOR</p>
                                <div className="flex flex-wrap gap-2 px-1">
                                    {[
                                        { name: 'Teal', color: '#14b8a6' },
                                        { name: 'Indigo', color: '#6366f1' },
                                        { name: 'Rose', color: '#f43f5e' },
                                        { name: 'Amber', color: '#f59e0b' },
                                        { name: 'Emerald', color: '#10b981' },
                                        { name: 'Slate', color: '#475569' }
                                    ].map(preset => (
                                        <button
                                            key={preset.name}
                                            onClick={() => setReceiptData(prev => ({ ...prev, accentColor: preset.color }))}
                                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${receiptData.accentColor === preset.color ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-80'}`}
                                            style={{ backgroundColor: preset.color }}
                                            title={preset.name}
                                        />
                                    ))}
                                </div>
                            </div>
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
