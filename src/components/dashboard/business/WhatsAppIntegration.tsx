'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Loader2, Save, MessageSquare, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import { useTenant } from '@/contexts/TenantContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function WhatsAppIntegration() {
  const { currentTenant, refreshTenants } = useTenant();
  const router = useRouter();

  const [zernioAccountId, setZernioAccountId] = useState('');
  const [savingZernio, setSavingZernio] = useState(false);
  const [checking, setChecking] = useState(true);
  const [platformReady, setPlatformReady] = useState(false);

  useEffect(() => {
    if (currentTenant?.id) {
      const zernio = (currentTenant.settings as any)?.zernio;
      setZernioAccountId(zernio?.whatsappAccountId || zernio?.accountId || '');
      setChecking(false);
    }
  }, [currentTenant?.id, currentTenant?.settings]);

  useEffect(() => {
    fetch('/api/integrations/whatsapp/status')
      .then((r) => r.json())
      .then((d) => setPlatformReady(!!d.zernioConfigured))
      .catch(() => setPlatformReady(false));
  }, []);

  const handleSaveZernio = async () => {
    if (!currentTenant?.id) return;
    if (!zernioAccountId.trim()) {
      toast.error('Enter your Zernio WhatsApp account ID');
      return;
    }
    setSavingZernio(true);
    try {
      const updatedSettings = {
        ...(currentTenant.settings as any),
        zernio: {
          ...((currentTenant.settings as any)?.zernio || {}),
          whatsappAccountId: zernioAccountId.trim(),
        },
      };
      const { error } = await supabase
        .from('tenants')
        .update({ settings: updatedSettings })
        .eq('id', currentTenant.id);
      if (error) throw error;
      await refreshTenants();
      toast.success('WhatsApp connected via Zernio');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSavingZernio(false);
    }
  };

  const isConnected = !!zernioAccountId.trim() && platformReady;

  if (checking) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-teal-400 mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading WhatsApp settings...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden"
    >
      <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">WhatsApp via Zernio</h2>
            <p className="text-sm text-slate-400">
              Connect WhatsApp in your Zernio dashboard, then paste your account ID below.
            </p>
          </div>
        </div>
        {isConnected && (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Connected
          </span>
        )}
      </div>

      {!platformReady && (
        <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-sm">
          Platform Zernio API key is not configured. Contact your administrator to add <code className="text-amber-200">ZERNIO_API_KEY</code> to the server.
        </div>
      )}

      <div className="p-6 space-y-5">
        <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
          <li>Log in to <a href="https://zernio.com" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline inline-flex items-center gap-1">Zernio <ExternalLink className="w-3 h-3" /></a></li>
          <li>Connect your WhatsApp Business number</li>
          <li>Copy your WhatsApp <strong className="text-slate-300">Account ID</strong></li>
          <li>Paste it below and save</li>
        </ol>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={zernioAccountId}
            onChange={(e) => setZernioAccountId(e.target.value)}
            placeholder="Zernio WhatsApp account ID"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-white outline-none focus:border-teal-500/40"
          />
          <Button
            onClick={handleSaveZernio}
            disabled={savingZernio}
            className="bg-teal-600 hover:bg-teal-500 text-white font-bold shrink-0"
          >
            {savingZernio ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save & Connect
          </Button>
        </div>

        {isConnected && (
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/business/whatsapp')}
            className="w-full border-teal-500/30 text-teal-400 hover:bg-teal-500/10"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Open WhatsApp Inbox
          </Button>
        )}
      </div>
    </motion.div>
  );
}
