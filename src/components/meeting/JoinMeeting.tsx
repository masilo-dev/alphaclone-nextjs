import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '../ui/UIComponents';
import CustomVideoRoom from '../dashboard/video/CustomVideoRoom';
import { Video, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { User } from '../../types';

/**
 * Public meeting join page
 * Allows anyone with a link to join a meeting
 */
const JoinMeeting: React.FC = () => {
    const params = useParams();
    const roomId = params?.roomId as string;
    const router = useRouter();

    const [userName, setUserName] = useState('');
    const [isJoined, setIsJoined] = useState(false);
    const [roomUrl, setRoomUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Get room URL from room ID
    useEffect(() => {
        if (roomId) {
            // Internal mapping - users stay on alphaclonesystems.com
            const domain = process.env.NEXT_PUBLIC_DAILY_DOMAIN || 'alphaclone';
            setRoomUrl(`https://${domain}.daily.co/${roomId}`);
        }
    }, [roomId]);

    const handleJoin = async () => {
        if (!userName.trim()) {
            toast.error('Please enter your name');
            return;
        }

        if (!roomUrl) {
            toast.error('Invalid meeting link');
            return;
        }

        setIsLoading(true);
        try {
            // Register guest in database for analytics/tracking
            await fetch('/api/meetings/register-guest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: userName.trim(),
                    roomId: roomId,
                    roomUrl: roomUrl,
                })
            }).catch(err => console.warn('Guest registration skipped:', err));

            // Join meeting
            setIsJoined(true);
            toast.success('Establishing secure connection...');
        } catch (error) {
            console.error('Failed to join:', error);
            setIsJoined(true);
            toast.success('Connecting...');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLeave = () => {
        setIsJoined(false);
        router.push('/');
    };

    // If already joined, show video room
    if (isJoined && roomUrl) {
        const guestUser: any = {
            id: 'guest-' + Date.now(),
            name: userName,
            email: '',
            role: 'client',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        return (
            <CustomVideoRoom
                user={guestUser}
                roomUrl={roomUrl}
                callId={roomId}
                onLeave={handleLeave}
            />
        );
    }

    // Show join form
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-md w-full relative z-10">
                {/* Logo/Branding */}
                <div className="text-center mb-10 space-y-4">
                    <div className="relative inline-block">
                        <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-teal-500 rounded-2xl blur opacity-25"></div>
                        <div className="relative w-20 h-20 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto shadow-2xl">
                            <Video className="w-10 h-10 text-blue-400" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">
                            AlphaClone <span className="text-blue-400">Video</span>
                        </h1>
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">
                            Secure Business Protocol
                        </p>
                    </div>
                </div>

                {/* Join form */}
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl p-8 border border-white/5 shadow-2xl space-y-8">
                    <div className="space-y-4">
                        <div className="relative group">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest absolute -top-1.5 left-3 px-1 bg-slate-950 z-10 transition-colors group-focus-within:text-blue-400">
                                Your Identity
                            </label>
                            <div className="relative">
                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                <input
                                    type="text"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                                    placeholder="Enter your name to join"
                                    className="w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                    autoFocus
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleJoin}
                        disabled={isLoading || !userName.trim()}
                        className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl transition-all shadow-xl shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-3"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Video className="w-5 h-5" />
                        )}
                        Enter Meeting
                    </button>

                    <div className="flex items-center gap-4 text-slate-600">
                        <div className="h-px flex-1 bg-slate-800/50" />
                        <span className="text-xs font-bold uppercase tracking-widest">End-to-End Encrypted</span>
                        <div className="h-px flex-1 bg-slate-800/50" />
                    </div>

                    <p className="text-center text-xs text-slate-500 leading-relaxed">
                        By joining, you agree to the AlphaClone ecosystem{' '}
                        <a href="/legal/terms" className="text-blue-400 hover:underline">
                            Security Protocols
                        </a>
                    </p>
                </div>

                {/* Secure ID Badge */}
                <div className="mt-8 flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Room Identifier: {roomId?.substring(0, 8)}...
                    </span>
                </div>
            </div>
        </div>
    );
};

export default JoinMeeting;

