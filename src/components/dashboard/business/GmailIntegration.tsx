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

    // Non-blocking loading
    // if (loading) {
    //     return (
    //         <div className="flex items-center justify-center p-8 bg-slate-900/50 rounded-2xl border border-slate-800">
    //             <RefreshCw className="w-5 h-5 animate-spin text-teal-500" />
    //         </div>
    //     );
    // }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-bold mb-4">Gmail Integration</h3>
                <p className="text-slate-400 mb-6">
                    Connect your individual Gmail account to manage your communications directly within the AlphaClone Business OS.
                </p>
            </div>

            <div className={`p-6 rounded-2xl border ${isConnected ? 'bg-teal-500/5 border-teal-500/20' : 'bg-slate-900/50 border-slate-800'} relative overflow-hidden`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-800 text-slate-500'}`}>
                            <Mail className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-white">
                                    Gmail Integration
                                </h4>
                                {isConnected ? (
                                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-slate-500" />
                                )}
                            </div>
                            <p className="text-sm text-slate-400 max-w-md">
                                {isConnected
                                    ? "Your Gmail account is connected. You can now manage your emails directly from the dashboard."
                                    : "Link your Gmail account to read and send emails directly within the AlphaClone Business OS."
                                }
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {isConnected ? (
                            <button
                                onClick={handleDisconnect}
                                className="flex items-center gap-2 px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black text-sm uppercase tracking-widest rounded-xl border border-red-500/20 transition-all"
                            >
                                <XCircle className="w-4 h-4" />
                                Disconnect
                            </button>
                        ) : (
                            <button
                                onClick={handleConnect}
                                disabled={connecting}
                                className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
                            >
                                {connecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
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
