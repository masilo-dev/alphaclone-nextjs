'use client';

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, RefreshCw, Trash2, LogOut } from 'lucide-react';
import { WORKSPACE } from '@/constants/design';

export const DeletionOverlay: React.FC = () => {
    const { user, cancelAccountDeletion, signOut } = useAuth();
    const [isCancelling, setIsCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (user?.account_status !== 'pending_deletion') return null;

    const deletionDate = user.scheduled_deletion_at ? new Date(user.scheduled_deletion_at) : null;
    const daysRemaining = deletionDate
        ? Math.ceil((deletionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 30;

    const handleCancel = async () => {
        setIsCancelling(true);
        setError(null);
        try {
            const { error: cancelError } = await cancelAccountDeletion();
            if (cancelError) {
                setError(cancelError);
            }
        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-md">
            <div className={`max-w-md w-full p-8 space-y-6 text-center animate-in fade-in zoom-in duration-300 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
                <div className="flex justify-center">
                    <div className="rounded-full bg-amber-500/10 p-4">
                        <AlertTriangle className="w-12 h-12 text-amber-500" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Account Deletion Scheduled</h2>
                    <p className="text-slate-400">
                        Your account is scheduled for deletion in <span className="text-white font-semibold">{daysRemaining} days</span>.
                        During this period, access to your data is restricted.
                    </p>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm italic text-red-500">
                        {error}
                    </div>
                )}

                <div className="space-y-3">
                    <button
                        onClick={handleCancel}
                        disabled={isCancelling}
                        className="flex w-full items-center justify-center space-x-2 rounded-lg bg-white px-4 py-3 font-bold text-slate-900 transition-all hover:bg-slate-100 disabled:opacity-50"
                    >
                        {isCancelling ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <RefreshCw className="w-5 h-5" />
                                <span>Cancel Deletion & Restore Access</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={signOut}
                        className="flex w-full items-center justify-center space-x-2 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-toolbar)] px-4 py-3 font-semibold text-white transition-all hover:bg-[var(--ws-surface-2)]"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                    </button>
                </div>

                <p className="text-xs text-slate-500 italic">
                    If you prefer to continue with deletion, your data will be permanently removed after the 30-day period.
                    For immediate assistance, contact support.
                </p>
            </div>
        </div>
    );
};
