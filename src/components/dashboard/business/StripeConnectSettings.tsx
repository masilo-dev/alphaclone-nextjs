import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, XCircle, ShieldCheck } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { Button } from '../../ui/UIComponents';
import toast from 'react-hot-toast';

const StripeConnectSettings: React.FC = () => {
    const { currentTenant, refreshTenants } = useTenant();
    const [loading, setLoading] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);

    const isConnected = currentTenant?.stripe_connect_id && currentTenant?.stripe_connect_onboarded;
    const isPending = currentTenant?.stripe_connect_id && !currentTenant?.stripe_connect_onboarded;

    const handleConnect = async () => {
        if (!currentTenant) return;
        setLoading(true);
        try {
            const response = await fetch('/api/stripe/connect/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    returnUrl: window.location.href + '&connect=success',
                    refreshUrl: window.location.href + '&connect=refresh',
                })
            });

            const { url, error } = await response.json();
            if (url) {
                window.location.href = url;
            } else {
                throw new Error(error || 'Failed to get onboarding link');
            }
        } catch (err: any) {
            console.error('Connect error:', err);
            toast.error(err.message || 'Failed to initiate Stripe Connect');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!currentTenant?.stripe_connect_id) return;
        setLoginLoading(true);
        try {
            const response = await fetch('/api/stripe/connect/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant.id })
            });

            const { url, error } = await response.json();
            if (url) {
                window.location.href = url;
            } else {
                throw new Error(error || 'Failed to get login link');
            }
        } catch (err: any) {
            console.error('Login error:', err);
            toast.error('Failed to access Stripe dashboard');
        } finally {
            setLoginLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-bold mb-4">Payment Processing (Stripe Connect)</h3>
                <p className="text-slate-400 mb-6">
                    Connect your Stripe account to receive payments directly from your clients. AlphaClone does not take any percentage of your transactions.
                </p>
            </div>

            <div className={`p-6 rounded-2xl border ${isConnected ? 'bg-teal-500/5 border-teal-500/20' : isPending ? 'bg-amber-500/5 border-amber-500/20' : 'bg-slate-900/50 border-slate-800'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-teal-500/10 text-teal-400' : isPending ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-white">
                                    {isConnected ? 'Stripe Connected' : isPending ? 'Connection Pending' : 'Stripe Not Connected'}
                                </h4>
                                {isConnected ? (
                                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                                ) : isPending ? (
                                    <AlertCircle className="w-4 h-4 text-amber-400" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-slate-500" />
                                )}
                            </div>
                            <p className="text-sm text-slate-400 max-w-md">
                                {isConnected
                                    ? `Your account is ready to receive payments. Manage your funds and verification in the Stripe Express dashboard.`
                                    : isPending
                                        ? 'Your account link is created but onboarding is incomplete. Please finish the setup to start receiving payments.'
                                        : 'Link your business account to enable automated invoicing and payment collection.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {isConnected ? (
                            <button
                                onClick={handleLogin}
                                disabled={loginLoading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loginLoading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <ExternalLink className="w-4 h-4" />
                                )}
                                {loginLoading ? 'OPENING...' : 'STRIPE DASHBOARD'}
                            </button>
                        ) : (
                            <button
                                onClick={handleConnect}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4" />
                                )}
                                {loading ? 'INITIATING...' : isPending ? 'FINISH SETUP' : 'CONNECT STRIPE'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <div className="p-4 bg-slate-900/30 border border-slate-800/50 rounded-xl">
                    <h5 className="text-sm font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-teal-400" />
                        0% Platform Fee
                    </h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        AlphaClone does not touch your money. All payments go directly from your clients to your Stripe account.
                    </p>
                </div>
                <div className="p-4 bg-slate-900/30 border border-slate-800/50 rounded-xl">
                    <h5 className="text-sm font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-teal-400" />
                        Secure & Verified
                    </h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Industry-standard encryption and identity verification powered by Stripe, for your peace of mind.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StripeConnectSettings;
