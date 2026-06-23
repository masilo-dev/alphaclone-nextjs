'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Calendar, Receipt, Loader2, Paperclip } from 'lucide-react';
import {
  loadClientEmailContext,
  formatContextInsert,
  type ClientContextItem,
  type ClientContextItemType,
} from '@/lib/email/clientEmailContext';

const TYPE_META: Record<ClientContextItemType, { label: string; Icon: React.FC<{ className?: string }> }> = {
  contract: { label: 'Contracts', Icon: FileText },
  invoice: { label: 'Invoices', Icon: Receipt },
  receipt: { label: 'Receipts', Icon: Receipt },
  quote: { label: 'Quotes', Icon: FileText },
  proposal: { label: 'Proposals', Icon: FileText },
  meeting: { label: 'Meetings', Icon: Calendar },
  event: { label: 'Events', Icon: Calendar },
};

interface ClientEmailContextPickerProps {
  tenantId?: string;
  clientId?: string;
  email?: string;
  onInsert: (text: string) => void;
}

export function ClientEmailContextPicker({
  tenantId,
  clientId,
  email,
  onInsert,
}: ClientEmailContextPickerProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ClientContextItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!tenantId || (!clientId && !email)) {
      setItems([]);
      return;
    }

    let active = true;
    setLoading(true);
    void loadClientEmailContext(tenantId, { clientId, email })
      .then((loaded) => {
        if (active) {
          setItems(loaded);
          setSelectedIds(new Set());
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tenantId, clientId, email]);

  const grouped = useMemo(() => {
    const map = new Map<ClientContextItemType, ClientContextItem[]>();
    items.forEach((item) => {
      const list = map.get(item.type) || [];
      list.push(item);
      map.set(item.type, list);
    });
    return map;
  }, [items]);

  if (!tenantId || (!clientId && !email)) return null;

  const toggle = (id: string, type: ClientContextItemType) => {
    const key = `${type}:${id}`;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleInsert = () => {
    const selected = items.filter((item) => selectedIds.has(`${item.type}:${item.id}`));
    const text = formatContextInsert(selected);
    if (text) onInsert(text);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
          <Paperclip className="w-3.5 h-3.5 text-teal-400" />
          Include from workspace
        </div>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={handleInsert}
            className="text-[11px] font-bold text-teal-300 hover:text-teal-200"
          >
            Insert {selectedIds.size} reference{selectedIds.size === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading contracts, invoices, quotes, meetings...
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500">No linked documents yet for this contact.</p>
      ) : (
        <div className="space-y-3 max-h-44 overflow-y-auto custom-scrollbar">
          {Array.from(grouped.entries()).map(([type, groupItems]) => {
            const meta = TYPE_META[type];
            const Icon = meta.Icon;
            return (
              <div key={type}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 flex items-center gap-1">
                  <Icon className="w-3 h-3" />
                  {meta.label}
                </p>
                <div className="space-y-1">
                  {groupItems.map((item) => {
                    const key = `${item.type}:${item.id}`;
                    const checked = selectedIds.has(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${
                          checked
                            ? 'border-teal-500/30 bg-teal-500/10'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(item.id, item.type)}
                          className="mt-0.5 accent-teal-500"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-white truncate">{item.label}</span>
                          <span className="block text-[11px] text-slate-500 truncate">{item.detail}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
