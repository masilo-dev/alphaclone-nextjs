import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// 1. get_invoices
registerTool('invoicing', {
  name: 'get_invoices',
  description: 'Retrieve invoices for a tenant, optionally filtered by status.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void']).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'] },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('business_invoices')
      .select('*')
      .eq('tenant_id', args.tenant_id);

    if (args.status) {
      query = query.eq('status', args.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
});

// 2. create_invoice
registerTool('invoicing', {
  name: 'create_invoice',
  description: 'Create a new invoice.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    client_id: z.string().uuid(),
    amount: z.number().positive(),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void']).optional().default('draft'),
    due_date: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      client_id: { type: 'string', format: 'uuid' },
      amount: { type: 'number', description: 'Total invoice amount' },
      status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'], default: 'draft' },
      due_date: { type: 'string', format: 'date-time' },
    },
    required: ['tenant_id', 'client_id', 'amount'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('business_invoices')
      .insert({
        tenant_id: args.tenant_id,
        client_id: args.client_id,
        total_amount: args.amount,
        status: args.status,
        due_date: args.due_date || null,
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 3. update_invoice_status
registerTool('invoicing', {
  name: 'update_invoice_status',
  description: 'Update the status of an existing invoice.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    invoice_id: z.string().uuid(),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void']),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      invoice_id: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'] },
    },
    required: ['tenant_id', 'invoice_id', 'status'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('business_invoices')
      .update({
        status: args.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.invoice_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 4. get_inventory_items
registerTool('invoicing', {
  name: 'get_inventory_items',
  description: 'Retrieve inventory items for stock management.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', args.tenant_id);

    if (error) throw error;
    return data;
  },
});

// 5. update_inventory_stock
registerTool('invoicing', {
  name: 'update_inventory_stock',
  description: 'Update the stock level of an inventory item.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    item_id: z.string().uuid(),
    quantity: z.number().int(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      item_id: { type: 'string', format: 'uuid' },
      quantity: { type: 'number', description: 'New absolute stock quantity' },
    },
    required: ['tenant_id', 'item_id', 'quantity'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('inventory_items')
      .update({
        stock: args.quantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.item_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});
