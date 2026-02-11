import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, XCircle } from 'lucide-react';
import { gmailService } from '../../../services/gmailService';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';

interface GmailIntegrationProps {
    user: any; // Using any to avoid import cycles for now, or import UserType
}

const GmailIntegration: React.FC<GmailIntegrationProps> = ({ user }) => {
    // const { user } = useAuth(); // Removed useAuth usage for user
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);

    useEffect(() => {
        if (user) {
            checkConnection();
        } else {
            setLoading(false); // Stop loading if no user
        }
    }, [user]);

    const checkConnection = async () => {
        if (!user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const connected = await gmailService.checkIntegration(user.id);
            setIsConnected(connected);
        } catch (err) {
            console.error('Check Gmail connection error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        if (!user) return;
        setConnecting(true);
        // Redirect to our connect API route
        window.location.href = `/api/auth/google/gmail/connect?userId=${user.id}`;
    };

    const handleDisconnect = async () => {
        if (!user || !window.confirm('Are you sure you want to disconnect Gmail? You will no longer be able to read or send emails from AlphaClone.')) return;

        try {
            const { error } = await supabase
                .from('gmail_sync_tokens')
                .delete()
                .eq('user_id', user.id);

            if (error) throw error;
            setIsConnected(false);
            toast.success('Gmail disconnected successfully.');
        } catch (err: any) {
            console.error('Disconnect error:', err);
            toast.error('Failed to disconnect Gmail');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 bg-slate-900/50 rounded-2xl border border-slate-800">
                <RefreshCw className="w-5 h-5 animate-spin text-teal-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-bold mb-4">Gmail Integration</h3>
                <p className="text-slate-400 mb-6">
                    Connect your individual Gmail account to manage your communications directly within the AlphaClone Business OS.
                </p>
            </div>

            <div className={`p-6 rounded-2xl border ${isConnected ? 'bg-teal-500/5 border-teal-500/20' : 'bg-slate-900/50 border-slate-800'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-800 text-slate-500'}`}>
                            <Mail className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-white">
                                    {isConnected ? 'Gmail Connected' : 'Gmail Not Connected'}
                                </h4>
                                {isConnected ? (
                                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-slate-500" />
                                )}
                            </div>
                            <p className="text-sm text-slate-400 max-w-md">
                                {isConnected
                                    ? `Successfully linked to your Gmail account. You can now access your Inbox and send emails from the Gmail tab.`
                                    : 'Connect your account to allow AlphaClone to list and send emails on your behalf.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {isConnected ? (
                            <>
                                <button
                                    onClick={handleConnect}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Reconnect
                                </button>
                                <button
                                    onClick={handleDisconnect}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-bold rounded-lg transition-all"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Disconnect
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleConnect}
                                disabled={connecting}
                                className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {connecting ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Mail className="w-4 h-4" />
                                )}
                                {connecting ? 'CONNECTING...' : 'CONNECT GMAIL'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GmailIntegration;
