'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  Loader2,
  Save,
  MessageSquare,
  ExternalLink,
  CheckCircle2,
  Trash2,
  HelpCircle,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import { useTenant } from '@/contexts/TenantContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

type WhatsAppProvider = 'meta' | 'zernio';

export default function WhatsAppIntegration() {
  const { currentTenant } = useTenant();
  const router = useRouter();

  const [provider, setProvider] = useState<WhatsAppProvider>('meta');
  const [wabaId, setWabaId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [alias, setAlias] = useState('My WhatsApp Cloud Business Line');

  const [activeIntegration, setActiveIntegration] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [metaConfigured, setMetaConfigured] = useState(false);

  const fetchIntegration = async () => {
    if (!currentTenant?.id) return;
    try {
      const res = await fetch(`/api/integrations/whatsapp?tenantId=${currentTenant.id}`);
      if (!res.ok) {
        console.warn('WhatsApp API not available, showing idle state');
        setActiveIntegration(null);
        return;
      }
      const data = await res.json();
      if (data?.success && data?.integrations?.length > 0) {
        setActiveIntegration(data.integrations[0]);
      } else {
        setActiveIntegration(null);
      }
    } catch (err) {
      console.error('Failed to load integration:', err);
      setActiveIntegration(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTenant?.id) {
      fetchIntegration();
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    fetch('/api/integrations/whatsapp/status')
      .then((r) => r.json())
      .then((d) => setMetaConfigured(!!d.metaConfigured))
      .catch(() => setMetaConfigured(false));
  }, []);

  useEffect(() => {
    if (!activeIntegration) {
      setProvider('meta');
      return;
    }

    setProvider((activeIntegration.provider || activeIntegration.metadata?.provider || 'meta') as WhatsAppProvider);
    setAlias(activeIntegration.alias || 'My WhatsApp Cloud Business Line');
  }, [activeIntegration]);

  const handleSave = async () => {
    if (!currentTenant?.id) return;

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        tenantId: currentTenant.id,
        alias: alias.trim(),
        provider,
      };

      if (provider === 'zernio') {
        const zernioAccountId = (currentTenant?.settings as any)?.zernio?.whatsappAccountId;
        if (!zernioAccountId?.trim()) {
          toast.error('Add a WhatsApp account ID in Settings → Zernio first');
          return;
        }
        payload.wabaId = zernioAccountId.trim();
      } else {
        if (!wabaId.trim() || !phoneNumberId.trim() || !accessToken.trim()) {
          toast.error('WABA ID, Phone Number ID, and Access Token are required');
          return;
        }
        payload.wabaId = wabaId.trim();
        payload.phoneNumberId = phoneNumberId.trim();
        payload.accessToken = accessToken.trim();
      }

      const res = await fetch('/api/integrations/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save configuration');
      }

      toast.success(provider === 'zernio' ? 'Zernio WhatsApp connected!' : 'WhatsApp Business Cloud API connected!');

      if (data?.webhookWarning) {
        setTimeout(() => toast(data.webhookWarning, { icon: '⚠️', duration: 8000 }), 1000);
      }

      await fetchIntegration();
      setWabaId('');
      setPhoneNumberId('');
      setAccessToken('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentTenant?.id || !activeIntegration?.id) return;
    if (!confirm('Are you sure you want to disconnect this WhatsApp integration? Outbound messages will stop working.')) return;

    setDisconnecting(true);
    try {
      const res = await fetch(`/api/integrations/whatsapp?tenantId=${currentTenant.id}&id=${activeIntegration.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to disconnect');
      }

      toast.success('WhatsApp disconnected successfully');
      setActiveIntegration(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="ac-workspace-panel rounded-lg p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-teal-400 mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading WhatsApp settings...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="ac-workspace-panel rounded-lg overflow-hidden"
    >
      <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Workspace Connector</div>
            <h2 className="text-lg font-bold text-white">WhatsApp Integration</h2>
            <p className="text-sm text-slate-400">
              Choose Meta Cloud API or Zernio routing for your WhatsApp inbox.
            </p>
          </div>
        </div>
        {activeIntegration && (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Connected
          </span>
        )}
      </div>

      {!metaConfigured && (
        <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-sm">
          Platform webhook signatures are not fully verified. Ask your administrator to set up <code className="text-amber-200">FACEBOOK_VERIFY_TOKEN</code> and <code className="text-amber-200">FACEBOOK_APP_SECRET</code> in Railway environment variables to fully secure your inbound webhooks.
        </div>
      )}

      <div className="p-6 space-y-6">
        {activeIntegration ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-950/45 border border-white/5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Active Integration: {activeIntegration.alias}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
                <div>
                  <span className="block text-slate-500">Provider</span>
                  <code className="text-slate-300 font-mono">{String(activeIntegration.provider || activeIntegration.metadata?.provider || 'meta')}</code>
                </div>
                <div>
                  <span className="block text-slate-500">WABA ID</span>
                  <code className="text-slate-300 font-mono">{activeIntegration.waba_id}</code>
                </div>
                <div>
                  <span className="block text-slate-500">Phone Number ID</span>
                  <code className="text-slate-300 font-mono">{activeIntegration.phone_number_id || 'n/a'}</code>
                </div>
                <div>
                  <span className="block text-slate-500">Access Token</span>
                  <code className="text-slate-300 font-mono">{activeIntegration.access_token || 'managed by provider'}</code>
                </div>
                <div>
                  <span className="block text-slate-500">Webhook Status</span>
                  {activeIntegration.webhook_verified ? (
                    <span className="text-emerald-400 font-semibold">✓ Registered to platform</span>
                  ) : (
                    <span className="text-amber-400 font-semibold">⚠ Not yet subscribed</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/business/whatsapp')}
                className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Open WhatsApp Inbox
              </Button>
              <Button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400"
              >
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                Connection Steps
              </h3>
              {provider === 'meta' ? (
                <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
                  <li>
                    Log in to the{' '}
                    <a
                      href="https://developers.facebook.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline inline-flex items-center gap-1"
                    >
                      Meta Developer Portal <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Create or select your Meta Business App.</li>
                  <li>Add the <strong>WhatsApp</strong> product to your App.</li>
                  <li>Go to <strong>API Setup</strong> and copy your <strong>Phone Number ID</strong> and <strong>WhatsApp Business Account ID</strong>.</li>
                  <li>Generate a <strong>System User Access Token</strong> with <code className="text-emerald-300">whatsapp_business_messaging</code>.</li>
                  <li>Enter the values below to connect.</li>
                </ol>
              ) : (
                <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
                  <li>Save your WhatsApp account ID in <strong>Settings → Zernio</strong>.</li>
                  <li>Make sure the Zernio WhatsApp inbox is enabled for this tenant.</li>
                  <li>Choose a display name, then connect this tenant to Zernio routing.</li>
                </ol>
              )}
            </div>

            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    1-Click Meta Automatic Connect
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Log in with your Meta account to connect your WhatsApp Business lines automatically without manual keys.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    if (!currentTenant?.id) return;
                    window.location.href = `/api/auth/facebook/connect?tenant_id=${encodeURIComponent(currentTenant.id)}&return_to=${encodeURIComponent('/dashboard/business/whatsapp')}`;
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 text-xs flex items-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Log in with Meta
                </Button>
              </div>
            </div>

            <div className="space-y-4 border-t border-white/5 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProvider('meta')}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    provider === 'meta'
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-slate-700 bg-slate-900/40 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Settings2 className="w-4 h-4 text-emerald-400" />
                    Meta Cloud API
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Use your own WhatsApp Business App and token.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('zernio')}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    provider === 'zernio'
                      ? 'border-violet-500/40 bg-violet-500/10'
                      : 'border-slate-700 bg-slate-900/40 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Settings2 className="w-4 h-4 text-violet-400" />
                    Zernio Routing
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Use the tenant's Zernio WhatsApp account.</p>
                </button>
              </div>

              {provider === 'meta' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">WhatsApp Business Account (WABA) ID</label>
                    <input
                      type="text"
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                      placeholder="e.g. 104857285918239"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Phone Number ID</label>
                    <input
                      type="text"
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      placeholder="e.g. 109827364528192"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Meta Access Token</label>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="EAABw..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500/40"
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-slate-300">
                  Zernio uses the WhatsApp account ID saved in <code className="text-violet-300">tenant.settings.zernio.whatsappAccountId</code>.
                  No Meta token or phone number ID is needed here.
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Display Name / Alias (Optional)</label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="e.g. Primary Support Line"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500/40"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 mt-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {provider === 'zernio' ? 'Connect Zernio WhatsApp Line' : 'Connect Meta WhatsApp Line'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

