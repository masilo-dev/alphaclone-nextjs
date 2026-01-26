import React, { useState } from 'react';
import { Button } from '../ui/UIComponents';
import { Video, ExternalLink, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { User } from '../../types';

interface ManualMeetingLinkProps {
    user: User;
    onJoinRoom: (roomUrl: string) => void;
}

/**
 * Manual Meeting Link - For when API creation fails
 * Uses pre-created Daily.co rooms
 */
const ManualMeetingLink: React.FC<ManualMeetingLinkProps> = ({ user, onJoinRoom }) => {
    const [dailyUrl, setDailyUrl] = useState('');
    const [copied, setCopied] = useState(false);

    const handleJoin = () => {
        if (!dailyUrl.trim()) {
            toast.error('Please enter a Daily.co room URL');
            return;
        }

        if (!dailyUrl.includes('daily.co')) {
            toast.error('Please enter a valid Daily.co URL');
            return;
        }

        onJoinRoom(dailyUrl);
    };

    const handleCopy = async () => {
        if (!dailyUrl.trim()) return;

        try {
            await navigator.clipboard.writeText(dailyUrl);
            setCopied(true);
            toast.success('Link copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy link');
        }
    };

    return (
        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl p-6 border-2 border-blue-500/30">
            <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shrink-0">
                    <Video className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-1">
                        Use Daily.co Room URL
                    </h3>
                    <p className="text-sm text-gray-300">
                        Create a room at <a href="https://dashboard.daily.co/rooms" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Daily.co Dashboard</a> and paste the URL here
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                <div>
                    <label className="block text-sm text-gray-400 mb-2">
                        Daily.co Room URL
                    </label>
                    <input
                        type="text"
                        value={dailyUrl}
                        onChange={(e) => setDailyUrl(e.target.value)}
                        placeholder="https://your-domain.daily.co/room-name"
                        className="w-full bg-gray-900/50 border-2 border-blue-500/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
                    />
                </div>

                <div className="flex gap-3">
                    <Button
                        onClick={handleJoin}
                        disabled={!dailyUrl.trim()}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                    >
                        <Video className="w-4 h-4 mr-2" />
                        Join Meeting
                    </Button>

                    {dailyUrl.trim() && (
                        <Button
                            onClick={handleCopy}
                            variant="outline"
                            className="border-blue-500/50 hover:bg-blue-500/10"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-4 h-4 mr-1" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4 mr-1" />
                                    Copy
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-gray-300">
                    <strong className="text-white">How to create a room:</strong>
                    <br />
                    1. Go to <a href="https://dashboard.daily.co/rooms" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Daily.co Dashboard</a>
                    <br />
                    2. Click "Create Room"
                    <br />
                    3. Copy the room URL and paste it above
                </p>
            </div>
        </div>
    );
};

export default ManualMeetingLink;
