'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { fileUploadService } from '@/services/fileUploadService';

interface RecordFilesTabProps {
  clientId?: string;
  dealId?: string;
  companyId?: string;
}

export default function RecordFilesTab({ clientId, dealId, companyId }: RecordFilesTabProps) {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<Array<{ id: string; name: string; url?: string; created_at: string; source: string }>>([]);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const results: typeof files = [];

      let uploadQuery = supabase
        .from('file_uploads')
        .select('id, original_filename, storage_path, created_at, entity_type, entity_id')
        .eq('tenant_id', currentTenant.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (clientId) uploadQuery = uploadQuery.eq('entity_id', clientId);
      else if (dealId) uploadQuery = uploadQuery.eq('entity_id', dealId);
      else if (companyId) uploadQuery = uploadQuery.eq('entity_id', companyId);

      const { data: uploads } = await uploadQuery;
      for (const row of uploads || []) {
        results.push({
          id: row.id,
          name: row.original_filename || 'File',
          url: row.storage_path ? fileUploadService.getProxiedUrl('uploads', row.storage_path) : undefined,
          created_at: row.created_at,
          source: 'upload',
        });
      }

      if (clientId) {
        const { data: contracts } = await supabase
          .from('contracts')
          .select('id, title, created_at')
          .eq('tenant_id', currentTenant.id)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(20);
        for (const c of contracts || []) {
          results.push({
            id: c.id,
            name: c.title || 'Contract',
            created_at: c.created_at,
            source: 'contract',
          });
        }
      }

      setFiles(results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, clientId, dealId, companyId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
      </div>
    );
  }

  if (!files.length) {
    return <p className="text-sm text-slate-500 py-8 text-center">No files linked to this record yet.</p>;
  }

  return (
    <div className="divide-y divide-white/5 bg-slate-900 border border-white/5 rounded-xl overflow-hidden">
      {files.map((file) => (
        <div key={`${file.source}-${file.id}`} className="flex items-center justify-between px-4 py-3 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="text-white truncate">{file.name}</span>
            <span className="text-[10px] uppercase text-slate-500 shrink-0">{file.source}</span>
          </div>
          {file.url && (
            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 shrink-0 ml-2">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
