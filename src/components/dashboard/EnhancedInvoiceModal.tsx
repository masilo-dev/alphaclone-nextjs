'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Copy,
  Check,
  AlertCircle,
  Download,
  Eye,
  Edit3,
  Trash2,
  Mail,
  Clock,
  DollarSign,
  FileText,
  Settings,
  Save,
  Upload
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { businessInvoiceService } from '@/services/businessInvoiceService';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
// Removed unused import causing build failure


interface EnhancedInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice?: any;
  mode: 'create' | 'edit' | 'send';
  onSuccess?: (invoice: any) => void;
}

interface InvoiceFormData {
  clientId: string;
  clientName: string;
  clientEmail: string;
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  dueDate: string;
  notes: string;
  template: string;
}

const INVOICE_TEMPLATES = [
  { id: 'classic', name: 'Classic', preview: '/templates/classic.png' },
  { id: 'modern', name: 'Modern', preview: '/templates/modern.png' },
  { id: 'dark', name: 'Dark', preview: '/templates/dark.png' },
  { id: 'minimal', name: 'Minimal', preview: '/templates/minimal.png' },
  { id: 'bold', name: 'Bold', preview: '/templates/bold.png' }
];

const PAYMENT_METHODS = [
  { id: 'stripe', name: 'Credit Card (Stripe)', icon: '💳' },
  { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦' },
  { id: 'paypal', name: 'PayPal', icon: '🅿️' },
  { id: 'mobile_money', name: 'Mobile Money', icon: '📱' }
];

export default function EnhancedInvoiceModal({
  isOpen,
  onClose,
  invoice,
  mode,
  onSuccess
}: EnhancedInvoiceModalProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'payment' | 'preview'>('details');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [formData, setFormData] = useState<InvoiceFormData>({
    clientId: '',
    clientName: '',
    clientEmail: '',
    items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
    subtotal: 0,
    tax: 0,
    total: 0,
    dueDate: '',
    notes: '',
    template: 'modern',
    paymentMethods: ['stripe']
  });

  // Load invoice data if editing
  useEffect(() => {
    if (invoice && mode === 'edit') {
      setFormData({
        clientId: invoice.clientId || '',
        clientName: invoice.clientName || '',
        clientEmail: invoice.clientEmail || '',
        items: invoice.items || [{ description: '', quantity: 1, rate: 0, amount: 0 }],
        subtotal: invoice.subtotal || 0,
        tax: invoice.tax || 0,
        total: invoice.total || 0,
        dueDate: invoice.dueDate || '',
        notes: invoice.notes || '',
        template: invoice.template || 'modern',
        paymentMethods: invoice.paymentMethods || ['stripe']
      });
    }
  }, [invoice, mode, user?.name]);

  // Calculate totals
  useEffect(() => {
    const subtotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const tax = subtotal * 0.15; // 15% tax
    const total = subtotal + tax;

    setFormData(prev => ({
      ...prev,
      subtotal,
      tax,
      total
    }));
  }, [formData.items]);

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, rate: 0, amount: 0 }]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value, amount: item.quantity * item.rate } : item
      )
    }));
  };

  const handleClientSearch = async (query: string) => {
    // Implement client search functionality
    console.log('Searching clients:', query);
  };

  const handleSaveDraft = async () => {
    setIsLoading(true);
    try {
      const invoiceData = {
        ...formData,
        lineItems: formData.items,
        status: 'draft' as const,
        isPublic: false,
        tenantId: currentTenant?.id,
        createdBy: user?.id
      };

      let finalInvoice;
      if (mode === 'edit' && invoice) {
        const result = await businessInvoiceService.updateInvoice(invoice.id, invoiceData as any);
        if (result.error) throw new Error(result.error);
        finalInvoice = { ...invoice, ...invoiceData, id: invoice.id };
      } else {
        const result = await businessInvoiceService.createInvoice(currentTenant?.id || '', invoiceData as any);
        if (result.error) throw new Error(result.error);
        finalInvoice = result.invoice;
      }

      toast.success("Invoice saved as draft");

      onSuccess?.(finalInvoice);
      onClose();
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error("Failed to save invoice draft");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!formData.clientEmail) {
      toast.error("Client email is required to send invoice");
      return;
    }

    setIsSending(true);
    try {
      // Create or update invoice with sent status
      const invoiceData = {
        ...formData,
        lineItems: formData.items,
        status: 'sent' as const,
        isPublic: true,
        tenantId: currentTenant?.id,
        createdBy: user?.id
      };

      let finalInvoice;
      if (mode === 'edit' && invoice) {
        const result = await businessInvoiceService.updateInvoice(invoice.id, invoiceData as any);
        if (result.error) throw new Error(result.error);
        finalInvoice = { ...invoice, ...invoiceData, id: invoice.id };
      } else {
        const result = await businessInvoiceService.createInvoice(currentTenant?.id || '', invoiceData as any);
        if (result.error) throw new Error(result.error);
        finalInvoice = result.invoice;
      }

      if (!finalInvoice) throw new Error("Failed to retrieve invoice information");

      // Generate payment link if needed (isPublic is true)
      const paymentUrl = `${window.location.origin}/invoice/${finalInvoice.id}`;

      toast.success("Invoice finalized successfully");

      onSuccess?.(finalInvoice);
      onClose();
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast.error("Failed to send invoice");
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyPaymentLink = async () => {
    try {
      const paymentUrl = `${window.location.origin}/invoice/${invoice?.id}`;
      await navigator.clipboard.writeText(paymentUrl);
      setCopiedLink(true);
      toast.success("Payment link copied to clipboard");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast.error("Failed to copy payment link");
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const { businessInvoiceService } = await import('@/services/businessInvoiceService');
      const doc = businessInvoiceService.generatePDF(
        {
          ...formData,
          invoice_number: invoice?.invoice_number || invoice?.invoiceNumber || 'INV-TEMP',
          issue_date: invoice?.issue_date || invoice?.issueDate || new Date().toISOString(),
          due_date: formData.dueDate || invoice?.due_date || invoice?.dueDate,
          currency: 'USD',
          line_items: formData.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount
          }))
        },
        currentTenant,
        currentTenant // Fallback as client info might be limited in modal state
      );
      doc.save(`Invoice_${invoice?.invoice_number || invoice?.invoiceNumber || 'temp'}.pdf`);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error('Failed to download PDF:', error);
      toast.error("Failed to generate PDF");
    }
  };

  const renderDetailsTab = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Client</label>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Search client..."
            className="flex-1 px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            onChange={(e) => handleClientSearch(e.target.value)}
          />
          <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Client Name</label>
          <input
            type="text"
            value={formData.clientName}
            onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            placeholder="Enter client name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Client Email</label>
          <input
            type="email"
            value={formData.clientEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            placeholder="client@example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Due Date</label>
          <input
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Template</label>
          <select
            value={formData.template}
            onChange={(e) => setFormData(prev => ({ ...prev, template: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            {INVOICE_TEMPLATES.map(template => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          rows={3}
          placeholder="Additional notes..."
        />
      </div>
    </div>
  );

  const renderItemsTab = () => (
    <div className="space-y-4">
      {formData.items.map((item, index) => (
        <div key={index} className="flex items-center space-x-2 p-4 border border-slate-800 bg-slate-900/50 rounded-lg">
          <div className="flex-1">
            <input
              type="text"
              value={item.description}
              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
              placeholder="Item description"
              className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="w-20">
            <input
              type="number"
              value={item.quantity}
              onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              min="1"
            />
          </div>
          <div className="w-24">
            <input
              type="number"
              value={item.rate}
              onChange={(e) => handleItemChange(index, 'rate', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              step="0.01"
            />
          </div>
          <div className="w-24 text-right font-medium text-white">
            ${item.amount.toFixed(2)}
          </div>
          <button
            onClick={() => handleRemoveItem(index)}
            className="p-2 text-red-500 hover:bg-red-900/20 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      <button
        onClick={handleAddItem}
        className="w-full py-2 border-2 border-dashed border-slate-700 rounded-lg text-slate-400 hover:border-slate-500 hover:text-slate-300"
      >
        + Add Item
      </button>

      <div className="mt-6 p-4 bg-slate-800/50 border border-slate-800 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-slate-400">Subtotal:</span>
          <span className="font-medium text-white">${formData.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-slate-400">Tax (15%):</span>
          <span className="font-medium text-white">${formData.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-lg font-semibold border-t border-slate-700 pt-2 text-white">
          <span>Total:</span>
          <span>${formData.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );

  const renderPaymentTab = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">Payment Methods</label>
        <div className="space-y-2">
          {PAYMENT_METHODS.map(method => (
            <label key={method.id} className="flex items-center p-3 border border-slate-700 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700/50">
              <input
                type="checkbox"
                checked={formData.paymentMethods.includes(method.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData(prev => ({
                      ...prev,
                      paymentMethods: [...prev.paymentMethods, method.id]
                    }));
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      paymentMethods: prev.paymentMethods.filter(id => id !== method.id)
                    }));
                  }
                }}
                className="mr-3 rounded border-slate-600 text-teal-600 focus:ring-teal-500 bg-slate-900"
              />
              <span className="mr-2">{method.icon}</span>
              <span className="font-medium text-white">{method.name}</span>
            </label>
          ))}
        </div>
      </div>

    </div>
  );

  const renderPreviewTab = () => (
    <div className="space-y-4">
      <div className="bg-slate-800/50 p-4 rounded-lg">
        <h3 className="font-semibold text-white mb-2">Invoice Preview</h3>
        <p className="text-sm text-slate-400 mb-4">This is how your invoice will appear to the client</p>

        <div className="bg-slate-950 p-6 rounded-lg border border-slate-800">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">INVOICE</h2>
              <p className="text-slate-400">Invoice #: INV-{Date.now()}</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-white">{formData.clientName}</p>
              <p className="text-slate-400">{formData.clientEmail}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-white mb-2">Items</h3>
            {formData.items.map((item, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b border-slate-800/50">
                <div>
                  <p className="font-medium text-white">{item.description || 'Item'}</p>
                  <p className="text-sm text-slate-400">{item.quantity} × ${item.rate.toFixed(2)}</p>
                </div>
                <p className="font-medium text-white">${item.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 pt-4 text-white">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-400">Subtotal:</span>
              <span>${formData.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-400">Tax:</span>
              <span>${formData.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold border-t border-slate-800 pt-2">
              <span>Total:</span>
              <span>${formData.total.toFixed(2)}</span>
            </div>
          </div>

          {formData.notes && (
            <div className="mt-6 p-4 bg-slate-900 rounded-lg">
              <h4 className="font-medium text-white mb-2">Notes</h4>
              <p className="text-sm text-slate-400">{formData.notes}</p>
            </div>
          )}
        </div>
      </div>

      {invoice && (
        <div className="bg-teal-900/20 p-4 border border-teal-500/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-teal-400">Payment Link</h4>
              <p className="text-sm text-teal-500">Share this link with your client for payment</p>
            </div>
            <button
              onClick={handleCopyPaymentLink}
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors",
                copiedLink
                  ? "bg-green-600 text-white"
                  : "bg-teal-600 text-white hover:bg-teal-500"
              )}
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {mode === 'create' ? 'Create Invoice' : mode === 'edit' ? 'Edit Invoice' : 'Finalize Invoice'}
            </h2>
            <p className="text-sm text-slate-400">
              {mode === 'send' ? 'Review and finalize invoice' : 'Create a professional invoice for your client'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          {[
            { id: 'details', label: 'Details', icon: FileText },
            { id: 'items', label: 'Items', icon: DollarSign },
            { id: 'payment', label: 'Payment', icon: Settings },
            { id: 'preview', label: 'Preview', icon: Eye }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center space-x-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-teal-500 text-teal-400"
                  : "border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800/50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
          {activeTab === 'details' && renderDetailsTab()}
          {activeTab === 'items' && renderItemsTab()}
          {activeTab === 'payment' && renderPaymentTab()}
          {activeTab === 'preview' && renderPreviewTab()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-2">
            {mode !== 'send' && (
              <button
                onClick={handleSaveDraft}
                disabled={isLoading}
                className={cn(
                  "flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors",
                  isLoading
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                )}
              >
                <Save className="w-4 h-4" />
                <span>Save Draft</span>
              </button>
            )}

            {invoice && (
              <button
                onClick={handleCopyPaymentLink}
                className="flex items-center space-x-2 px-4 py-2 bg-teal-900/30 text-teal-400 rounded-lg hover:bg-teal-900/50 border border-teal-500/20"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Payment Link</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white"
            >
              Cancel
            </button>

            <button
              onClick={handleSendInvoice}
              disabled={isSending || !formData.clientName}
              className={cn(
                "flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors",
                isSending || !formData.clientName
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  : "bg-teal-600 text-white hover:bg-teal-500"
              )}
            >
              <Check className="w-4 h-4" />
              <span>{mode === 'send' ? 'Finalize Invoice' : 'Finalize'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}