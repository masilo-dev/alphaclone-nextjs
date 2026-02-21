'use client';

import React, { useState } from 'react';
import { Button } from '../../ui/UIComponents';
import { X, Download, Eye, FileText } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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

    const [receiptData, setReceiptData] = useState({
        receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        clientName: '',
        clientEmail: '',
        paymentMethod: 'Credit Card',
        receivedBy: '',
        template: 'professional' as 'professional' | 'modern',
        items: [{ description: '', quantity: 1, price: 0 }] as ReceiptItem[],
        notes: 'Thank you for your business.'
    });

    const [isPreviewMode, setIsPreviewMode] = useState(false);

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
        return receiptData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    };

    const calculateTotal = () => {
        return calculateSubtotal(); // Add tax logic here if needed
    };

    const generatePDF = (mode: 'download' | 'preview') => {
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
                doc.text('Subtotal:', 140, finalY + 10);
                doc.text(`$${subtotal.toFixed(2)}`, 170, finalY + 10);

                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('Total Paid:', 140, finalY + 18);
                doc.text(`$${total.toFixed(2)}`, 170, finalY + 18);

                // Notes
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(receiptData.notes, 14, finalY + 40);

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

                // Big Total Area
                doc.setFillColor(241, 245, 249); // slate 100
                doc.rect(130, finalY + 10, 66, 25, 'F');

                doc.setFontSize(11);
                doc.setTextColor(100, 116, 139);
                doc.text('Total Paid', 135, finalY + 18);

                doc.setFontSize(16);
                doc.setTextColor(15, 23, 42);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${total.toFixed(2)}`, 135, finalY + 28);

                // Notes
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(receiptData.notes, 14, finalY + 50);
            }

            if (mode === 'download') {
                doc.save(`Receipt_${receiptData.receiptNumber}.pdf`);
                toast.success('Receipt downloaded successfully!');
                onClose();
            } else {
                // Preview mode (Opens in new tab)
                const pdfDataUri = doc.output('datauristring');
                const win = window.open();
                if (win) {
                    win.document.write(`<iframe width='100%' height='100%' src='${pdfDataUri}'></iframe>`);
                } else {
                    toast.error('Could not open preview. Please allow popups.');
                }
            }
        } catch (error) {
            console.error("PDF Generation error:", error);
            toast.error('Failed to generate receipt');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-4xl shadow-2xl my-8 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/95 backdrop-blur-sm rounded-t-xl shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Generate Receipt</h2>
                            <p className="text-sm text-slate-400">Create and download professional receipts for your clients</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-8 overflow-y-auto grow">
                    {/* General Information */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Receipt Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Receipt Number</label>
                                <input
                                    type="text"
                                    value={receiptData.receiptNumber}
                                    onChange={(e) => setReceiptData({ ...receiptData, receiptNumber: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Date</label>
                                <input
                                    type="date"
                                    value={receiptData.date}
                                    onChange={(e) => setReceiptData({ ...receiptData, date: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Client Information */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Client Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Client Name <span className="text-rose-400">*</span></label>
                                <input
                                    type="text"
                                    value={receiptData.clientName}
                                    onChange={(e) => setReceiptData({ ...receiptData, clientName: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition-colors"
                                    placeholder="Jane Doe or Acme Corp"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Client Email</label>
                                <input
                                    type="email"
                                    value={receiptData.clientEmail}
                                    onChange={(e) => setReceiptData({ ...receiptData, clientEmail: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition-colors"
                                    placeholder="jane@example.com"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Payment Information */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Payment Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Payment Method</label>
                                <select
                                    value={receiptData.paymentMethod}
                                    onChange={(e) => setReceiptData({ ...receiptData, paymentMethod: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition-colors"
                                >
                                    <option value="Credit Card">Credit Card</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Mobile Money">Mobile Money</option>
                                    <option value="Check">Check</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Received By</label>
                                <input
                                    type="text"
                                    value={receiptData.receivedBy}
                                    onChange={(e) => setReceiptData({ ...receiptData, receivedBy: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition-colors"
                                    placeholder="Name of receiver"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Line Items */}
                    <div>
                        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Line Items</h3>
                            <button
                                onClick={handleAddItem}
                                className="text-sm text-teal-400 hover:text-teal-300 font-medium"
                            >
                                + Add Item
                            </button>
                        </div>

                        <div className="space-y-4">
                            {receiptData.items.map((item, index) => (
                                <div key={index} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                                    <div className="flex-1 w-full">
                                        <label className="block text-xs text-slate-500 mb-1">Description</label>
                                        <input
                                            type="text"
                                            value={item.description}
                                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
                                            placeholder="Consulting services..."
                                        />
                                    </div>
                                    <div className="w-full sm:w-24">
                                        <label className="block text-xs text-slate-500 mb-1">Qty</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
                                        />
                                    </div>
                                    <div className="w-full sm:w-32">
                                        <label className="block text-xs text-slate-500 mb-1">Price ($)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.price}
                                            onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
                                        />
                                    </div>
                                    {receiptData.items.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveItem(index)}
                                            className="mt-5 p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-400/10 rounded-lg transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 flex justify-end">
                            <div className="text-right">
                                <p className="text-slate-400 text-sm">Total Amount Received</p>
                                <p className="text-2xl font-bold text-white">${calculateTotal().toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Template Selection & Notes */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Styling & Notes</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Template Style</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div
                                        onClick={() => setReceiptData({ ...receiptData, template: 'professional' })}
                                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${receiptData.template === 'professional' ? 'border-teal-500 bg-teal-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'}`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`font-medium ${receiptData.template === 'professional' ? 'text-teal-400' : 'text-slate-300'}`}>Professional</span>
                                            {receiptData.template === 'professional' && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                                        </div>
                                        <div className="w-full h-16 bg-slate-700/30 rounded-lg flex flex-col gap-1 p-2">
                                            <div className="w-1/2 h-2 bg-slate-600 rounded"></div>
                                            <div className="w-2/3 h-2 bg-slate-600 rounded"></div>
                                            <div className="mt-2 w-full h-8 bg-slate-600/50 rounded"></div>
                                        </div>
                                    </div>

                                    <div
                                        onClick={() => setReceiptData({ ...receiptData, template: 'modern' })}
                                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${receiptData.template === 'modern' ? 'border-teal-500 bg-teal-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'}`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`font-medium ${receiptData.template === 'modern' ? 'text-teal-400' : 'text-slate-300'}`}>Modern</span>
                                            {receiptData.template === 'modern' && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                                        </div>
                                        <div className="w-full h-16 bg-slate-700/30 rounded-lg flex flex-col p-0 overflow-hidden">
                                            <div className="w-full h-4 bg-slate-600 mb-1"></div>
                                            <div className="px-2 w-1/2 h-2 bg-slate-600/50 rounded my-1"></div>
                                            <div className="px-2 mt-auto self-end w-1/3 h-4 bg-slate-500/50 rounded-tl"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Notes / Footer</label>
                                <textarea
                                    value={receiptData.notes}
                                    onChange={(e) => setReceiptData({ ...receiptData, notes: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition-colors h-28 resize-none"
                                />
                            </div>
                        </div>
                    </div>

                </div>

                <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/95 rounded-b-xl shrink-0">
                    <Button variant="outline" onClick={onClose} className="border-slate-700 hover:bg-slate-800 text-white">
                        Cancel
                    </Button>
                    <Button
                        onClick={() => generatePDF('preview')}
                        className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                        disabled={!receiptData.clientName}
                    >
                        <Eye className="w-4 h-4 mr-2" />
                        Preview PDF
                    </Button>
                    <Button
                        onClick={() => generatePDF('download')}
                        className="bg-teal-500 hover:bg-teal-600 text-white border-0"
                        disabled={!receiptData.clientName}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download Receipt
                    </Button>
                </div>
            </div>
        </div>
    );
}
