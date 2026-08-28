import { supabase } from '../lib/supabase';

interface RecurringInvoiceConfig {
  id: string;
  clientName: string;
  amount: string;
  frequency: 'monthly' | 'weekly' | 'yearly' | 'daily';
  startDate: string;
  description: string;
  tenantId: string;
  createdAt: string;
  lastGenerated?: string;
  active?: boolean;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  tenant_id: string;
  created_at: string;
}

/**
 * Cron Job Service for Automated Recurring Invoices
 * 
 * This service handles the scheduling and generation of recurring invoices.
 * In production, this would be triggered by Vercel Cron Jobs or an external scheduler.
 */
export const cronService = {
  /**
   * Process all recurring invoices that are due
   * This should be called daily by a cron job
   */
  processRecurringInvoices: async (): Promise<{ success: boolean; processed: number; errors: string[] }> => {
    const errors: string[] = [];
    let processed = 0;

    try {
      // Get all recurring invoice configurations from database
      // Note: In production, store these in a proper database table
      const { data: recurringConfigs, error: fetchError } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('active', true);

      if (fetchError) {
        console.error('Error fetching recurring invoices:', fetchError);
        return { success: false, processed: 0, errors: [fetchError.message] };
      }

      if (!recurringConfigs || recurringConfigs.length === 0) {
        console.log('No recurring invoices to process');
        return { success: true, processed: 0, errors: [] };
      }

      const today = new Date();
      
      for (const config of recurringConfigs) {
        try {
          const shouldGenerate = cronService.shouldGenerateInvoice(config as any, today);
          
          if (shouldGenerate) {
            await cronService.generateInvoice(config as any);
            processed++;
            console.log(`Generated recurring invoice for ${config.client_name}`);
          }
        } catch (err) {
          const errorMsg = `Failed to process recurring invoice ${config.id}: ${err}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return { success: true, processed, errors };
    } catch (err) {
      const errorMsg = `Cron job execution failed: ${err}`;
      console.error(errorMsg);
      return { success: false, processed, errors: [errorMsg] };
    }
  },

  /**
   * Determine if a recurring invoice should be generated today
   */
  shouldGenerateInvoice: (config: RecurringInvoiceConfig, today: Date): boolean => {
    const startDate = new Date(config.startDate);
    
    // Check if start date has passed
    if (startDate > today) {
      return false;
    }

    const lastGenerated = config.lastGenerated ? new Date(config.lastGenerated) : null;
    
    switch (config.frequency) {
      case 'daily':
        return !lastGenerated || cronService.isDifferentDay(lastGenerated, today);
      
      case 'weekly':
        return !lastGenerated || cronService.isDifferentWeek(lastGenerated, today);
      
      case 'monthly':
        return !lastGenerated || cronService.isDifferentMonth(lastGenerated, today);
      
      case 'yearly':
        return !lastGenerated || cronService.isDifferentYear(lastGenerated, today);
      
      default:
        return false;
    }
  },

  /**
   * Generate an invoice from a recurring configuration
   */
  generateInvoice: async (config: RecurringInvoiceConfig): Promise<void> => {
    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}`;
    
    // Calculate due date (30 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Create invoice in database
    const { error } = await supabase.from('business_invoices').insert({
      invoice_number: invoiceNumber,
      client_id: null,
      total: parseFloat(config.amount),
      subtotal: parseFloat(config.amount),
      status: 'sent',
      due_date: dueDate.toISOString().slice(0, 10),
      issue_date: new Date().toISOString().slice(0, 10),
      tenant_id: config.tenantId,
      notes: config.description,
    });

    if (error) {
      throw new Error(`Failed to create invoice: ${error.message}`);
    }

    // Update last generated timestamp
    await supabase
      .from('recurring_invoices')
      .update({ last_generated: new Date().toISOString() })
      .eq('id', config.id);

    // In production: Send email notification to client
    // await emailService.sendInvoiceEmail(invoice, client);
  },

  /**
   * Helper: Check if two dates are on different days
   */
  isDifferentDay: (date1: Date, date2: Date): boolean => {
    return date1.getDate() !== date2.getDate() ||
           date1.getMonth() !== date2.getMonth() ||
           date1.getFullYear() !== date2.getFullYear();
  },

  /**
   * Helper: Check if two dates are in different weeks
   */
  isDifferentWeek: (date1: Date, date2: Date): boolean => {
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    return (date2.getTime() - date1.getTime()) >= oneWeek;
  },

  /**
   * Helper: Check if two dates are in different months
   */
  isDifferentMonth: (date1: Date, date2: Date): boolean => {
    return date1.getMonth() !== date2.getMonth() ||
           date1.getFullYear() !== date2.getFullYear();
  },

  /**
   * Helper: Check if two dates are in different years
   */
  isDifferentYear: (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() !== date2.getFullYear();
  },

  /**
   * Create a recurring invoice configuration
   */
  createRecurringInvoice: async (config: Omit<RecurringInvoiceConfig, 'id' | 'createdAt'>): Promise<{ success: boolean; error?: string }> => {
    try {
      const amountNum = typeof config.amount === 'number' ? config.amount : parseFloat(String(config.amount));
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        return { success: false, error: 'Invalid amount' };
      }

      const { error } = await supabase.from('recurring_invoices').insert({
        client_name: config.clientName,
        amount: amountNum,
        frequency: config.frequency,
        start_date: config.startDate,
        description: config.description || null,
        tenant_id: config.tenantId,
        active: true,
        created_at: new Date().toISOString()
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  /**
   * Update a recurring invoice configuration
   */
  updateRecurringInvoice: async (id: string, updates: Partial<RecurringInvoiceConfig>): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('recurring_invoices')
        .update({
          ...(updates.clientName && { client_name: updates.clientName }),
          ...(updates.amount !== undefined && {
            amount: typeof updates.amount === 'number' ? updates.amount : parseFloat(String(updates.amount)),
          }),
          ...(updates.frequency && { frequency: updates.frequency }),
          ...(updates.startDate && { start_date: updates.startDate }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.active !== undefined && { active: updates.active }),
        })
        .eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  /**
   * Delete a recurring invoice configuration
   */
  deleteRecurringInvoice: async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('recurring_invoices')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  /**
   * Get all recurring invoices for a tenant
   */
  getRecurringInvoices: async (tenantId: string): Promise<{ data: RecurringInvoiceConfig[] | null; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error: error.message };
      }

      const mapped: RecurringInvoiceConfig[] = (data || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        clientName: String(row.client_name ?? ''),
        amount: String(row.amount ?? ''),
        frequency: row.frequency as RecurringInvoiceConfig['frequency'],
        startDate: String(row.start_date ?? ''),
        description: String(row.description ?? ''),
        tenantId: String(row.tenant_id ?? ''),
        createdAt: String(row.created_at ?? ''),
        lastGenerated: row.last_generated ? String(row.last_generated) : undefined,
        active: row.active !== false,
      }));

      return { data: mapped };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  }
};
