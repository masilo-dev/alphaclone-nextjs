'use client';

import React, { useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { quoteVersionService, type QuoteVersion } from '@/services/quoteVersionService';
import toast from 'react-hot-toast';

interface QuoteVersionPanelProps {
  quoteId: string;
  userId: string;
}

export function QuoteVersionPanel({ quoteId, userId }: QuoteVersionPanelProps) {
  const [versions, setVersions] = useState<QuoteVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!quoteId) return;
    void quoteVersionService
      .getVersionHistory(quoteId)
      .then((data) => setVersions(data || []))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [quoteId]);

  const handleRestore = async (version: number) => {
    const result = await quoteVersionService.restoreVersion(quoteId, version, userId);
    if (result.success) {
      toast.success(`Restored version ${version}`);
    } else {
      toast.error(result.error || 'Could not restore version');
    }
  };

  if (loading) return null;
  if (versions.length === 0) return null;

  return (
    <div className="ac-workspace-panel p-3 mt-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)] flex items-center gap-1.5 mb-2">
        <History className="w-3.5 h-3.5" aria-hidden="true" />
        Version history
      </h4>
      <ul className="space-y-1.5">
        {versions.map((v) => (
          <li key={v.version} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="text-[var(--ws-text-secondary)]">
              Version {v.version} · {new Date(v.created_at).toLocaleDateString()}
            </span>
            <button
              type="button"
              onClick={() => handleRestore(v.version)}
              className="text-teal-400 hover:text-teal-300 flex items-center gap-1 text-[11px]"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              Restore
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default QuoteVersionPanel;
