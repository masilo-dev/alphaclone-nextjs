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
            // Convert room ID to Daily.co URL
            setRoomUrl(`https://${process.env.NEXT_PUBLIC_DAILY_DOMAIN || 'alphaclone'}.daily.co/${roomId}`);
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
            // Register guest in database
            const response = await fetch('/api/meetings/register-guest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: userName.trim(),
                    roomId: roomId,
                    roomUrl: roomUrl,
                })
            });

            if (!response.ok) {
                console.warn('Failed to register guest, continuing anyway...');
            } else {
                const data = await response.json();
                console.log('Guest registered:', data.guestId);
            }

            // Join meeting
            setIsJoined(true);
            toast.success('Joining meeting...');
        } catch (error) {
            console.error('Failed to register guest:', error);
            // Continue to join even if registration fails
            setIsJoined(true);
            toast.success('Joining meeting...');
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
                onLeave={handleLeave}
            />
        );
    }

    // Show join form
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Logo/Branding */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-teal-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/50">
                        <Video className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        AlphaClone Video
                    </h1>
                    <p className="text-gray-400">
                        Join your meeting
                    </p>
                </div>

                {/* Join form */}
                <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-700 shadow-2xl">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Your Name
                        </label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                                placeholder="Enter your name"
                                className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                                autoFocus
                            />
                        </div>
                    </div>

                    <Button
                        onClick={handleJoin}
                        disabled={isLoading || !userName.trim()}
                        className="w-full bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white font-medium py-3 rounded-lg transition-all shadow-lg shadow-teal-500/50"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                Joining...
                            </>
                        ) : (
                            <>
                                <Video className="w-5 h-5 mr-2" />
                                Join Meeting
                            </>
                        )}
                    </Button>

                    <p className="text-center text-sm text-gray-400 mt-6">
                        By joining, you agree to our{' '}
                        <a href="/legal/terms" className="text-teal-400 hover:text-teal-300">
                            Terms of Service
                        </a>
                    </p>
                </div>

                {/* Info */}
                <div className="mt-6 text-center text-sm text-gray-500">
                    <p>
                        Meeting ID: <span className="text-gray-400 font-mono">{roomId}</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default JoinMeeting;
