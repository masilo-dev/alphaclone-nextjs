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
    const [meetingUrl, setMeetingUrl] = useState('');
    const [copied, setCopied] = useState(false);

    const handleJoin = () => {
        if (!meetingUrl.trim()) {
            toast.error('Please enter a meeting room URL');
            return;
        }

        // Keep the check but make it generic or check for alpha-clone/daily
        if (!meetingUrl.includes('daily.co') && !meetingUrl.includes('alphaclone')) {
            toast.error('Please enter a valid AlphaClone Meeting URL');
            return;
        }

        onJoinRoom(meetingUrl);
    };

    const handleCopy = async () => {
        if (!meetingUrl.trim()) return;

        try {
            await navigator.clipboard.writeText(meetingUrl);
            setCopied(true);
            toast.success('Link copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy link');
        }
    };

    return (
        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl p-6 border-2 border-blue-500/30 transition-all duration-300">
            <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                    <Video className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-1">
                        Manual Meeting Access
                    </h3>
                    <p className="text-sm text-gray-300">
                        Paste a direct meeting link below to join instantly.
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 px-1">
                        Secure Room URL
                    </label>
                    <input
                        type="text"
                        value={meetingUrl}
                        onChange={(e) => setMeetingUrl(e.target.value)}
                        placeholder="https://alphaclone.tech/meet/room-name"
                        className="w-full bg-gray-900/50 border border-blue-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-400 transition-all shadow-inner"
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleJoin}
                        disabled={!meetingUrl.trim()}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                    >
                        <Video className="w-4 h-4" />
                        Join Session
                    </button>

                    {meetingUrl.trim() && (
                        <button
                            onClick={handleCopy}
                            className="px-4 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white rounded-xl transition-all active:scale-95"
                        >
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Protocol Instructions</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                    Enter the full URL provided by your business host. Ensure the meeting link follows the <strong className="text-white">alphaclone.tech/meet/</strong> format for optimal security and video performance.
                </p>
            </div>
        </div>
    );
};

export default ManualMeetingLink;
