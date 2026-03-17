import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface IncomingCallModalProps {
    userId: string;
    userName?: string;
}

interface CallSignal {
    type: 'call:ringing';
    callerId: string;
    callerName: string;
    roomUrl: string;
    roomId: string; // The database ID of the call
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ userId, userName }) => {
    const router = useRouter();
    const [incomingCall, setIncomingCall] = useState<CallSignal | null>(null);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!userId) return;

        console.log(`📞 Initializing Call Listener for user: ${userId}`);

        // Subscribe to private user channel for call signals
        const channel = supabase.channel(`user-calls:${userId}`)
            .on(
                'broadcast',
                'broadcast',
                { event: 'call:signal' },
                (payload: { payload: CallSignal }) => {
                    console.log('⚡ Received call signal:', payload);
                    const signal = payload.payload;

                    if (signal.type === 'call:ringing') {
                        setIncomingCall(signal);
                        // Play Ringtone
                        if (audioRef.current) {
                            audioRef.current.play().catch(e => console.error('Error playing ringtone:', e));
                        }
                    }
                }
            )
            .subscribe((status: string) => {
                console.log(`📡 Call Channel Status: ${status}`);
            });

        return () => {
            console.log('Cleaning up call listener...');
            supabase.removeChannel(channel);
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        };
    }, [userId]);

    const handleAnswer = () => {
        if (!incomingCall) return;

        // Stop ringtone
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        // Navigate to the call room
        console.log('✅ Answering call, redirecting to:', incomingCall.roomId);
        router.push(`/call/${incomingCall.roomId}`);
        setIncomingCall(null);
    };

    const handleDecline = () => {
        // Stop ringtone
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        // Optional: Send "Declined" signal back to caller (future improvement)
        setIncomingCall(null);
        toast('Call declined', { icon: '📴' });
    };

    if (!incomingCall) return <audio ref={audioRef} src="/sounds/ringtone.mp3" loop hidden />;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            {/* Ringtone Audio Element */}
            <audio ref={audioRef} src="/sounds/ringtone.mp3" loop hidden />

            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl shadow-teal-500/20 w-full max-w-sm p-8 text-center relative overflow-hidden">
                {/* Background Animation */}
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
                <div className="absolute -top-20 -left-20 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-700" />

                <div className="relative z-10">
                    <div className="w-24 h-24 rounded-full bg-slate-800 mx-auto mb-6 flex items-center justify-center relative">
                        <div className="absolute inset-0 rounded-full border-2 border-teal-500 animate-ping opacity-20" />
                        <div className="absolute inset-0 rounded-full border border-teal-500 animate-pulse opacity-40" />
                        <Video className="w-10 h-10 text-teal-400" />
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2">Incoming Call</h3>
                    <p className="text-slate-400 mb-8 flex items-center justify-center gap-2">
                        from <span className="text-teal-400 font-semibold">{incomingCall.callerName}</span>
                    </p>

                    <div className="flex items-center justify-center gap-6">
                        <button
                            onClick={handleDecline}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all duration-300 transform group-hover:scale-110">
                                <PhoneOff className="w-6 h-6 text-red-500 group-hover:text-white" />
                            </div>
                            <span className="text-sm text-slate-400 group-hover:text-white transition-colors">Decline</span>
                        </button>

                        <button
                            onClick={handleAnswer}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 transition-all duration-300 transform group-hover:scale-110 animate-bounce">
                                <Phone className="w-6 h-6 text-white fill-current" />
                            </div>
                            <span className="text-sm text-white font-medium">Answer</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IncomingCallModal;
