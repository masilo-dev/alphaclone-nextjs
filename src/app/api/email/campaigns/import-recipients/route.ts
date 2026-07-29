import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
=======
import ExcelJS from 'exceljs';
>>>>>>> origin/main
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

type ParsedRecipient = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseCsv(text: string): Array<Record<string, string>> {
<<<<<<< HEAD
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const pushCell = () => {
    currentRow.push(currentCell);
    currentCell = '';
  };
  const pushRow = () => {
    pushCell();
    const hasContent = currentRow.some((cell) => cell.trim().length > 0);
    if (hasContent) rows.push(currentRow);
    currentRow = [];
  };

  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        const next = normalized[i + 1];
        if (next === '"') {
          currentCell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      pushCell();
      continue;
    }

    if (char === '\n') {
      pushRow();
      continue;
    }

    currentCell += char;
  }

  if (inQuotes) {
    inQuotes = false;
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    pushRow();
  }

  if (rows.length === 0) return [];
  const headers = (rows[0] || []).map((h) => String(h || '').trim()).filter(Boolean);
  if (headers.length === 0) return [];
  return rows.slice(1).map((cells) => {
=======
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = (lines[0] || '').split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
>>>>>>> origin/main
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = String(cells[index] || '').trim();
    });
    return row;
  });
}

function mapRows(rows: Array<Record<string, unknown>>): ParsedRecipient[] {
  const toValue = (row: Record<string, unknown>, aliases: string[]) => {
    const keys = Object.keys(row);
    for (const key of keys) {
      const normalized = normalizeHeader(key);
      if (aliases.includes(normalized)) {
        return String(row[key] || '').trim();
      }
    }
    return '';
  };

  const recipients = rows
    .map((row) => {
      const email = toValue(row, ['email', 'emailaddress', 'mail']);
      const name =
        toValue(row, ['name', 'fullname', 'contactname']) ||
        `${toValue(row, ['firstname', 'first'])} ${toValue(row, ['lastname', 'last'])}`.trim();
      const phone = toValue(row, ['phone', 'phonenumber', 'mobile']);
      const company = toValue(row, ['company', 'organization', 'business']);
      return { name: name || email, email: email.toLowerCase(), phone, company };
    })
    .filter((row) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email));

  const byEmail = new Map<string, ParsedRecipient>();
  recipients.forEach((row) => byEmail.set(row.email, row));
  return Array.from(byEmail.values());
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const tenantId = String(formData.get('tenantId') || '').trim();
    const file = formData.get('file') as File | null;

    if (!tenantId || !file) {
      return NextResponse.json({ error: 'tenantId and file are required', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

<<<<<<< HEAD
    const { admin } = await requireTenantAccess(tenantId);
=======
    await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();
>>>>>>> origin/main

    let rawRows: Array<Record<string, unknown>> = [];
    const isCsv = file.type.includes('csv') || file.name.toLowerCase().endsWith('.csv');
    if (isCsv) {
      const text = await file.text();
      rawRows = parseCsv(text);
    } else {
<<<<<<< HEAD
      return NextResponse.json(
        { error: 'Only CSV imports are supported. Please export as CSV and re-upload.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
=======
      const workbook = new ExcelJS.Workbook();
      const buffer = new Uint8Array(await file.arrayBuffer());
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return NextResponse.json({ error: 'Workbook has no sheets', code: 'VALIDATION_ERROR' }, { status: 400 });
      }
      const headerRow = worksheet.getRow(1);
      const headers = ((headerRow.values as unknown[]) || []).slice(1).map((v) => String(v || '').trim());
      for (let r = 2; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        const item: Record<string, unknown> = {};
        let hasData = false;
        headers.forEach((header, index) => {
          const value = row.getCell(index + 1).value as any;
          const normalizedValue = value && typeof value === 'object' && 'text' in value ? value.text : value;
          if (String(normalizedValue || '').trim()) hasData = true;
          item[header || `column${index + 1}`] = normalizedValue ?? '';
        });
        if (hasData) rawRows.push(item);
      }
>>>>>>> origin/main
    }

    const recipients = mapRows(rawRows);
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No valid rows with email were found', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const emails = recipients.map((r) => r.email);
    const { data: existingContacts } = await admin
      .from('contacts')
      .select('id, email')
      .eq('tenant_id', tenantId)
      .in('email', emails);
    const existingByEmail = new Map<string, string>(
      (existingContacts || []).map((c: any) => [String(c.email || '').toLowerCase(), String(c.id)])
    );

    const missing = recipients.filter((r) => !existingByEmail.has(r.email));
    if (missing.length > 0) {
      const insertRows = missing.map((r) => ({
        tenant_id: tenantId,
        email: r.email,
        full_name: r.name || r.email,
        phone: r.phone || null,
      }));
      const insertAttempt = await admin.from('contacts').insert(insertRows);
      if (insertAttempt.error) {
        const fallbackRows = missing.map((r) => {
          const parts = (r.name || '').trim().split(/\s+/).filter(Boolean);
          return {
            tenant_id: tenantId,
            email: r.email,
            first_name: parts[0] || null,
            last_name: parts.length > 1 ? parts.slice(1).join(' ') : null,
            phone: r.phone || null,
          };
        });
        await admin.from('contacts').insert(fallbackRows);
      }
    }

    const { data: refreshedContacts } = await admin
      .from('contacts')
      .select('id, email, full_name')
      .eq('tenant_id', tenantId)
      .in('email', emails);

    const contactByEmail = new Map<string, any>(
      (refreshedContacts || []).map((c: any) => [String(c.email || '').toLowerCase(), c])
    );

    // Best-effort sync to legacy entities for client/lead visibility.
    const clientRows = recipients.map((r) => ({
      tenant_id: tenantId,
      name: r.name || r.email,
      email: r.email,
      phone: r.phone || null,
      company: r.company || null,
      sales_stage: 'lead',
      value: 0,
      updated_at: new Date().toISOString(),
    }));
    await admin.from('business_clients').upsert(clientRows, { onConflict: 'tenant_id,email' });

    const leadRows = recipients.map((r) => ({
      tenant_id: tenantId,
      name: r.name || r.email,
      company: r.company || 'Unknown',
      email: r.email,
      phone: r.phone || null,
      source: 'Campaign import',
      status: 'new',
      notes: 'Imported from email recipient file upload',
    }));
    await admin.from('leads').upsert(leadRows, { onConflict: 'tenant_id,email' });

    const importedContacts = recipients
      .map((r) => {
        const contact = contactByEmail.get(r.email);
        if (!contact) return null;
        return {
          id: String(contact.id),
          name: String(contact.full_name || r.name || r.email),
          email: r.email,
          company: r.company || undefined,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      imported: importedContacts.length,
      contacts: importedContacts,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to import recipients', request);
  }
}
