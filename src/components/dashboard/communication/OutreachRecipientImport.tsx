'use client';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { ImportRow } from '@/lib/import/recipientWorkbook';

type Preview = { records: ImportRow[]; invalid: number; duplicates: number; fileName: string };
export function OutreachRecipientImport({ tenantId, onImported }: { tenantId: string; onImported: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { setPreview(null); setBusy(false); setMessage(''); }, [tenantId]);
  const importKey = useRef('');
  const scope = useRef(tenantId); scope.current = tenantId;
  async function read(file?: File) {
    if (!file) return;
    setBusy(true); setMessage('Reading spreadsheet…');
    const workspace = tenantId;
    try {
      const data = new FormData(); data.set('tenantId', workspace); data.set('file', file);
      const response = await fetch('/api/crm/import?preview=true', { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Spreadsheet could not be read.');
      if (scope.current !== workspace) return;
      setPreview(result); importKey.current = crypto.randomUUID(); setMessage('');
    } catch (error) { if (scope.current === workspace) setMessage(error instanceof Error ? error.message : 'Import failed.'); }
    finally { if (scope.current === workspace) setBusy(false); }
  }
  async function importRows() {
    if (!preview) return;
    const workspace = tenantId;
    setBusy(true); setMessage('Adding recipients to CRM…');
    try {
      const response = await fetch('/api/crm/import', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: workspace, records: preview.records, fileName: preview.fileName, idempotencyKey: importKey.current }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Import could not start.');
      for (let attempt = 0; attempt < 60; attempt++) {
        if (scope.current !== workspace) return;
        const statusResponse = await fetch(`/api/crm/import?tenantId=${encodeURIComponent(workspace)}&jobId=${encodeURIComponent(result.job_id)}`);
        const status = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(status.error || 'Import status unavailable.');
        const job = status.job;
        if (['COMPLETED', 'FAILED', 'PARTIAL_SUCCESS'].includes(job?.status)) {
          setMessage(`${job.created_count || 0} processed; ${job.duplicate_count || 0} existing; ${job.failed_count || 0} failed.`);
          if (job.status === 'FAILED') throw new Error('CRM import failed. No email was sent.');
          setPreview(null); onImported(); toast.success('Recipients imported. Select them and review outreach before sending.'); return;
        }
        setMessage(`Importing ${job?.processed_records || 0} of ${job?.total_records || preview.records.length}…`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      setMessage('Import is still processing. Refresh the recipient list shortly.');
    } catch (error) { if (scope.current === workspace) setMessage(error instanceof Error ? error.message : 'Import failed.'); }
    finally { if (scope.current === workspace) setBusy(false); }
  }
  return <div className="mb-4 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] p-3 text-[var(--ws-text-primary)]">
    <label className="type-ui font-medium">Import Excel or CSV
      <input aria-label="Upload outreach recipient spreadsheet" className="mt-2 block w-full type-ui" type="file" accept=".xlsx,.csv" disabled={busy}
        onChange={event => { void read(event.target.files?.[0]); event.target.value = ''; }} />
    </label>
    <p className="mt-2 type-caption text-[var(--ws-text-secondary)]">Columns: Email, Name, Company, Phone. Up to 1,000 rows / 5 MB. Import adds CRM records; it sends no email.</p>
    {preview && <div className="mt-3">
      <p className="type-ui">{preview.records.length} valid recipients · {preview.invalid} invalid · {preview.duplicates} duplicates removed</p>
      <ul className="my-2 max-h-28 overflow-y-auto type-caption">{preview.records.slice(0, 10).map(row => <li key={row.email}>{row.name} — {row.email}</li>)}</ul>
      <button type="button" className="ac-workspace-action-btn" disabled={busy || !preview.records.length} onClick={() => void importRows()}>Add recipients to CRM</button>
      <button type="button" className="ac-workspace-action-btn ml-2" disabled={busy} onClick={() => setPreview(null)}>Cancel</button>
    </div>}
    {message && <p role="status" className="mt-2 type-ui text-[var(--ws-text-secondary)]">{message}</p>}
  </div>;
}
