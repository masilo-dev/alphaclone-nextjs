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
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border-2 border-teal-500/30 max-w-2xl w-full animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-500/20 to-blue-500/20 p-6 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/50">
                                <ExternalLink className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Meeting Link Ready</h2>
                                <p className="text-sm text-gray-400">Copy and share to invite people</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Meeting Link Display */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Share This Link
                        </label>
                        <div className="bg-gray-800/50 border-2 border-teal-500/30 rounded-lg p-4 flex items-center gap-3">
                            <div className="flex-1 overflow-hidden">
                                <p className="text-teal-400 font-mono text-base break-all select-all">
                                    {meetingLink}
                                </p>
                            </div>
                            <Button
                                onClick={handleCopyLink}
                                className="bg-teal-600 hover:bg-teal-500 shrink-0 text-base font-semibold px-6"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-5 h-5 mr-2" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-5 h-5 mr-2" />
                                        Copy Link
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Meeting Details */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
                            <div className="flex items-center gap-2 text-gray-400 mb-1">
                                <Users className="w-4 h-4" />
                                <span className="text-xs">Max Participants</span>
                            </div>
                            <p className="text-xl font-bold text-white">10 people</p>
                        </div>
                        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
                            <div className="flex items-center gap-2 text-gray-400 mb-1">
                                <Clock className="w-4 h-4" />
                                <span className="text-xs">Room ID</span>
                            </div>
                            <p className="text-sm font-mono text-white truncate">{roomName}</p>
                        </div>
                    </div>

                    {/* Simple Instructions */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <p className="text-white font-semibold mb-2">
                            📋 How to Use:
                        </p>
                        <ul className="text-sm text-gray-300 space-y-1">
                            <li>1. Copy the link above</li>
                            <li>2. Share via email, SMS, or chat</li>
                            <li>3. Anyone can join - no login needed</li>
                            <li>4. Max 10 people allowed</li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <Button
                            onClick={onJoinNow}
                            className="flex-1 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white font-semibold py-3"
                        >
                            <ExternalLink className="w-5 h-5 mr-2" />
                            Join Meeting Now
                        </Button>
                        <Button
                            onClick={onClose}
                            variant="outline"
                            className="px-6"
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
