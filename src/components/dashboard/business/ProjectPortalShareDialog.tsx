'use client';

import React, { useState } from 'react';
import { X, Copy, Link2, Lock, Calendar, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProjectPortalShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  tenantId: string;
  projectName: string;
}

const EXPIRY_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'Never', days: null },
] as const;

export function ProjectPortalShareDialog({
  isOpen,
  onClose,
  projectId,
  tenantId,
  projectName,
}: ProjectPortalShareDialogProps) {
  const [password, setPassword] = useState('');
  const [expiryDays, setExpiryDays] = useState<number | null>(30);
  const [shareUrl, setShareUrl] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleCreateLink = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/portal-share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          ...(password.trim() ? { password: password.trim() } : {}),
          expiresInDays: expiryDays ?? undefined,
          neverExpires: expiryDays === null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create link');

      setShareUrl(data.url);
      try {
        await navigator.clipboard.writeText(data.url);
        toast.success('Secure client link copied');
      } catch {
        toast.success('Client link ready — copy it below');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <p className="text-xs uppercase tracking-widest text-violet-400 font-bold">Share with client</p>
            <h3 className="text-white font-bold truncate">{projectName}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              <Lock className="w-3.5 h-3.5" /> Optional password
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank for open link"
              className="w-full h-10 bg-slate-900 border border-white/10 rounded-xl px-3 text-sm text-white outline-none focus:border-violet-400"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              <Calendar className="w-3.5 h-3.5" /> Link expires
            </label>
            <div className="grid grid-cols-2 gap-2">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setExpiryDays(opt.days)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    expiryDays === opt.days
                      ? 'bg-violet-600/20 border-violet-500/40 text-violet-200'
                      : 'bg-slate-900 border-white/5 text-slate-400 hover:border-white/15'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {shareUrl ? (
            <div className="rounded-xl bg-slate-900 border border-white/10 p-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1 flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Client URL
              </p>
              <p className="text-xs text-teal-300 break-all font-mono">{shareUrl}</p>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast.success('Copied'))}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-violet-300 hover:text-violet-200"
              >
                <Copy className="w-3.5 h-3.5" /> Copy again
              </button>
            </div>
          ) : null}
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white">
            Close
          </button>
          <button
            type="button"
            onClick={handleCreateLink}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            {shareUrl ? 'Regenerate link' : 'Create & copy link'}
          </button>
        </div>
      </div>
    </div>
  );
}
