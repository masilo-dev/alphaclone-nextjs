import React from 'react';
import { ChatMessage } from '../../types';
import { format } from 'date-fns';
import { Loader2, FileIcon, Download, CheckCheck, Flag } from 'lucide-react';

interface MessageBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
    showAvatar?: boolean;
    showSenderName?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isOwn,
    showAvatar = true,
    showSenderName = true
}) => {
    const isUrgent = message.priority === 'urgent';
    const isHigh = message.priority === 'high';

    return (
        <div className={`flex w-full mb-1 ${isOwn ? 'justify-end' : 'justify-start'} group animate-fade-in`}>
            <div className={`flex max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>

                {/* Avatar Gutter */}
                <div className="w-8 flex-shrink-0">
                    {!isOwn && showAvatar && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            {message.senderName?.[0]?.toUpperCase() || '?'}
                        </div>
                    )}
                </div>

                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                    {/* Sender Name */}
                    {!isOwn && showSenderName && (
                        <span className="text-xs text-slate-400 ml-1 mb-1 flex items-center gap-2">
                            {message.senderName}
                            {isUrgent && <span className="text-red-400 flex items-center text-[10px] font-bold"><Flag size={10} className="mr-0.5 fill-red-400" /> URGENT</span>}
                            {isHigh && <span className="text-orange-400 flex items-center text-[10px] font-bold"><Flag size={10} className="mr-0.5 fill-orange-400" /> HIGH PRIORITY</span>}
                        </span>
                    )}

                    {/* Message Bubble */}
                    <div
                        className={`
              relative px-4 py-2 rounded-2xl text-sm shadow-sm border
              ${isOwn
                                ? 'bg-blue-600 text-white rounded-br-sm border-blue-500'
                                : isUrgent
                                    ? 'bg-red-500/10 border-red-500/50 text-red-100 rounded-bl-sm backdrop-blur-md'
                                    : 'bg-white/5 border-white/10 text-slate-200 rounded-bl-sm backdrop-blur-md'}
            `}
                    >
                        {/* Attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                            <div className="mb-2 space-y-2">
                                {message.attachments.map((att) => (
                                    <div key={att.id}>
                                        {att.type === 'image' ? (
                                            <div className="relative group/image overflow-hidden rounded-lg border border-white/10">
                                                <img
                                                    src={att.url}
                                                    alt={att.name}
                                                    className="max-w-full h-auto max-h-48 object-cover"
                                                />
                                                <a
                                                    href={att.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center text-white"
                                                >
                                                    <Download size={20} />
                                                </a>
                                            </div>
                                        ) : (
                                            <a
                                                href={att.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`flex items-center gap-3 p-3 rounded-lg border ${isOwn ? 'bg-blue-700/50 border-blue-500/30' : 'bg-white/5 border-white/10'} hover:bg-black/20 transition-colors`}
                                            >
                                                <div className="p-2 bg-white/10 rounded-lg">
                                                    <FileIcon size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium truncate">{att.name}</p>
                                                    <p className="text-[10px] opacity-70">Attachment</p>
                                                </div>
                                                <Download size={14} opacity={0.7} />
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Text Content */}
                        {message.text && (
                            <p className="whitespace-pre-wrap break-words">{message.text}</p>
                        )}

                        {/* Thinking/Loading State (for AI) */}
                        {message.isThinking && (
                            <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
                                <Loader2 size={12} className="animate-spin" />
                                <span>Thinking...</span>
                            </div>
                        )}

                        {/* Timestamp & Status (Inside bubble) */}
                        <div className={`text-[10px] mt-1 flex items-center gap-1 ${isOwn ? 'text-blue-200 justify-end' : 'text-slate-400'}`}>
                            {format(new Date(message.timestamp), 'h:mm a')}
                            {isOwn && (
                                <CheckCheck
                                    size={14}
                                    className={`transition-colors duration-300 ${message.readAt ? 'text-teal-300' : 'text-blue-300/50'}`}
                                />
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
