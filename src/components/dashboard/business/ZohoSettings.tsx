'use client';

import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, Zap, RefreshCw, X, User, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';

const ZohoSettings: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        checkConnection(session.user.id);
      }
    };
    fetchSession();
  }, []);

  const checkConnection = async (uid: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/zoho/enhanced?userId=${uid}&action=get_account_info`);
      const data = await response.json();
      if (response.ok && data.success) {
        setIsConnected(true);
        setAccountInfo(data.data);
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      console.error('Connection check failed:', err);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const connectToZoho = () => {
    if (!userId) {
      toast.error('User session not found');
      return;
    }
    window.location.href = `/api/auth/zoho/connect?userId=${userId}`;
  };

  const disconnect = async () => {
    const toastId = toast.loading('Disconnecting...');
    try {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('user_id', userId)
        .eq('type', 'zoho');
      
      if (error) throw error;
      
      setIsConnected(false);
      setAccountInfo(null);
      toast.success('Disconnected from Zoho Mail', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to disconnect: ' + err.message, { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center bg-slate-900/50 rounded-2xl border border-slate-700">
        <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
      <div className="p-6 border-b border-white/5 bg-gradient-to-r from-sky-500/10 to-transparent">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Zoho Mail</h2>
              <p className="text-slate-400 text-xs mt-0.5">Integration for professional email management.</p>
            </div>
          </div>
          {isConnected && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {!isConnected ? (
          <div className="max-w-md mx-auto text-center py-4">
            <h3 className="text-lg font-bold text-white mb-2">Connect Your Account</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Connect your Zoho Mail account to manage your inbox, send professional replies, and track communications directly from AlphaClone.
            </p>
            <button
              onClick={connectToZoho}
              className="inline-flex items-center gap-2 px-8 py-3 bg-sky-500 hover:bg-sky-400 text-white font-black rounded-xl shadow-xl shadow-sky-500/20 transition-all hover:scale-[1.02]"
            >
              <Zap className="w-4 h-4" />
              Connect Zoho Mail
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sky-400 font-bold border border-white/10">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-bold">{accountInfo?.displayName || 'Zoho User'}</p>
                  <p className="text-slate-500 text-xs">{accountInfo?.email}</p>
                </div>
              </div>
              <button
                onClick={() => checkConnection(userId)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                title="Refresh Status"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">
                Manage your emails in the <span className="text-white font-semibold">Messages</span> tab.
              </p>
              <button
                onClick={disconnect}
                className="text-red-500 hover:text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg text-sm font-bold transition-all"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZohoSettings;
