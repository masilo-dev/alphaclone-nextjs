import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { operationFailed } from '@/lib/api/operationResult';
import { BrowserManager } from '@/lib/scraper/browserManager';
import { requireTenantAccess } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  try {
    const { tenantId, action, config } = await req.json();

    if (!tenantId || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    const { user } = await requireTenantAccess(tenantId);

    const supabase = createSupabaseAdminClient();
    await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

    switch (action) {
      case 'create_invoice':
        return NextResponse.json(await createInvoice(tenantId, config, supabase));
      case 'update_invoice':
        return NextResponse.json(await updateInvoice(tenantId, config, supabase));
      case 'get_invoices':
        return NextResponse.json(await getInvoices(tenantId, config, supabase));
      case 'get_invoice_details':
        return NextResponse.json(await getInvoiceDetails(tenantId, config, supabase));
      case 'download_invoice':
        return NextResponse.json(await downloadInvoice(tenantId, config, supabase));
      case 'send_invoice':
        return NextResponse.json(await sendInvoice(tenantId, config, supabase, req.nextUrl.origin, user.id));
      case 'record_payment':
        return NextResponse.json(await recordPayment(tenantId, config, supabase));
      case 'create_expense':
        return NextResponse.json(await createExpense(tenantId, config, supabase));
      case 'get_expenses':
        return NextResponse.json(await getExpenses(tenantId, config, supabase));
      case 'get_financial_summary':
        return NextResponse.json(await getFinancialSummary(tenantId, config, supabase));
      case 'create_bill':
        return NextResponse.json(await createBill(tenantId, config, supabase));
      case 'get_bills':
        return NextResponse.json(await getBills(tenantId, config, supabase));
      case 'create_bank_account':
        return NextResponse.json(await createBankAccount(tenantId, config, supabase));
      case 'get_bank_accounts':
        return NextResponse.json(await getBankAccounts(tenantId, supabase));
      case 'create_reconciliation_session':
        return NextResponse.json(await createReconciliationSession(tenantId, config, supabase, user.id));
      case 'get_reconciliation_sessions':
        return NextResponse.json(await getReconciliationSessions(tenantId, config, supabase));
      case 'get_ar_aging':
        return NextResponse.json(await getAccountsReceivableAging(tenantId, supabase));
      case 'get_ap_aging':
        return NextResponse.json(await getAccountsPayableAging(tenantId, supabase));
      case 'get_finance_snapshot':
        return NextResponse.json(await getFinanceSnapshot(tenantId, supabase));
      case 'create_default_chart_of_accounts':
        return NextResponse.json(await createDefaultChartOfAccounts(tenantId, supabase));
      default:
        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Invoice/Accounting error:', error);
    return clientErrorResponse(error, { request: req, scope: 'accounting/management.POST' });
  }
}

async function createInvoice(tenantId: string, config: any, supabase: any) {
  try {
    const {
      clientId,
      leadId,
      dealId,
      items,
      taxes,
      discounts,
      dueDate,
      notes,
      terms,
      currency = 'USD',
      template = 'standard'
    } = config;

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    const taxAmount = taxes.reduce((sum: number, tax: any) => sum + (subtotal * (tax.rate / 100)), 0);
    const discountAmount = discounts.reduce((sum: number, discount: any) => {
      if (discount.type === 'percentage') {
        return sum + (subtotal * (discount.value / 100));
      } else {
        return sum + discount.value;
      }
    }, 0);
    const total = subtotal + taxAmount - discountAmount;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(tenantId, supabase);

    // Create invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        invoice_number: invoiceNumber,
        client_id: clientId,
        lead_id: leadId,
        deal_id: dealId,
        items: items,
        subtotal: subtotal,
        taxes: taxes,
        tax_amount: taxAmount,
        discounts: discounts,
        discount_amount: discountAmount,
        total: total,
        currency: currency,
        due_date: dueDate,
        notes: notes,
        terms: terms,
        template: template,
        status: 'draft',
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        clients:client_id(id, name, email, phone, address),
        leads:lead_id(id, name, email, phone),
        deals:deal_id(id, name, value)
      `)
      .single();

    if (error) throw error;

    // Update accounting system
    await updateAccountingSystem(tenantId, {
      type: 'invoice',
      invoiceId: invoice.id,
      amount: total,
      currency: currency,
      status: 'draft'
    }, supabase);

    return {
      success: true,
      data: invoice,
      message: 'Invoice created successfully'
    };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function createBill(tenantId: string, config: any, supabase: any) {
  try {
    const {
      vendorId,
      companyId,
      reference,
      issueDate,
      dueDate,
      lineItems = [],
      notes,
      terms,
      currency = 'USD',
      status = 'draft'
    } = config;

    const subtotal = lineItems.reduce((sum: number, item: any) => sum + (Number(item.quantity || 1) * Number(item.unitPrice || 0)), 0);
    const taxAmount = lineItems.reduce((sum: number, item: any) => sum + Number(item.taxAmount || 0), 0);
    const discountAmount = lineItems.reduce((sum: number, item: any) => sum + Number(item.discountAmount || 0), 0);
    const total = subtotal + taxAmount - discountAmount;

    const { data: billNumber, error: billNumberError } = await supabase.rpc('generate_bill_number', {
      p_tenant_id: tenantId,
    });
    if (billNumberError) throw billNumberError;

    const { data: bill, error } = await supabase
      .from('vendor_bills')
      .insert({
        tenant_id: tenantId,
        vendor_id: vendorId,
        company_id: companyId,
        bill_number: billNumber,
        reference,
        issue_date: issueDate,
        due_date: dueDate,
        status,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total,
        amount_paid: Number(config.amountPaid || 0),
        currency,
        line_items: lineItems,
        notes,
        terms,
        metadata: config.metadata || {}
      })
      .select('*')
      .single();

    if (error) throw error;

    return {
      success: true,
      data: bill,
      message: 'Vendor bill created successfully'
    };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function getBills(tenantId: string, config: any, supabase: any) {
  try {
    const { page = 1, limit = 20, status } = config || {};
    let query = supabase
      .from('vendor_bills')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query
      .order('issue_date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    return {
      success: true,
      data: {
        bills: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit),
        }
      }
    };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function createBankAccount(tenantId: string, config: any, supabase: any) {
  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .insert({
        tenant_id: tenantId,
        name: config.name,
        account_number_last4: config.accountNumberLast4,
        bank_name: config.bankName,
        account_type: config.accountType || 'checking',
        currency: config.currency || 'USD',
        opening_balance: Number(config.openingBalance || 0),
        current_balance: Number(config.currentBalance ?? config.openingBalance ?? 0),
        coa_account_id: config.coaAccountId || null,
        is_active: config.isActive ?? true,
        metadata: config.metadata || {}
      })
      .select('*')
      .single();

    if (error) throw error;

    return { success: true, data, message: 'Bank account created successfully' };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function getBankAccounts(tenantId: string, supabase: any) {
  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) throw error;
    return { success: true, data: { accounts: data || [] } };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function createReconciliationSession(tenantId: string, config: any, supabase: any, userId: string) {
  try {
    const completed = config.status === 'completed';
    const { data, error } = await supabase
      .from('reconciliation_sessions')
      .insert({
        tenant_id: tenantId,
        bank_account_id: config.bankAccountId,
        statement_start_date: config.statementStartDate,
        statement_end_date: config.statementEndDate,
        statement_ending_balance: Number(config.statementEndingBalance || 0),
        cleared_balance: Number(config.clearedBalance || 0),
        status: config.status || 'draft',
        notes: config.notes,
        created_by: userId,
        completed_by: completed ? userId : null,
        completed_at: completed ? new Date().toISOString() : null,
        metadata: config.metadata || {},
      })
      .select('*')
      .single();

    if (error) throw error;
    return { success: true, data, message: 'Reconciliation session created successfully' };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function getReconciliationSessions(tenantId: string, config: any, supabase: any) {
  try {
    const limit = Number(config?.limit || 25);
    const { data, error } = await supabase
      .from('reconciliation_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('statement_end_date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data: { sessions: data || [] } };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function getAccountsReceivableAging(tenantId: string, supabase: any) {
  try {
    const { data, error } = await supabase.rpc('get_accounts_receivable_aging', {
      p_tenant_id: tenantId,
    });
    if (error) throw error;
    return { success: true, data: { aging: data || [] } };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function getAccountsPayableAging(tenantId: string, supabase: any) {
  try {
    const { data, error } = await supabase.rpc('get_accounts_payable_aging', {
      p_tenant_id: tenantId,
    });
    if (error) throw error;
    return { success: true, data: { aging: data || [] } };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function getFinanceSnapshot(tenantId: string, supabase: any) {
  try {
    const { data, error } = await supabase.rpc('get_finance_operating_snapshot', {
      p_tenant_id: tenantId,
    });
    if (error) throw error;
    return { success: true, data: data || {} };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function updateInvoice(tenantId: string, config: any, supabase: any) {
  try {
    const { invoiceId, updates } = config;

    // Recalculate totals if items changed
    let updateData = { ...updates };
    
    if (updates.items) {
      const subtotal = updates.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
      const taxAmount = (updates.taxes || []).reduce((sum: number, tax: any) => sum + (subtotal * (tax.rate / 100)), 0);
      const discountAmount = (updates.discounts || []).reduce((sum: number, discount: any) => {
        if (discount.type === 'percentage') {
          return sum + (subtotal * (discount.value / 100));
        } else {
          return sum + discount.value;
        }
      }, 0);
      
      updateData = {
        ...updateData,
        subtotal: subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total: subtotal + taxAmount - discountAmount,
        updated_at: new Date().toISOString()
      };
    }

    // Update invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .select(`
        *,
        clients:client_id(id, name, email, phone, address),
        leads:lead_id(id, name, email, phone),
        deals:deal_id(id, name, value)
      `)
      .single();

    if (error) throw error;

    // Update accounting system
    if (updates.status || updates.total) {
      await updateAccountingSystem(tenantId, {
        type: 'invoice_update',
        invoiceId: invoiceId,
        status: updates.status || invoice.status,
        amount: updates.total || invoice.total,
        currency: invoice.currency
      }, supabase);
    }

    return {
      success: true,
      data: invoice,
      message: 'Invoice updated successfully'
    };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function getInvoices(tenantId: string, config: any, supabase: any) {
  try {
    const { page = 1, limit = 10, status, clientId, dateRange } = config;

    let query = supabase
      .from('invoices')
      .select(`
        *,
        clients:client_id(id, name, email),
        leads:lead_id(id, name),
        deals:deal_id(id, name, value)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (status) {
      query = query.eq('status', status);
    }

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    if (dateRange) {
      query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
    }

    const { data: invoices, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    return {
      success: true,
      data: {
        invoices: invoices || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function getInvoiceDetails(tenantId: string, config: any, supabase: any) {
  try {
    const { invoiceId } = config;

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        clients:client_id(*),
        leads:lead_id(*),
        deals:deal_id(*),
        payments:payments(*)
      `)
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    return {
      success: true,
      data: invoice
    };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function downloadInvoice(tenantId: string, config: any, supabase: any) {
  try {
    const { invoiceId, format = 'pdf' } = config;

    // Get invoice details
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        clients:client_id(*),
        leads:lead_id(*),
        deals:deal_id(*)
      `)
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    // Generate invoice PDF
    const pdfBuffer = await generateInvoicePDF({
      invoice: invoice,
      format: format,
      template: invoice.template || 'standard'
    });

    // Update download count
    await supabase
      .from('invoices')
      .update({ 
        download_count: (invoice.download_count || 0) + 1,
        last_downloaded: new Date().toISOString()
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    return {
      success: true,
      data: {
        filename: `Invoice_${invoice.invoice_number}.${format}`,
        buffer: pdfBuffer,
        size: pdfBuffer.length
      },
      message: 'Invoice downloaded successfully'
    };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function sendInvoice(tenantId: string, config: any, supabase: any, origin: string, actorUserId: string) {
  try {
    const { invoiceId, recipients, subject, message, attachPDF = true } = config;

    // Get invoice details
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        clients:client_id(*)
      `)
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    // Generate PDF if needed
    let pdfBuffer = null;
    if (attachPDF) {
      pdfBuffer = await generateInvoicePDF({
        invoice: invoice,
        format: 'pdf',
        template: invoice.template || 'standard'
      });
    }

    // Send email using tenant's email integration
    const emailResponse = await fetch(`${origin}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': process.env.INTERNAL_API_KEY || '',
      },
      body: JSON.stringify({
        tenantId: tenantId,
        userId: actorUserId,
        to: recipients,
        subject: subject || `Invoice ${invoice.invoice_number}`,
        text: message || `Please find attached invoice ${invoice.invoice_number} for ${invoice.total} ${invoice.currency}.`,
        attachments: attachPDF ? [{
          filename: `Invoice_${invoice.invoice_number}.pdf`,
          content: pdfBuffer?.toString('base64'),
          contentType: 'application/pdf',
        }] : undefined
      })
    });

    if (!emailResponse.ok) {
      return { success: false, error: 'Failed to send invoice' };
    }

    // Update invoice status
    await supabase
      .from('invoices')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    return {
      success: true,
      message: 'Invoice sent successfully'
    };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function recordPayment(tenantId: string, config: any, supabase: any) {
  try {
    const { invoiceId, amount, paymentDate, paymentMethod, reference, notes } = config;

    // Record payment
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        amount: amount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: reference,
        notes: notes,
        status: 'completed',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update invoice status
    const { data: invoice } = await supabase
      .from('invoices')
      .select('total, paid_amount')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    const newPaidAmount = (invoice?.paid_amount || 0) + amount;
    const newStatus = newPaidAmount >= invoice?.total ? 'paid' : newPaidAmount > 0 ? 'partial' : 'draft';

    await supabase
      .from('invoices')
      .update({ 
        paid_amount: newPaidAmount,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    // Update accounting system
    await updateAccountingSystem(tenantId, {
      type: 'payment',
      invoiceId: invoiceId,
      paymentId: payment.id,
      amount: amount,
      paymentMethod: paymentMethod,
      status: 'completed'
    }, supabase);

    return {
      success: true,
      data: payment,
      message: 'Payment recorded successfully'
    };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function createExpense(tenantId: string, config: any, supabase: any) {
  try {
    const {
      categoryId,
      amount,
      currency = 'USD',
      description,
      date,
      receipt,
      notes,
      tags
    } = config;

    // Generate expense number
    const expenseNumber = await generateExpenseNumber(tenantId, supabase);

    // Create expense
    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        tenant_id: tenantId,
        expense_number: expenseNumber,
        category_id: categoryId,
        amount: amount,
        currency: currency,
        description: description,
        date: date,
        receipt: receipt,
        notes: notes,
        tags: tags,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        categories:category_id(id, name, description)
      `)
      .single();

    if (error) throw error;

    // Update accounting system
    await updateAccountingSystem(tenantId, {
      type: 'expense',
      expenseId: expense.id,
      amount: amount,
      currency: currency,
      category: expense.categories?.name,
      status: 'pending'
    }, supabase);

    return {
      success: true,
      data: expense,
      message: 'Expense created successfully'
    };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function getExpenses(tenantId: string, config: any, supabase: any) {
  try {
    const { page = 1, limit = 10, status, categoryId, dateRange } = config;

    let query = supabase
      .from('expenses')
      .select(`
        *,
        categories:category_id(id, name, description)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (status) {
      query = query.eq('status', status);
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (dateRange) {
      query = query.gte('date', dateRange.start).lte('date', dateRange.end);
    }

    const { data: expenses, error, count } = await query
      .order('date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    return {
      success: true,
      data: {
        expenses: expenses || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function getFinancialSummary(tenantId: string, config: any, supabase: any) {
  try {
    const { startDate, endDate } = config;

    // Get revenue from invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('total, paid_amount, status, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    // Get expenses
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, status, date')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate);

    // Calculate totals
    const totalRevenue = invoices?.reduce((sum: number, inv: any) => sum + (inv.paid_amount || 0), 0) || 0;
    const totalExpenses = expenses?.reduce((sum: number, exp: any) => sum + exp.amount, 0) || 0;
    const netProfit = totalRevenue - totalExpenses;

    // Get leads and deals for revenue tracking
    const { data: leads } = await supabase
      .from('leads')
      .select('id, status, value, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const { data: deals } = await supabase
      .from('deals')
      .select('id, status, value, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    return {
      success: true,
      data: {
        revenue: {
          total: totalRevenue,
          invoiced: invoices?.reduce((sum: number, inv: any) => sum + inv.total, 0) || 0,
          paid: totalRevenue,
          pending: invoices?.reduce((sum: number, inv: any) => sum + (inv.total - (inv.paid_amount || 0)), 0) || 0
        },
        expenses: {
          total: totalExpenses,
          pending: expenses?.filter((exp: any) => exp.status === 'pending').reduce((sum: number, exp: any) => sum + exp.amount, 0) || 0,
          approved: expenses?.filter((exp: any) => exp.status === 'approved').reduce((sum: number, exp: any) => sum + exp.amount, 0) || 0
        },
        profit: {
          gross: totalRevenue,
          net: netProfit,
          margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
        },
        leads: {
          total: leads?.length || 0,
          converted: leads?.filter((lead: any) => lead.status === 'converted').length || 0,
          value: leads?.reduce((sum: number, lead: any) => sum + (lead.value || 0), 0) || 0
        },
        deals: {
          total: deals?.length || 0,
          won: deals?.filter((deal: any) => deal.status === 'won').length || 0,
          value: deals?.reduce((sum: number, deal: any) => sum + (deal.value || 0), 0) || 0
        }
      }
    };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

async function generateInvoiceNumber(tenantId: string, supabase: any) {
  const { data: lastInvoice } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.invoice_number.replace(/\D/g, ''));
    return `INV-${String(lastNumber + 1).padStart(6, '0')}`;
  } else {
    return 'INV-000001';
  }
}

async function generateExpenseNumber(tenantId: string, supabase: any) {
  const { data: lastExpense } = await supabase
    .from('expenses')
    .select('expense_number')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (lastExpense) {
    const lastNumber = parseInt(lastExpense.expense_number.replace(/\D/g, ''));
    return `EXP-${String(lastNumber + 1).padStart(6, '0')}`;
  } else {
    return 'EXP-000001';
  }
}

async function updateAccountingSystem(tenantId: string, transaction: any, supabase: any) {
  // Update accounting records
  await supabase
    .from('accounting_transactions')
    .insert({
      tenant_id: tenantId,
      type: transaction.type,
      reference_id: transaction.invoiceId || transaction.expenseId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      metadata: transaction,
      created_at: new Date().toISOString()
    });
}

async function generateInvoicePDF(params: any) {
  const { invoice, format, template } = params;
  if (format !== 'pdf') {
    return Buffer.from(`Invoice ${invoice.invoice_number}`);
  }
  
  const htmlContent = generateInvoiceHTML(invoice, template);
  const { page, close } = await BrowserManager.createPage();
  try {
    await page.setContent(htmlContent, { waitUntil: 'networkidle', timeout: 30000 });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '25.4mm',
        right: '25.4mm',
        bottom: '25.4mm',
        left: '25.4mm',
      },
    });
    return Buffer.from(pdf);
  } finally {
    await close().catch(() => undefined);
  }
}

function generateInvoiceHTML(invoice: any, template: string) {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const rows = items.map((item: any) => {
    const qty = Number(item.quantity || 0);
    const unit = Number(item.unitPrice || 0);
    const total = qty * unit;
    return `<tr>
      <td>${item.description || item.name || 'Line Item'}</td>
      <td style="text-align:right;">${qty}</td>
      <td style="text-align:right;">${unit.toFixed(2)}</td>
      <td style="text-align:right;">${total.toFixed(2)}</td>
    </tr>`;
  }).join('');

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; }
          th { background: #f8fafc; text-align: left; }
          .total { margin-top: 16px; text-align: right; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Invoice ${invoice.invoice_number}</h1>
          <p>Client: ${invoice.clients?.name || 'Client'}</p>
          <p>Due Date: ${invoice.due_date || '-'}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align:right;">Qty</th>
              <th style="text-align:right;">Unit</th>
              <th style="text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <p class="total">Total: ${Number(invoice.total || 0).toFixed(2)} ${invoice.currency || 'USD'}</p>
      </body>
    </html>
  `;
}

async function createDefaultChartOfAccounts(tenantId: string, supabase: any) {
  try {
    const { error } = await supabase.rpc('create_default_chart_of_accounts', {
      p_tenant_id: tenantId,
    });
    if (error) throw error;
    return { success: true, error: null };
  } catch (error: any) {
    return operationFailed('accounting/management', error);
  }
}

