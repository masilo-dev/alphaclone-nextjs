'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Upload,
  Package,
  Plus,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { businessInvoiceService } from '@/services/businessInvoiceService';
import { useServicesCatalog, ServiceItem } from '@/hooks/useServicesCatalog';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { showInvoiceCreatedWithSendPrompt } from '../common/showActionNextSteps';
import { cn } from '@/lib/utils';
import CreateInvoiceModal from './CreateInvoiceModal';
import BillableExpensesPicker from './invoicing/BillableExpensesPicker';
import { DocumentThemePicker } from '@/components/documents/DocumentThemePicker';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import {
  buildInvoiceDocumentInput,
  mergeInvoiceNotesMetadata,
  resolveDocumentThemeId,
} from '@/lib/documents/documentBuilders';
import type { DocumentThemeId } from '@/lib/documents/renderDocument';


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
  template: DocumentThemeId;
  paymentMethods: string[];
}

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
  const router = useRouter();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { services, addService } = useServicesCatalog();
  const [showServicePicker, setShowServicePicker] = useState(false);

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
    template: 'executive',
    paymentMethods: ['stripe']
  });

  const [draftInvoiceId, setDraftInvoiceId] = useState<string | null>(invoice?.id ?? null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (invoice?.id) setDraftInvoiceId(invoice.id);
  }, [invoice?.id]);

  useEffect(() => {
    if (!invoice?.id || !isOpen) return;
    const metadata = businessInvoiceService.parseMetadata(invoice.notes);
    const displayNotes = String(invoice.notes || '').replace(/---METADATA---[\s\S]*?---METADATA---\s*/, '').trim();
    setFormData((prev) => ({
      ...prev,
      clientId: invoice.clientId || invoice.client_id || prev.clientId,
      clientName: metadata?.clientName || invoice.clientName || prev.clientName,
      clientEmail: metadata?.clientEmail || metadata?.email || invoice.clientEmail || prev.clientEmail,
      dueDate: invoice.dueDate || invoice.due_date ? String(invoice.dueDate || invoice.due_date).slice(0, 10) : prev.dueDate,
      notes: displayNotes,
      template: resolveDocumentThemeId(metadata),
      items: invoice.lineItems?.length
        ? invoice.lineItems.map((item: { description: string; quantity: number; rate: number; amount: number }) => ({
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
          }))
        : prev.items,
      subtotal: Number(invoice.subtotal ?? prev.subtotal),
      tax: Number(invoice.tax ?? prev.tax),
      total: Number(invoice.total ?? prev.total),
    }));
  }, [invoice, isOpen]);

  const invoicePreviewInput = useMemo(() => {
    if (!currentTenant) return null;
    return buildInvoiceDocumentInput(
      {
        invoice_number: invoice?.invoiceNumber || invoice?.invoice_number || 'DRAFT',
        issue_date: invoice?.issueDate || invoice?.issue_date || new Date().toISOString(),
        due_date: formData.dueDate || undefined,
        notes: formData.notes,
        subtotal: formData.subtotal,
        tax: formData.tax,
        total: formData.total,
        status: 'draft',
        metadata: { document_theme: formData.template },
      },
      formData.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
      })),
      currentTenant,
      { name: formData.clientName, email: formData.clientEmail }
    );
  }, [currentTenant, formData, invoice]);

  const buildPersistedNotes = () =>
    mergeInvoiceNotesMetadata(formData.notes, {
      document_theme: formData.template,
      clientName: formData.clientName,
      clientEmail: formData.clientEmail,
    });

  useEffect(() => {
    if (!draftInvoiceId || !currentTenant?.id || mode === 'send') return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        const res = await fetch(`/api/invoices/${draftInvoiceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: currentTenant.id,
            subtotal: formData.subtotal,
            tax: formData.tax,
            total: formData.total,
            due_date: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
            notes: buildPersistedNotes(),
            line_items: formData.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.rate,
            })),
            status: 'draft',
          }),
        });
        if (res.ok) setAutoSaveStatus('saved');
      } catch {
        setAutoSaveStatus('idle');
      }
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [formData, draftInvoiceId, currentTenant?.id, mode]);

  const [clients, setClients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Load clients
  useEffect(() => {
    const loadClients = async () => {
      try {
        const { businessClientService } = await import('@/services/businessClientService');
        const { clients: fetchedClients } = await businessClientService.getClients(currentTenant?.id || '');
        setClients(fetchedClients || []);
      } catch (error) {
        console.error('Failed to load clients:', error);
      }
    };
    if (isOpen && currentTenant?.id) {
      loadClients();
    }
  }, [isOpen, currentTenant?.id]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowContactDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        notes: buildPersistedNotes(),
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
        setDraftInvoiceId(invoice.id);
      } else {
        const result = await businessInvoiceService.createInvoice(currentTenant?.id || '', invoiceData as any);
        if (result.error) throw new Error(result.error);
        finalInvoice = result.invoice;
        if (finalInvoice?.id) setDraftInvoiceId(finalInvoice.id);
      }

      toast.success("Invoice saved as draft");

      onSuccess?.(finalInvoice);
      onClose();
      if (mode === 'create') {
        showInvoiceCreatedWithSendPrompt((path) => router.push(path));
      }
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
    const toastId = toast.loading("Finalizing and sending invoice...");
    try {
      // Create or update invoice with sent status
      const invoiceData = {
        ...formData,
        notes: buildPersistedNotes(),
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
        setDraftInvoiceId(invoice.id);
      } else {
        const result = await businessInvoiceService.createInvoice(currentTenant?.id || '', invoiceData as any);
        if (result.error) throw new Error(result.error);
        finalInvoice = result.invoice;
        if (finalInvoice?.id) setDraftInvoiceId(finalInvoice.id);
      }

      if (!finalInvoice) throw new Error("Failed to retrieve invoice information");

      // Trigger durable invoice lifecycle (PDF -> send -> reminders -> overdue)
      // Prefer authenticated API — does not require MCP/AI availability.
      try {
        const tenantId = currentTenant?.id;
        if (!tenantId) throw new Error('Active workspace required');
        const { startInvoiceLifecycleFromDashboard } = await import(
          '@/lib/invoices/startInvoiceLifecycleFromDashboard'
        );
        await startInvoiceLifecycleFromDashboard({
          tenantId,
          invoiceId: finalInvoice.id,
        });
        toast.success("Invoice lifecycle started — email + reminders now managed automatically.", { id: toastId });
      } catch (dispatchError: any) {
        console.error('Invoice lifecycle Error:', dispatchError);
        toast.error(`Invoice saved, but lifecycle automation failed: ${dispatchError.message}`, { id: toastId });
      }

      onSuccess?.(finalInvoice);
      onClose();
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      toast.error(`Failed to finalize invoice: ${error.message}`, { id: toastId });
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyPaymentLink = async () => {
    try {
      const invoiceId = invoice?.id;
      const tenantId = currentTenant?.id;
      if (!invoiceId || !tenantId) {
        toast.error('Save the invoice first');
        return;
      }
      const res = await fetch(
        `/api/invoices/${invoiceId}/public-link?tenantId=${encodeURIComponent(tenantId)}`
      );
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Failed to build payment link');
      }
      await navigator.clipboard.writeText(data.url);
      setCopiedLink(true);
      toast.success('Payment link copied to clipboard');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to copy payment link');
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
          line_items: formData.items.map((item: any) => ({
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

  const reloadInvoiceFromDraft = async () => {
    if (!draftInvoiceId || !currentTenant?.id) return;
    const { invoices } = await businessInvoiceService.getInvoices(currentTenant.id);
    const found = invoices.find((i) => i.id === draftInvoiceId);
    if (found) {
      setFormData((prev) => ({
        ...prev,
        items: found.lineItems?.length
          ? found.lineItems.map((li) => ({
              description: li.description,
              quantity: li.quantity,
              rate: li.rate,
              amount: li.amount,
            }))
          : prev.items,
        subtotal: found.subtotal,
        tax: found.tax,
        total: found.total,
      }));
    }
  };

  const renderDetailsTab = () => (
    <div className="space-y-6">
      <div className="relative" ref={dropdownRef}>
        <label className="block text-sm font-medium text-slate-300 mb-2">Search Client</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search existing contacts..."
            className="w-full px-3 py-2 pl-10 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowContactDropdown(true);
            }}
            onFocus={() => setShowContactDropdown(true)}
          />
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        </div>

        <AnimatePresence>
          {showContactDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute w-full mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-[110] max-h-60 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700"
            >
              {clients.filter(c => 
                !searchQuery || 
                c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.email?.toLowerCase().includes(searchQuery.toLowerCase())
              ).length > 0 ? (
                clients
                  .filter(c => 
                    !searchQuery || 
                    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          clientId: c.id,
                          clientName: c.name || '',
                          clientEmail: c.email || ''
                        }));
                        setSearchQuery('');
                        setShowContactDropdown(false);
                      }}
                      className="w-full text-left p-3 rounded-lg hover:bg-white/5 flex items-center gap-3 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center border border-teal-500/20 group-hover:bg-teal-500/20 transition-all">
                        <span className="text-teal-400 text-xs font-black">{c.name?.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-200">{c.name}</span>
                        <span className="text-xs text-slate-500 font-medium uppercase tracking-tight">{c.email}</span>
                      </div>
                    </button>
                  ))
              ) : (
                <div className="p-4 text-center">
                  <p className="text-xs text-slate-500 font-medium italic">No matches found.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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

      {formData.clientId && currentTenant?.id && (
        <BillableExpensesPicker
          tenantId={currentTenant.id}
          clientId={formData.clientId}
          invoiceId={draftInvoiceId}
          onAttached={reloadInvoiceFromDraft}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Due Date</label>
          <input
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      <DocumentThemePicker
        value={formData.template}
        onChange={(themeId) => setFormData((prev) => ({ ...prev, template: themeId }))}
      />

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
            onClick={async () => {
              if (!item.description) {
                toast.error("Add a description first");
                return;
              }
              try {
                await addService({
                  name: item.description,
                  description: '',
                  defaultPrice: item.rate,
                  unit: 'flat'
                });
                toast.success("Saved to catalog");
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Failed to save service';
                toast.error(message);
              }
            }}
            className="p-2 text-slate-500 hover:text-teal-400 hover:bg-teal-400/10 rounded-lg transition-all"
            title="Save as Service"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleRemoveItem(index)}
            className="p-2 text-rose-500 hover:bg-rose-900/20 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <button
          onClick={handleAddItem}
          className="flex-1 py-2 border-2 border-dashed border-slate-700 rounded-lg text-slate-400 hover:border-slate-500 hover:text-slate-300 font-black uppercase text-[10px] tracking-widest"
        >
          + Add Custom Item
        </button>
        <button
          onClick={() => setShowServicePicker(true)}
          className="flex-1 py-2 border-2 border-dashed border-teal-500/30 rounded-lg text-teal-400 hover:border-teal-500 hover:text-teal-300 font-black uppercase text-[10px] tracking-widest bg-teal-500/5"
        >
          <Package className="w-3 h-3 inline mr-1" /> Add From Catalog
        </button>
      </div>

      <AnimatePresence>
        {showServicePicker && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-white font-black uppercase tracking-tight flex items-center gap-2">
                  <Package className="text-teal-500 w-4 h-4" /> Services Catalog
                </h3>
                <button onClick={() => setShowServicePicker(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
              </div>
              
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {services.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        items: [...prev.items, { description: s.name, quantity: 1, rate: s.defaultPrice, amount: s.defaultPrice }]
                      }));
                      setShowServicePicker(false);
                      toast.success(`Added ${s.name}`);
                    }}
                    className="w-full text-left p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all group"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-bold">{s.name}</p>
                        <p className="text-xs text-slate-500 line-clamp-1">{s.description}</p>
                      </div>
                      <span className="text-teal-400 font-black">${s.defaultPrice}</span>
                    </div>
                  </button>
                ))}
                {services.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-slate-500 text-sm italic">Catalog is empty. Add services in the Billing Hub.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
      {invoicePreviewInput ? (
        <DocumentPreview input={invoicePreviewInput} />
      ) : (
        <p className="text-sm text-slate-400">Add client details and line items to preview your themed invoice.</p>
      )}

      {invoice ? (
        <div className="bg-teal-900/20 p-4 border border-teal-500/20 rounded-lg">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h4 className="font-medium text-teal-400">Payment Link</h4>
              <p className="text-sm text-teal-500">Share this link with your client for payment</p>
            </div>
            <button
              onClick={handleCopyPaymentLink}
              className={cn(
                'flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors',
                copiedLink
                  ? 'bg-green-600 text-white'
                  : 'bg-teal-600 text-white hover:bg-teal-500'
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
      ) : null}
    </div>
  );

  if (mode === 'create') {
    return (
      <CreateInvoiceModal
        isOpen={isOpen}
        onClose={onClose}
        onInvoiceCreated={() => onSuccess?.(undefined)}
        projects={[]}
      />
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 pt-safe pb-safe md:pl-64">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col relative animate-fade-in overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {mode === 'edit' ? 'Edit Invoice' : 'Finalize Invoice'}
            </h2>
            <p className="text-sm text-slate-400">
              {mode === 'send' ? 'Review and finalize invoice' : 'Update invoice details for your client'}
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

        {/* Sticky action bar */}
        <div className="sticky bottom-0 z-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 sm:p-6 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md shrink-0">
          <div className="flex flex-wrap items-center gap-2">
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-slate-300 hover:text-white order-last sm:order-first"
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
