'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Instagram, Linkedin, Loader2, Save, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function ZernioIntegration() {
  const { currentTenant, refreshTenants } = useTenant();
  const [instagramAccountId, setInstagramAccountId] = useState('');
  const [linkedinOrgAccountId, setLinkedinOrgAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const zernio = (currentTenant?.settings as any)?.zernio;
    if (zernio) {
      setInstagramAccountId(zernio.instagramAccountId || '');
      setLinkedinOrgAccountId(zernio.linkedinOrgAccountId || '');
    }
  }, [currentTenant?.id, currentTenant?.settings]);

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    try {
      const updatedSettings = {
        ...(currentTenant.settings as any),
        zernio: {
          ...((currentTenant.settings as any)?.zernio || {}),
          instagramAccountId: instagramAccountId.trim() || undefined,
          linkedinOrgAccountId: linkedinOrgAccountId.trim() || undefined,
        },
      };
      const { error } = await supabase
        .from('tenants')
        .update({ settings: updatedSettings })
        .eq('id', currentTenant.id);
      if (error) throw error;
      await refreshTenants();
      toast.success('Zernio social accounts saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="ac-workspace-panel rounded-lg overflow-hidden"
    >
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Share2 className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Workspace Connector</div>
            <h2 className="text-lg font-bold text-white">Zernio Social Publishing</h2>
            <p className="text-sm text-slate-400">
              Connect Instagram and LinkedIn company pages in your Zernio dashboard, then paste account IDs here.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
            <Instagram className="w-3.5 h-3.5" /> Instagram Account ID
          </label>
          <input
            type="text"
            value={instagramAccountId}
            onChange={(e) => setInstagramAccountId(e.target.value)}
            placeholder="From Zernio → Instagram channel"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/40"
          />
          <p className="text-xs text-slate-600">Scheduled Instagram posts publish through Zernio.</p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
            <Linkedin className="w-3.5 h-3.5" /> LinkedIn Company Page Account ID
          </label>
          <input
            type="text"
            value={linkedinOrgAccountId}
            onChange={(e) => setLinkedinOrgAccountId(e.target.value)}
            placeholder="From Zernio → LinkedIn org channel"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/40"
          />
          <p className="text-xs text-slate-600">Company page posts route through Zernio when an org is selected.</p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-500 text-white font-bold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Social Accounts
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
