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
import { emailCampaignService } from '@/services/emailCampaignService';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { generateInvoicePDF } from '@/utils/pdfGenerator';

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
  paymentMethods: string[];
  sendEmail: boolean;
  emailSubject: string;
  emailMessage: string;
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
    paymentMethods: ['stripe'],
    sendEmail: true,
    emailSubject: '',
    emailMessage: ''
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
        paymentMethods: invoice.paymentMethods || ['stripe'],
        sendEmail: true,
        emailSubject: `Invoice ${invoice.invoiceNumber} from ${user?.name}`,
        emailMessage: `Dear ${invoice.clientName},\n\nPlease find your invoice attached.\n\nThank you for your business!`
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

      // Generate payment link
      const paymentUrl = `${window.location.origin}/invoice/${finalInvoice.id}`;

      // Send email if enabled
      if (formData.sendEmail) {
        await emailCampaignService.sendTransactionalEmail(
          formData.clientEmail,
          formData.emailSubject,
          {
            invoiceUrl: paymentUrl,
            invoiceNumber: finalInvoice.invoiceNumber || `INV-${finalInvoice.id.slice(0, 8)}`,
            amount: formData.total,
            dueDate: formData.dueDate,
            clientName: formData.clientName,
            message: formData.emailMessage,
            paymentMethods: formData.paymentMethods.join(', ')
          }
        );
      }

      toast.success("Invoice sent successfully");

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
        <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Search client..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onChange={(e) => handleClientSearch(e.target.value)}
          />
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Client Name</label>
          <input
            type="text"
            value={formData.clientName}
            onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter client name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Client Email</label>
          <input
            type="email"
            value={formData.clientEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="client@example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
          <input
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
          <select
            value={formData.template}
            onChange={(e) => setFormData(prev => ({ ...prev, template: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {INVOICE_TEMPLATES.map(template => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder="Additional notes..."
        />
      </div>
    </div>
  );

  const renderItemsTab = () => (
    <div className="space-y-4">
      {formData.items.map((item, index) => (
        <div key={index} className="flex items-center space-x-2 p-4 border border-gray-200 rounded-lg">
          <div className="flex-1">
            <input
              type="text"
              value={item.description}
              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
              placeholder="Item description"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="w-20">
            <input
              type="number"
              value={item.quantity}
              onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
            />
          </div>
          <div className="w-24">
            <input
              type="number"
              value={item.rate}
              onChange={(e) => handleItemChange(index, 'rate', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="0.01"
            />
          </div>
          <div className="w-24 text-right font-medium">
            ${item.amount.toFixed(2)}
          </div>
          <button
            onClick={() => handleRemoveItem(index)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      <button
        onClick={handleAddItem}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700"
      >
        + Add Item
      </button>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-medium">${formData.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600">Tax (15%):</span>
          <span className="font-medium">${formData.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-lg font-semibold border-t pt-2">
          <span>Total:</span>
          <span>${formData.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );

  const renderPaymentTab = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Payment Methods</label>
        <div className="space-y-2">
          {PAYMENT_METHODS.map(method => (
            <label key={method.id} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
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
                className="mr-3"
              />
              <span className="mr-2">{method.icon}</span>
              <span className="font-medium">{method.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t pt-6">
        <label className="flex items-center mb-4">
          <input
            type="checkbox"
            checked={formData.sendEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, sendEmail: e.target.checked }))}
            className="mr-2"
          />
          <span className="font-medium">Send email notification to client</span>
        </label>

        {formData.sendEmail && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Subject</label>
              <input
                type="text"
                value={formData.emailSubject}
                onChange={(e) => setFormData(prev => ({ ...prev, emailSubject: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter email subject"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Message</label>
              <textarea
                value={formData.emailMessage}
                onChange={(e) => setFormData(prev => ({ ...prev, emailMessage: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="Enter email message"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderPreviewTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Invoice Preview</h3>
        <p className="text-sm text-gray-600 mb-4">This is how your invoice will appear to the client</p>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
              <p className="text-gray-600">Invoice #: INV-{Date.now()}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">{formData.clientName}</p>
              <p className="text-gray-600">{formData.clientEmail}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">Items</h3>
            {formData.items.map((item, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                <div>
                  <p className="font-medium">{item.description || 'Item'}</p>
                  <p className="text-sm text-gray-600">{item.quantity} × ${item.rate.toFixed(2)}</p>
                </div>
                <p className="font-medium">${item.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <span>Subtotal:</span>
              <span>${formData.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span>Tax:</span>
              <span>${formData.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>${formData.total.toFixed(2)}</span>
            </div>
          </div>

          {formData.notes && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Notes</h4>
              <p className="text-sm text-gray-600">{formData.notes}</p>
            </div>
          )}
        </div>
      </div>

      {invoice && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-blue-900">Payment Link</h4>
              <p className="text-sm text-blue-700">Share this link with your client for payment</p>
            </div>
            <button
              onClick={handleCopyPaymentLink}
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors",
                copiedLink
                  ? "bg-green-600 text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700"
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'create' ? 'Create Invoice' : mode === 'edit' ? 'Edit Invoice' : 'Send Invoice'}
            </h2>
            <p className="text-sm text-gray-600">
              {mode === 'send' ? 'Review and send invoice to client' : 'Create a professional invoice for your client'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
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
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && renderDetailsTab()}
          {activeTab === 'items' && renderItemsTab()}
          {activeTab === 'payment' && renderPaymentTab()}
          {activeTab === 'preview' && renderPreviewTab()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            {mode !== 'send' && (
              <button
                onClick={handleSaveDraft}
                disabled={isLoading}
                className={cn(
                  "flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors",
                  isLoading
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                )}
              >
                <Save className="w-4 h-4" />
                <span>Save Draft</span>
              </button>
            )}

            {invoice && (
              <button
                onClick={handleCopyPaymentLink}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Payment Link</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>

            <button
              onClick={handleSendInvoice}
              disabled={isSending || !formData.clientName || !formData.clientEmail}
              className={cn(
                "flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors",
                isSending || !formData.clientName || !formData.clientEmail
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              <Send className="w-4 h-4" />
              <span>{mode === 'send' ? 'Send Invoice' : 'Send to Client'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}