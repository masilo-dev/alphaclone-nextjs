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
                <div className="absolute top-0 right-0 px-3 py-1 bg-slate-800 text-teal-400 text-[8px] font-black uppercase tracking-widest rounded-bl-xl border-l border-b border-white/5">
                    Coming Soon
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 opacity-60">
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-800 text-slate-500'}`}>
                            <Mail className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-white">
                                    Gmail Integration (Coming Soon)
                                </h4>
                                {isConnected ? (
                                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-slate-500" />
                                )}
                            </div>
                            <p className="text-sm text-slate-400 max-w-md">
                                This feature is currently in final testing. You'll be able to link your account and manage communications very soon.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            disabled
                            className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-slate-500 font-black text-sm uppercase tracking-widest rounded-xl border border-white/5 cursor-not-allowed transition-all"
                        >
                            <Mail className="w-4 h-4" />
                            LOCKED
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GmailIntegration;
