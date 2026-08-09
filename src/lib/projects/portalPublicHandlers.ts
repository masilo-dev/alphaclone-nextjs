import 'server-only';

import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  evaluatePortalAccess,
  resolvePortalProject,
  toPublicProjectView,
  type PortalProjectRow,
} from '@/lib/projects/portalAccess';

export function readPortalPassword(req: NextRequest, bodyPassword?: string): string | undefined {
  const header = req.headers.get('x-portal-password')?.trim();
  if (header) return header;
  const fromBody = typeof bodyPassword === 'string' ? bodyPassword.trim() : '';
  return fromBody || undefined;
}

export async function loadPublicPortalContext(
  admin: SupabaseClient,
  token: string,
  password?: string
) {
  const { project, error } = await resolvePortalProject(admin, token);
  if (error || !project) {
    return { ok: false as const, status: 404, body: { error: 'Project not found' } };
  }

  const access = evaluatePortalAccess(project, password);
  if (!access.ok) {
    if (access.reason === 'expired') {
      return { ok: false as const, status: 410, body: { expired: true, error: 'Link expired' } };
    }
    if (access.reason === 'password_required') {
      return {
        ok: false as const,
        status: 401,
        body: { requiresPassword: true, projectName: project.name },
      };
    }
    if (access.reason === 'password_invalid') {
      return { ok: false as const, status: 401, body: { requiresPassword: true, error: 'Invalid password' } };
    }
    return { ok: false as const, status: 404, body: { error: 'Project not found' } };
  }

  return { ok: true as const, project };
}

export async function loadPublicPortalPayload(admin: SupabaseClient, project: PortalProjectRow) {
  const [{ data: milestones }, { data: invoices }] = await Promise.all([
    admin
      .from('project_milestones')
      .select('id, name, status, due_date, description, order_index')
      .eq('project_id', project.id)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true }),
    admin
      .from('business_invoices')
      .select('id, invoice_number, status, total, amount_paid, balance_due, currency, currency_code, due_date, paid_at')
      .eq('tenant_id', project.tenant_id)
      .eq('project_id', project.id)
      .order('created_at', { ascending: false }),
  ]);

  return {
    projectId: project.id,
    project: toPublicProjectView(project),
    milestones: milestones || [],
    invoices: (invoices || []).map((invoice: any) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      status: invoice.status,
      total: Number(invoice.total || 0),
      amountPaid: Number(invoice.amount_paid || 0),
      balanceDue: Number(invoice.balance_due ?? Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0))),
      currency: invoice.currency || invoice.currency_code || 'USD',
      dueDate: invoice.due_date,
      paidAt: invoice.paid_at,
      isPaid: String(invoice.status || '').toLowerCase() === 'paid' || Number(invoice.balance_due || 0) <= 0,
    })),
  };
}
