import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
<<<<<<< HEAD
import { ensureInvoicePaymentLink } from '@/lib/invoicing/invoicePaymentLink';
=======
>>>>>>> origin/main

// 1. get_invoices
registerTool('invoicing', {
  name: 'get_invoices',
<<<<<<< HEAD
  description: 'Retrieve invoices for a tenant, optionally filtered by status. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
=======
  description: 'Retrieve invoices for a tenant, optionally filtered by status.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
>>>>>>> origin/main
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void']).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
<<<<<<< HEAD
      status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'] },
    },
    required: [],
=======
      tenant_id: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'] },
    },
    required: ['tenant_id'],
>>>>>>> origin/main
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
<<<<<<< HEAD
  description: 'Create a new invoice. Generates a Stripe payment link when Connect is active. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
=======
  description: 'Create a new invoice.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
>>>>>>> origin/main
    client_id: z.string().uuid(),
    amount: z.number().positive(),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void']).optional().default('draft'),
    due_date: z.string().optional(),
<<<<<<< HEAD
    bank_name: z.string().optional(),
    account_number: z.string().optional(),
    branch_code: z.string().optional(),
    swift_code: z.string().optional(),
    payment_reference: z.string().optional(),
    bank_details: z.string().optional(),
=======
>>>>>>> origin/main
  }),
  jsonSchema: {
    type: 'object',
    properties: {
<<<<<<< HEAD
=======
      tenant_id: { type: 'string', format: 'uuid' },
>>>>>>> origin/main
      client_id: { type: 'string', format: 'uuid' },
      amount: { type: 'number', description: 'Total invoice amount' },
      status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'], default: 'draft' },
      due_date: { type: 'string', format: 'date-time' },
<<<<<<< HEAD
      bank_name: { type: 'string' },
      account_number: { type: 'string' },
      branch_code: { type: 'string' },
      swift_code: { type: 'string' },
      payment_reference: { type: 'string' },
      bank_details: { type: 'string' },
    },
    required: ['client_id', 'amount'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const issueDate = new Date().toISOString().slice(0, 10);
    const dueDate =
      args.due_date?.slice(0, 10) ||
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

=======
    },
    required: ['tenant_id', 'client_id', 'amount'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
>>>>>>> origin/main
    const { data, error } = await supabase
      .from('business_invoices')
      .insert({
        tenant_id: args.tenant_id,
        client_id: args.client_id,
<<<<<<< HEAD
        total: args.amount,
        total_amount: args.amount,
        subtotal: args.amount,
        status: args.status,
        due_date: dueDate,
        issue_date: issueDate,
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        bank_name: args.bank_name || null,
        account_number: args.account_number || null,
        branch_code: args.branch_code || null,
        swift_code: args.swift_code || null,
        payment_reference: args.payment_reference || null,
        bank_details: args.bank_details || null,
=======
        total_amount: args.amount,
        status: args.status,
        due_date: args.due_date || null,
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
>>>>>>> origin/main
      })
      .select()
      .single();

    if (error) throw error;
<<<<<<< HEAD

    const payment = await ensureInvoicePaymentLink({
      tenantId: args.tenant_id!, // guaranteed by session injection via forceSessionArgs
      invoiceId: data.id,
    });

    return {
      ...data,
      payment_link: payment.payment_link,
      stripe_connected: payment.stripe_connected,
    };
=======
    return data;
>>>>>>> origin/main
  },
});

// 3. update_invoice_status
registerTool('invoicing', {
  name: 'update_invoice_status',
<<<<<<< HEAD
  description: 'Update the status of an existing invoice. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
=======
  description: 'Update the status of an existing invoice.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
>>>>>>> origin/main
    invoice_id: z.string().uuid(),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void']),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
<<<<<<< HEAD
      invoice_id: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'] },
    },
    required: ['invoice_id', 'status'],
=======
      tenant_id: { type: 'string', format: 'uuid' },
      invoice_id: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'] },
    },
    required: ['tenant_id', 'invoice_id', 'status'],
>>>>>>> origin/main
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

<<<<<<< HEAD
const bankFieldsSchema = z.object({
  bank_name: z.string().optional(),
  account_number: z.string().optional(),
  branch_code: z.string().optional(),
  swift_code: z.string().optional(),
  payment_reference: z.string().optional(),
  bank_details: z.string().optional(),
});

// 4. update_invoice
registerTool('invoicing', {
  name: 'update_invoice',
  description: 'Update invoice fields including bank payment details. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
    invoice_id: z.string().uuid(),
    ...bankFieldsSchema.shape,
    amount: z.number().positive().optional(),
    due_date: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      invoice_id: { type: 'string', format: 'uuid' },
      bank_name: { type: 'string' },
      account_number: { type: 'string' },
      branch_code: { type: 'string' },
      swift_code: { type: 'string' },
      payment_reference: { type: 'string' },
      bank_details: { type: 'string' },
      amount: { type: 'number' },
      due_date: { type: 'string', format: 'date-time' },
    },
    required: ['invoice_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (args.amount !== undefined) patch.total_amount = args.amount;
    if (args.due_date !== undefined) patch.due_date = args.due_date;
    if (args.bank_name !== undefined) patch.bank_name = args.bank_name;
    if (args.account_number !== undefined) patch.account_number = args.account_number;
    if (args.branch_code !== undefined) patch.branch_code = args.branch_code;
    if (args.swift_code !== undefined) patch.swift_code = args.swift_code;
    if (args.payment_reference !== undefined) patch.payment_reference = args.payment_reference;
    if (args.bank_details !== undefined) patch.bank_details = args.bank_details;

    const { data, error } = await supabase
      .from('business_invoices')
      .update(patch)
      .eq('id', args.invoice_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 5. send_invoice
registerTool('invoicing', {
  name: 'send_invoice',
  description: 'Send an invoice email to the client with tracking pixel and optional payment link. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
    invoice_id: z.string().uuid(),
    recipient_email: z.string().email().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      invoice_id: { type: 'string', format: 'uuid' },
      recipient_email: { type: 'string', format: 'email' },
    },
    required: ['invoice_id'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { data: invoice, error } = await supabase
      .from('business_invoices')
      .select('*, client:business_clients(email, name)')
      .eq('id', args.invoice_id)
      .eq('tenant_id', args.tenant_id)
      .single();

    if (error || !invoice) throw new Error('Invoice not found');

    const toEmail =
      args.recipient_email ||
      (invoice as any).client?.email ||
      (invoice as any).client_email;
    if (!toEmail) throw new Error('Recipient email is required');

    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
    const res = await fetch(`${origin}/api/invoices/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: args.tenant_id,
        invoiceId: args.invoice_id,
        recipientEmail: toEmail,
        userId: ctx.userId,
      }),
    });
    const payload = await res.json();
    if (!res.ok || payload.error) {
      throw new Error(payload.error || 'Failed to send invoice');
    }

    return {
      sent: true,
      sent_to: toEmail,
      sent_at: new Date().toISOString(),
      opened: Boolean(invoice.viewed_at),
      opened_at: invoice.viewed_at || null,
      payment_link: invoice.payment_link || null,
      ...payload,
    };
  },
});

// 6. get_inventory_items
registerTool('invoicing', {
  name: 'get_inventory_items',
  description: 'Retrieve inventory items for stock management. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
  }),
  jsonSchema: {
    type: 'object',
    properties: {},
    required: [],
=======
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
>>>>>>> origin/main
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
<<<<<<< HEAD
  description: 'Update the stock level of an inventory item. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
=======
  description: 'Update the stock level of an inventory item.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
>>>>>>> origin/main
    item_id: z.string().uuid(),
    quantity: z.number().int(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
<<<<<<< HEAD
      item_id: { type: 'string', format: 'uuid' },
      quantity: { type: 'number', description: 'New absolute stock quantity' },
    },
    required: ['item_id', 'quantity'],
=======
      tenant_id: { type: 'string', format: 'uuid' },
      item_id: { type: 'string', format: 'uuid' },
      quantity: { type: 'number', description: 'New absolute stock quantity' },
    },
    required: ['tenant_id', 'item_id', 'quantity'],
>>>>>>> origin/main
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
<<<<<<< HEAD

registerTool('invoicing', {
  name: 'convert_quote_to_invoice',
  description:
    'Convert an accepted quote into a business invoice. Optionally auto-send the invoice email to the client.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    quote_id: z.string().uuid(),
    auto_send: z.boolean().optional().default(false),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      quote_id: { type: 'string', format: 'uuid' },
      auto_send: { type: 'boolean', description: 'Send invoice email after conversion' },
    },
    required: ['quote_id'],
  },
  handler: async (args) => {
    const { convertQuoteToInvoice } = await import(
      '@/lib/quotes/convertQuoteToInvoice'
    );
    const result = await convertQuoteToInvoice(args.quote_id, args.tenant_id!, {
      autoSend: args.auto_send,
    });
    if (result.error) throw new Error(result.error);
    return {
      invoice_id: result.invoiceId,
      public_token: result.publicToken,
      converted: true,
    };
  },
});
=======
>>>>>>> origin/main
