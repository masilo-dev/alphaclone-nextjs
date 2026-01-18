import React, { useEffect, useState } from 'react';
import { PhoneMissed, X, Phone } from 'lucide-react';
import { missedCallsService, MissedCall } from '../../services/missedCallsService';
import { Button, Modal } from '../ui/UIComponents';
import toast from 'react-hot-toast';

interface MissedCallsNotificationProps {
    userId: string;
    onCallBack?: (callerId: string) => void;
}

const MissedCallsNotification: React.FC<MissedCallsNotificationProps> = ({
    userId,
    onCallBack
}) => {
    const [unseenCount, setUnseenCount] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadUnseenCount();

        // Subscribe to new missed calls
        const unsubscribe = missedCallsService.subscribeToMissedCalls(
            userId,
            (newMissedCall) => {
                setUnseenCount(prev => prev + 1);
                toast((t) => (
                    <div className="flex items-center gap-3">
                        <PhoneMissed className="w-5 h-5 text-red-400" />
                        <div>
                            <p className="font-medium text-white">Missed Call</p>
                            <p className="text-sm text-slate-400">From {newMissedCall.caller_name || 'Unknown'}</p>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => {
                                toast.dismiss(t.id);
                                if (onCallBack) {
                                    onCallBack(newMissedCall.caller_id);
                                }
                            }}
                        >
                            Call Back
                        </Button>
                    </div>
                ), {
                    duration: 10000,
                    icon: null
                });
            }
        );

        return () => {
            unsubscribe();
        };
    }, [userId]);

    const loadUnseenCount = async () => {
        const { count } = await missedCallsService.getUnseenMissedCallsCount(userId);
        setUnseenCount(count);
    };

    const loadMissedCalls = async () => {
        setLoading(true);
        const { missedCalls: calls } = await missedCallsService.getMissedCallsForUser(userId, 20);
        setMissedCalls(calls);
        setLoading(false);
    };

    const handleOpenModal = async () => {
        setShowModal(true);
        await loadMissedCalls();
        // Mark all as seen
        await missedCallsService.markAllMissedCallsSeen(userId);
        setUnseenCount(0);
    };

    const handleCallBack = (callerId: string) => {
        setShowModal(false);
        if (onCallBack) {
            onCallBack(callerId);
        }
    };

    if (unseenCount === 0) return null;

    return (
        <>
            <button
                onClick={handleOpenModal}
                className="relative p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all"
                aria-label={`${unseenCount} missed calls`}
            >
                <PhoneMissed className="w-5 h-5 text-red-400" />
                {unseenCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unseenCount > 9 ? '9+' : unseenCount}
                    </span>
                )}
            </button>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title="Missed Calls"
            >
                <div className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div>
                        </div>
                    ) : missedCalls.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <PhoneMissed className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No missed calls</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {missedCalls.map((call) => (
                                <div
                                    key={call.id}
                                    className={`p-4 rounded-lg border transition-all ${
                                        call.seen_at
                                            ? 'bg-slate-800/30 border-slate-700/30'
                                            : 'bg-red-500/10 border-red-500/20'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                            <img
                                                src={call.caller_avatar || '/default-avatar.png'}
                                                alt={call.caller_name || 'Unknown'}
                                                className="w-10 h-10 rounded-full"
                                            />
                                            <div>
                                                <p className="font-medium text-white">
                                                    {call.caller_name || 'Unknown'}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {new Date(call.attempted_at).toLocaleString()}
                                                </p>
                                                <p className="text-xs text-slate-500 capitalize">
                                                    {call.call_type} call
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleCallBack(call.caller_id)}
                                        >
                                            <Phone className="w-4 h-4 mr-2" />
                                            Call Back
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="pt-4 border-t border-slate-700">
                        <Button
                            variant="outline"
                            onClick={() => setShowModal(false)}
                            className="w-full"
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default MissedCallsNotification;
