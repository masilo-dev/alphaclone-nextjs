import React, { useState } from 'react';
import { Button } from '../ui/UIComponents';
import { Copy, Check, ExternalLink, X, Users, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface MeetingLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    meetingLink: string;
    roomName: string;
    onJoinNow: () => void;
}

/**
 * Modal to display shareable meeting link prominently
 * Shows immediately after instant meeting creation
 */
const MeetingLinkModal: React.FC<MeetingLinkModalProps> = ({
    isOpen,
    onClose,
    meetingLink,
    roomName,
    onJoinNow
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(meetingLink);
            setCopied(true);
            toast.success('Link copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy link');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border-2 border-teal-500/30 max-w-md w-full animate-fade-in overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-500/20 to-blue-500/20 p-4 sm:p-6 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-teal-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/50 shrink-0">
                                <ExternalLink className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-2xl font-bold text-white">Meeting Ready</h2>
                                <p className="text-xs sm:text-sm text-gray-400">Copy link to invite</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors p-1"
                        >
                            <X className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                    {/* Meeting Link Display */}
                    <div>
                        <label className="block text-xs sm:text-sm font-bold text-white mb-2">
                            Share This Link
                        </label>
                        <div className="bg-gray-800/50 border-2 border-teal-500/30 rounded-lg p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="flex-1 overflow-hidden bg-gray-900/50 rounded px-2 py-1.5 sm:bg-transparent sm:p-0">
                                <p className="text-teal-400 font-mono text-sm break-all select-all">
                                    {meetingLink}
                                </p>
                            </div>
                            <Button
                                onClick={handleCopyLink}
                                className="bg-teal-600 hover:bg-teal-500 shrink-0 text-sm font-semibold h-10 sm:h-auto"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4 mr-2" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 mr-2" />
                                        Copy
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Meeting Details */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
                            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                <Users className="w-3.5 h-3.5" />
                                <span className="text-xs sm:text-xs uppercase tracking-wider">Max</span>
                            </div>
                            <p className="text-base sm:text-xl font-bold text-white">10 people</p>
                        </div>
                        <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
                            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="text-xs sm:text-xs uppercase tracking-wider">Room ID</span>
                            </div>
                            <p className="text-xs sm:text-sm font-mono text-white truncate">{roomName}</p>
                        </div>
                    </div>

                    {/* Simple Instructions */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 sm:p-4">
                        <p className="text-white font-semibold mb-1 text-xs sm:text-sm">
                            How to Use:
                        </p>
                        <ul className="text-xs sm:text-sm text-gray-300 space-y-0.5 sm:space-y-1 pl-1">
                            <li>• Share the link above</li>
                            <li>• Anyone can join (no login)</li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                            onClick={onJoinNow}
                            className="w-full bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white font-semibold py-2.5 sm:py-3 h-auto"
                        >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Join Now
                        </Button>
                        <Button
                            onClick={onClose}
                            variant="outline"
                            className="w-full sm:w-auto px-6 h-auto py-2.5 sm:py-3"
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MeetingLinkModal;

